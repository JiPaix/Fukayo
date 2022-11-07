import Mirror from '@api/models/abstracts';
import type MirrorInterface from '@api/models/interfaces';
import type { MirrorConstructor } from '@api/models/types/constructor';
import type { MangaPage } from '@api/models/types/manga';
import Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';

type JSONQueryResult = {
  suggestions : {
    value: string,
    data: string
  }[]
}

export class MyMangaReaderCMS<T = Record<string, unknown>> extends Mirror implements MirrorInterface {
  private chapter_selector: string;
  private chapter_url: RegExp;
  private manga_page_appended_string?: string;

  constructor(opts: MirrorConstructor<T> & {
    /** ul css selector */
    chapter_selector?: string,
    /** regexp to recognize chapter urls */
    chapter_url?: RegExp,
    /** on the chapter page they sometimes add a prefix to the manga name */
    manga_page_appended_string?: string,
  }) {
    super(opts);
    this.chapter_selector = opts.chapter_selector || 'ul.chapters a[href*=manga]';
    this.chapter_url = opts.chapter_url || /\/manga\/.+\/\d+$/gmi;
    this.manga_page_appended_string = opts.manga_page_appended_string;
  }

  isMangaPage(url: string): boolean {
    const res = /\/manga\/.+$/gmi.test(url);
    if(!res || this.isChapterPage(url, true)) {
      this.logger('not a manga page:', url);
      return false;
    }
    return res;
  }

  isChapterPage(url: string, internal = false): boolean {
    const reg = new RegExp(this.chapter_url);
    const res = reg.test(url);
    if(!res && !internal) this.logger('not a chapter page:', url);
    return res;
  }

  getChapterInfoFromString(str:string) {
    const res = /(\d+(\.|-|_)?(\d+)?)$$/gmi.exec(str);
    if(!res) this.logger('not a chapter string', str);
    return res;
  }

  async search(query:string, langs: mirrorsLangsType[] , socket: socketInstance, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    socket.once('stopSearchInMirrors', () => {
      this.logger('search canceled');
      this.stopListening(socket);
      cancel = true;
    });

    const url = `${this.host}/search?query=${query}`;
    if(cancel) return; //=> 1st cancel check before request
    try {
      const json = await this.fetch<JSONQueryResult>({
        url,
      }, 'json');

      // gather urls we will need to fetch
      const res = [];
      for(const obj of json.suggestions) {
        res.push({name: obj.data, url: `${this.host}/manga/${obj.data}`});
      }

      for(const obj of res) {
        if(cancel) break; //=> 2nd cancel check before request

        const $ = await this.fetch({
          url: obj.url,
          waitForSelector: '#post_id',
        }, 'html');

        const name = obj.name;
        const link = obj.url.replace(this.host, '');

        const covers: string[] = [];
        let coverLink = $('img.img-responsive').attr('src');
        if(coverLink) {
          if(coverLink.startsWith('//')) coverLink = `${this.host.startsWith('https') ? 'https' : 'http'}:${coverLink}`;
          const img = await this.downloadImage(coverLink);
          if(img) covers.push(img);
        }

        let synopsis:string|undefined = $('.well p').text().trim();
        if(synopsis && synopsis.length === 0) synopsis = undefined;

        const last_chapter = $(this.chapter_selector).first().text().trim();
        if(!last_chapter) continue;

        const match = this.getChapterInfoFromString(last_chapter);
        let last_release;

        if(match && typeof match === 'object') {
          const [,chapterNumber] = match;

          let chapter:number|undefined = parseFloat(chapterNumber);
          if(isNaN(chapter)) chapter = undefined;
          last_release = {
            name: last_chapter.replace(chapterNumber, '').trim(),
            chapter: chapter,
          };
        } else {
          last_release = {
            name: last_chapter,
          };
        }

        const searchResult = await this.searchResultsBuilder({
          name,
          url:link,
          covers,
          synopsis,
          last_release,
          langs: this.langs,
        });
        if(!cancel) socket.emit('searchInMirrors', id, searchResult);
      }
      if(cancel) return;
    } catch(e) {
        this.logger('error while searching mangas', e);
        // we catch any errors because the client needs to be able to handle them
        if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
        else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
        else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error' });
    }
    socket.emit('searchInMirrors', id, { done: true });
  }

