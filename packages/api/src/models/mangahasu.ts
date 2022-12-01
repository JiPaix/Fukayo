import Mirror from '@api/models/abstracts';
import icon from '@api/models/icons/mangahasu.png';
import type MirrorInterface from '@api/models/interfaces';
import type { MangaPage } from '@api/models/types/manga';
import Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';
import type { SearchResult } from './types/search';

class MangaHasu extends Mirror implements MirrorInterface {

  constructor() {
    super({
      version: 1,
      isDead: false,
      host: 'https://mangahasu.se',
      althost: ['https://www.mangahasu.se'],
      name: 'mangahasu',
      displayName: 'MangaHasu',
      langs: ['en'],
      requestLimits: {
        time: 500,
        concurrent: 1,
      },
      icon,
      meta: {
        speed: 0.5,
        quality: 0.7,
        popularity: 0.7,
      },
      options: {
        enabled: true,
        cache: true,
      },
    });
  }

  isMangaPage(url: string): boolean {
    const res = /^\/.*-\w{3,4}-p\d+\.html$/gmi.test(url);
    if(!res) this.logger('not a manga page:', url);
    return res;
  }
  isChapterPage(url: string): boolean {
    const res = /\/.*\/.*-\w{3,4}-c\d+\.html$/gmi.test(url);
    if(!res) this.logger('not a chapter page:', url);
    return res;
  }
  #getChapterInfoFromString(str:string) {
    const res = /(Vol\s(\d+)\s)?Chapter\s([0-9]+(\.)?([0-9]+)?)(:\s(.*))?/gmi.exec(str);
    if(!res) this.logger('not a chapter string:', str);
    return res;
  }

  async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|Scheduler, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopSearchInMirrors', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopSearchInMirrors', stopListening);
      socket.once('disconnect', stopListening);
    }

    try {
      const url = `${this.host}/advanced-search.html?keyword=${query}`;
      const $ = await this.fetch({
        url,
        waitForSelector: '.tag.search-results-a',
      }, 'html');

      for(const el of $('div.div_item')) {
        if(cancel) break; //=> 2nd cancel check, break out of loop
        const name = $('a.name-manga > h3', el).text().trim();
        const link = $('a.name-manga', el).attr('href')?.replace(this.host, '');

        if((!name || !link) || (link && !this.isMangaPage(link))) continue;

        // mangahasu images needs to be downloaded.
        const covers:string[] = [];
        const coverLink = $('.wrapper_imgage img', el).attr('src');
        if(coverLink) {
          const img = await this.downloadImage(coverLink, undefined, false);
          if(img) covers.push(img.src);
        }

        let last_release: SearchResult['last_release'];
        const last_chapter = $('a.name-chapter > span', el).text().trim();
        const match = this.#getChapterInfoFromString(last_chapter);

        if(!match) last_release = {name: last_chapter.replace(/Chapter/gi, '').trim()};

        if(match && typeof match === 'object') {
          const [, , volumeNumber, chapterNumber, , , , chapterName] = match;
          last_release = {
            name: chapterName ? chapterName.trim() : undefined,
            volume: volumeNumber ? parseFloat(volumeNumber) : undefined,
            chapter: chapterNumber ? parseFloat(chapterNumber) : 0,
          };
        }

        const searchResults = await this.searchResultsBuilder({
          name,
          url:link,
          covers,
          last_release,
          langs: this.langs,
        });

        socket.emit('searchInMirrors', id, searchResults);
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while searching mangas', e);
      if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
      else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error'});
    }
    socket.emit('searchInMirrors', id, { done: true });
    if(stopListening) stopListening();
  }

  async manga(url:string, langs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopShowManga', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopShowManga', stopListening);
      socket.once('disconnect', stopListening);
    }

    const link = url.replace(this.host, '');
    const isMangaPage = this.isMangaPage(link);
    if(!isMangaPage) {
      socket.emit('showManga', id, {error: 'manga_error_invalid_link'});
      if(stopListening) return stopListening();
      return;
    }

    try {
      const $ = await this.fetch({
        url: `${this.host}${link}`,
        waitForSelector: 'td.name > a',
      }, 'html');
      const name = $('.info-title > h1').text().trim();
      const synopsis = $('.content-info:contains("Summary") > div').text().trim();
      const covers: string[] = [];

      if(cancel) return;
      // mangahasu images needs to be downloaded.
      const coverLink = $('.info-img > img').attr('src');
      if(coverLink) {
        const img = await this.downloadImage(coverLink, undefined, false);
        if(img) covers.push(img.src);
      }

      // getting author(s) and tags
      const authors:string[] = [];
      const tags:string[] = [];

      $('.info-c .detail_item > .row:contains("Author(s)") a').each((i, el) => {
        const author = $(el).text().trim().toLocaleLowerCase();
        if(author.length) authors.push(author);
      });

      $('.info-c .detail_item.row-a:contains("Genre(s)") a').each((i, el) => {
        const tag = $(el).text().trim().toLocaleLowerCase();
        if(tag.length) tags.push(tag);
      });

      const status = $('.info-c .detail_item.row-a:contains("status") a').first().text().trim().toLocaleLowerCase() as 'completed' | 'ongoing';
      const chapters:MangaPage['chapters'] = [];

      for(const [i, el] of $('td.name > a').toArray().reverse().entries()) {
        if(cancel) break;

        const chaplink = $(el).attr('href');
        if(!chaplink) continue;

        const current_line = $(el).text().trim();
        const match = this.#getChapterInfoFromString(current_line);
        const [, , , , , , , chapterName] = match || [];
        const name = chapterName ? chapterName.trim() : current_line.replace(/chapter|chap|chaps/gi, '').trim();
        if(!name || !name.length) continue;
        const built = await this.chaptersBuilder({
          name,
          number: i+1,
          url: chaplink,
          lang: this.langs[0],
        });
        chapters.push(built);
      }
      if(cancel) return;
      const mg = await this.mangaPageBuilder({
        url: link,
        langs,
        name,
        synopsis,
        covers,
        authors,
        tags,
        chapters,
        status,
      });
      socket.emit('showManga', id, mg);
    } catch(e) {
      this.logger('error while fetching manga', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
      else socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
    if(stopListening) stopListening();
  }

  async chapter(url:string, lang:mirrorsLangsType, socket:socketInstance|Scheduler, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopShowChapter', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopShowChapter', stopListening);
      socket.once('disconnect', stopListening);
    }

    const link = url.replace(this.host, '');

    // safeguard, we return an error if the link is not a chapter page
    const isLinkaChapter = this.isChapterPage(link);
    if(!isLinkaChapter) {
      socket.emit('showChapter', id, {error: 'chapter_error_invalid_link'});
      if(stopListening) stopListening();
      return;
    }

    if(cancel) return;

    try {
      const $ = await this.fetch({
        url: `${this.host}${link}`,
        waitForSelector: '.img-chapter',
      }, 'html');

      // return the number of pages to expect (1-based)
      const nbOfPages = $('.img-chapter img').length;
      if(callback) callback(nbOfPages);

      if(cancel) return;
      for(const [i, el] of $('.img-chapter img').toArray().entries()) {
        if(cancel) break;
        // if the user requested a specific page, we will skip the others
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;

        const imgLink = $(el).attr('src');
        if(imgLink) {
          const img = await this.downloadImage(imgLink, `${this.host}${link}`, false);
          if(img) {
            socket.emit('showChapter', id, { index: i, src: img.src, height: img.height, width: img.width, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
            continue;
          }
        }
        if(!cancel) socket.emit('showChapter', id, { error: 'chapter_error_fetch', index: i, lastpage: typeof retryIndex === 'number' ? true: i+1 === nbOfPages });
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching chapter', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showChapter', id, {error: 'chapter_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showChapter', id, {error: 'chapter_error', trace: e});
      else socket.emit('showChapter', id, {error: 'chapter_error_unknown'});
    }
    if(stopListening) stopListening();
  }

  async recommend(requestLangs:mirrorsLangsType[], socket: socketInstance|Scheduler, id: number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopShowRecommend', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopShowRecommend', stopListening);
      socket.once('disconnect', stopListening);
    }

    try {
      const url = `${this.host}/popular-dw.html`;
      const $ = await this.fetch({
        url,
        waitForSelector: '.r_content',
      }, 'html');

      for(const el of $('.list-rank li')) {
        if(cancel) break;
        const link = $('.info-manga > a', el).first().attr('href')?.replace(this.host, '');
        const name = $('.info-manga .name-manga', el).text().trim();
        if((!name || !link) || (link && !this.isMangaPage(link))) continue;
        // mangahasu images needs to be downloaded.
        const covers:string[] = [];
        const coverLink = $('.wrapper_imgage img', el).attr('src');
        if(coverLink) {
          const img = await this.downloadImage(coverLink, undefined, false);
          if(img) covers.push(img.src);
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
    if(stopListening) stopListening();
  }
}


const mangahasu = new MangaHasu();
export default mangahasu;