  async recommend(requestLangs:mirrorsLangsType[], socket: socketInstance, id: number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof Scheduler)) {
      socket.once('stopShowRecommend', () => {
        this.logger('fetching recommendations canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }
    try {
      const $ = await this.fetch({
        url: this.host,
        waitForSelector: 'ul.hot-thumbnails',
      }, 'html');

      for(const el of $('.hot-thumbnails .photo')) {
        if(cancel) break;
        const link = $('a', el).attr('href')?.replace(this.host, '');
        const name = $('a', el).first().text().trim();
        if(!link || !name || !this.isMangaPage(link)) {
          this.logger({ link, name, isMangaPage: this.isMangaPage(link||'') });
          continue;
        }

        const covers: string[] = [];
        let coverLink = $('img', el).attr('src');
        if(coverLink) {
          if(coverLink.startsWith('//')) coverLink = `${this.host.startsWith('https') ? 'https' : 'http'}:${coverLink}`;
          const img = await this.downloadImage(coverLink);
          if(img) covers.push(img);
        }


        const searchResult = await this.searchResultsBuilder({
          name,
          url:link,
          covers,
          langs: this.langs,
        });
        if(!cancel) socket.emit('showRecommend', id, searchResult);
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while recommending mangas', e);
      if(e instanceof Error) socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e});
      else socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error_unknown'});
    }
    socket.emit('showRecommend', id, { done: true });
    return this.stopListening(socket);
  }

  async manga(url:string, langs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number)  {

    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof Scheduler)) {
      socket.once('stopShowManga', () => {
        this.logger('fetching manga canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }

    const link = url.replace(this.host, '');
    const isMangaPage = this.isMangaPage(link);
    if(!isMangaPage) {
      socket.emit('showManga', id, {error: 'manga_error_invalid_link'});
      return this.stopListening(socket);
    }

    try {
      const $ = await this.fetch({
        url: `${this.host}${link}`,
        waitForSelector: this.chapter_selector,
      }, 'html');

      let name = $('h2.widget-title').first().text().trim();
      if(this.manga_page_appended_string) name = name.replace(this.manga_page_appended_string, '').trim();
      const synopsis = $('.well p').text().trim();
      const covers: string[] = [];

      if(cancel) return;

      let coverLink = $('.boxed img').attr('src');
      if(coverLink) {
        if(coverLink.startsWith('//')) coverLink = `${this.host.startsWith('https') ? 'https' : 'http'}:${coverLink}`;
        const img = await this.downloadImage(coverLink);
        if(img) covers.push(img);
      }

      // getting author(s) and tags
      const uniq_authors = new Set<string>();
      const uniq_tags = new Set<string>();

      $('a[href*=author], a[href*=artist]').each((i, el) => {
        const author = $(el).text().trim().toLocaleLowerCase();
        if(author.length) uniq_authors.add(author);
      });

      $('a[href*=category]').each((i, el) => {
        const tag = $(el).text().trim().toLocaleLowerCase();
        if(tag.length) uniq_tags.add(tag);
      });

      let status:MangaPage['status'] = 'unknown';
      const el = $('.dl-horizontal > dd > span');

      if(el.hasClass('label-success')) status = 'ongoing';
      if(el.hasClass('label-danger')) status = 'completed';

      const authors = Array.from(uniq_authors);
      const tags = Array.from(uniq_tags);

      const chapters:MangaPage['chapters'] = [];

      for(const [i, el] of $(this.chapter_selector).toArray().reverse().entries()) {
        if(cancel) break;
        const current_chapter = $(el).text().trim().replace(name, '').trim();
        const chaplink = $(el).attr('href')?.replace(this.host, '');
        if(!chaplink) continue;

        const match = this.getChapterInfoFromString(current_chapter);
        const [ ,chapterNumber] = match || [];

        const chapter =
          chapterNumber && !isNaN(parseFloat(chapterNumber.replace(/(-|_)/, '.')))
            ?
              parseFloat(chapterNumber.replace(/(-|_)/, '.'))
            :
              i+1;

        const built = await this.chaptersBuilder({
          name: current_chapter,
          number: chapter,
          url: chaplink,
          lang: this.langs[0],
        });
        chapters.push(built);
      }

      const mg = await this.mangaPageBuilder({
        name,
        url: link,
        langs: this.langs,
        synopsis,
        tags,
        chapters,
        covers,
        authors,
        status,
      });
      if(!cancel) socket.emit('showManga', id, mg);
    } catch(e) {
      this.logger('error while fetching manga', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
      else socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
    return this.stopListening(socket);
  }

  async chapter(url:string, lang:mirrorsLangsType, socket:socketInstance|Scheduler, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof Scheduler)) {
      socket.once('stopShowChapter', () => {
        this.logger('fetching chapter canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }

    const link = url.replace(this.host, '');
    this.logger('fetching', url);
    // safeguard, we return an error if the link is not a chapter page
    const isLinkaChapter = this.isChapterPage(link);
    if(!isLinkaChapter) {
      socket.emit('showChapter', id, {error: 'chapter_error_invalid_link'});
      return this.stopListening(socket);
    }
    if(cancel) return;
    try {
      const $ = await this.fetch({
        url: `${this.host}${link}`,
        waitForSelector: '.viewer-cnt #ppp',
      }, 'html');

      // return the number of pages to expect (1-based)
      const nbOfPages = $($('img', $('.viewer-cnt #ppp').prev())).length;
      if(callback) callback(nbOfPages);

      if(cancel) return;
      const res:string[] = [];
      $('img', $('.viewer-cnt #ppp').prev()).each((i, el) => {
          let src = $(el).attr('data-src');
          if (src && src !== '') {
              if (src.indexOf('//') === 0) src = this.host + src;
              res.push(src.trim());
          }
      });

      for(const [i, imgLink] of res.entries()) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;
        const img = await this.downloadImage(imgLink, `${this.host}${link}`);
        if(img) {
          socket.emit('showChapter', id, { index: i, src: img, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
          continue;
        }
        socket.emit('showChapter', id, { error: 'chapter_error_fetch', index: i, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
      }

      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching chapter', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showChapter', id, {error: 'chapter_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showChapter', id, {error: 'chapter_error', trace: e});
      else socket.emit('showChapter', id, {error: 'chapter_error_unknown'});
    }
    return this.stopListening(socket);
  }
}
