import type { MangaPage } from './types/manga';
import type { ChapterErrorMessage, ChapterPageErrorMessage, MangaErrorMessage } from './types/errorMessages';
import Mirror from './model';
import type { ChapterPage } from './types/chapter';
import { isCrawlerError } from './model/crawler';
import icon from './icons/mangafox.png';
import type MirrorInterface from './model/types/index';
import type { socketInstance } from '../routes';
class Mangafox extends Mirror implements MirrorInterface {

  options: { adult: boolean };

  constructor() {
    super({
      host: 'https://fanfox.net',
      name: 'mangafox',
      displayName: 'Mangafox',
      enabled: true,
      langs: ['en'],
      icon,
    });

    this.options = { adult: true };
  }

  isMangaPage(str:string) {
    return /^\/manga\/\w+(\/)?$/gmi.test(str);
  }
  isChapterPage(str:string) {
    return /\/manga\/\w+(\/v\d+)?\/c\d+\/\d+\.html$/gmi.test(str);
  }

  getChapterInfoFromString(str:string) {
    return /^(Vol\.(.+)\s)?Ch\.([0-9]+(\.)?([0-9]+)?)(\s-\s(.*))?$/gmi.exec(str);
  }

  async search(query:string, socket: socketInstance, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    socket.once('stopSearchInMirrors', () => {
      console.log('[api]', 'search canceled');
      cancel = true;
    });

    const url = `${this.host}/search?page=1&title=${query}`;
    if(cancel) return; //=> 1st cancel check before request
    try {
      const $ = await this.fetch({
        url,
        cookies: [{name: 'isAdult', value: '1', path: '/', domain: 'fanfox.net'}],
        waitForSelector: 'ul.manga-list-4-list > li',
      });


      // we loop through the search results
      for(const el of $('ul.manga-list-4-list > li')) {
        if(cancel) break; //=> 2nd cancel check, break out of loop
        const name = $('p.manga-list-4-item-title', el).text().trim();
        const link = $('p.manga-list-4-item-title > a', el).attr('href');
        const isMangaLink = this.isMangaPage(link||'');
        // safeguard
        if(!link || !isMangaLink || !name) continue;

        // mangafox images needs to be downloaded.
        const covers:string[] = [];
        const coverLink =  $('img.manga-list-4-cover', el).attr('src');
        if(coverLink) {
          const img = await this.downloadImage(coverLink).catch(() => undefined);
          if(img) covers.push(img);
        }


        const last_chapter = $('p.manga-list-4-item-tip', el).filter((i,e) => $(e).text().trim().indexOf('Latest Chapter:') > -1).text().replace('Latest Chapter:', '').trim();
        let synopsis:string|undefined = $('p.manga-list-4-item-tip:last-of-type', el).text().trim();
        if(synopsis && synopsis.length === 0) synopsis = undefined;
        // check if we can get any info regarding the last chapter
        const match = this.getChapterInfoFromString(last_chapter);
        let last_release;
        if(match && typeof match === 'object') {
          const [, , volumeNumber, chapterNumber, , , , chapterName] = match;
          last_release = {
            name: chapterName ? chapterName.trim() : undefined,
            volume: volumeNumber && !isNaN(parseInt(volumeNumber)) ? parseInt(volumeNumber) : undefined,
            chapter: chapterNumber ? parseFloat(chapterNumber) : 0,
          };
        }

        // manga id = "mirror_name/lang/link-of-manga-page"
        const mangaId = `${this.name}/${this.langs[0]}${link.replace(this.host, '')}`;

        // we return the results based on SearchResult model
        socket.emit('searchInMirrors', id, {
          id: mangaId,
          mirrorinfo: this.mirrorInfo,
          name,
          link,
          covers,
          synopsis,
          last_release,
          lang: 'en',
        });
      }
      if(cancel) return; // 3rd obligatory check
    } catch(e) {
        // we catch any errors because the client needs to be able to handle them
        if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
        else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
        else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error' });
    }
    socket.emit('searchInMirrors', id, { done: true });
  }

  async manga(link:string): Promise<MangaPage | MangaErrorMessage> {
    const url = `${this.host}${link}`;
    const isLinkaPage = this.isMangaPage(url);

    // safeguard, we return an error if the link is not a manga page
    if(!isLinkaPage) return {error: 'manga_error_invalid_link'};

    try {
      const $ = await this.fetch({
        url,
        cookies: [{name: 'isAdult', value: '1', path: '/', domain: 'fanfox.net'}],
        waitForSelector: 'ul.detail-main-list > li > a',
      });

      const name = $('span.detail-info-right-title-font').text().trim();
      const synopsis = $('p.fullcontent').text().trim();

      const chapters:MangaPage['chapters'] = [];
      const covers:string[] = [];

      // looping through the chapters
      $('ul.detail-main-list > li > a').each((i, el) => {

        // making sure we have a valid link
        const chapterHref = $(el).attr('href');
        if(!chapterHref || !this.isChapterPage(chapterHref)) return;
        // this regex make sure we at least have a valid chapter number
        const match = this.getChapterInfoFromString($('.detail-main-list-main > p.title3', el).text());
        if(!match || typeof match !== 'object') return;
        // getting capture groups
        const [, , volumeNumber, chapterNumber, , , , chapterName] = match;

        // parsing the values
        const volumeNumberInt = volumeNumber ? parseInt(volumeNumber) : undefined; // if no volume number is given, we set it to undefined
        const chapterNumberFloat = parseFloat(chapterNumber);
        const chapterNameTrim = chapterName ? chapterName.trim() : undefined; // if no chapter name is given, we set it to undefined
        const chapterUrl = chapterHref.trim();

        // pushing the chapter to the chapters array
        chapters.push({
          name: chapterNameTrim,
          number: chapterNumberFloat,
          volume: volumeNumberInt,
          link: chapterUrl,
        });

      });

      // looping through the covers and pushing them to the covers array
      $('img.detail-info-cover-img').each((i, el) => {
        const cover = $(el).attr('src');
        if(cover) covers.push(cover);
      });

      // returning the manga page based on MangaPage model
      return {langs: this.langs, mirror: this.name, name, synopsis, covers, chapters };

    } catch(e) {
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) return {error: 'manga_error', trace: e.message};
      if(typeof e === 'string') return {error: 'manga_error', trace: e};
      return {error: 'manga_error_unknown'};
    }
  }

  async chapter(link: string): Promise<(ChapterPage|ChapterPageErrorMessage)[] | ChapterErrorMessage> {
    const current_url = `${this.host}${link}`;
    const isLinkaChapter = this.isChapterPage(current_url);

    // safeguard, we return an error if the link is not a chapter page
    if(!isLinkaChapter) return {error: 'chapter_error_invalid_link'};


    try {
      // We make a first request using Axios to get the number of pages (faster)
      const response = await this.fetch({url:current_url});
      const µ = this.loadHTML(response.data);

      // @see AMR.getVariableFromScript()
      const count = this.getVariableFromScript<number|undefined>('imagecount', µ.html());
      if(!count) return {error: 'chapter_error_no_pages'};

      // we made a request using https://mangafox/manga/one_piece/v01/c001/1.html
      // so we generate a link for each page
      const urls = [...Array(count).keys()].map(i => {
        return current_url.replace(/\/\d+\.html$/, `/${i + 1}.html`);
      });

      // preparing the results
      const images:(ChapterPage|ChapterPageErrorMessage)[] = [];

      // We use puppeteer to make the requests
      const res = await this.crawler({urls, waitForSelector: 'img.reader-main-img:not([src*=loading\\.gif])', waitTime: this.waitTime});

      // looping through the chapter pages
      // for any response (failed or succeded) we must also return the page index
      res.forEach(r => {
        // if puppeteer failed to load the page, we return an error in the images array
        if(isCrawlerError(r)) return images.push({error: 'chapter_error_fetch', trace: r.error, url: r.url.replace(this.host, ''), index: r.index});

        // loading the HTML and getting the image url
        const $ = this.loadHTML(r.data);
        const src = $('img.reader-main-img').attr('src');
        // if we don't have a valid image url, we return an error in the images array.
        if(!src) return images.push({error: 'chapter_error_no_image', url: r.url.replace(this.host, ''), index: r.index});
        images.push({index: r.index, src});
      });
      // we return the images based on ChapterPage model and sort them by index
      return images.sort((a, b) => a.index - b.index);

    } catch(e) {
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) return {error: 'chapter_error', trace: e.message};
      if(typeof e === 'string') return {error: 'chapter_error', trace: e};
      return {error: 'chapter_error_unknown'};
    }
  }

  public async retryChapterImage(link: string, index:number): Promise<ChapterPage | ChapterPageErrorMessage> {
    const current_url = `${this.host}${link}`;
    const isLinkaChapter = this.isChapterPage(current_url);

    // safeguard, we return an error if the link is not a chapter page
    if(!isLinkaChapter) return {error: 'chapter_error_invalid_link', index};

    // for any response (failed or succeded) we must also return the page index
    // compared to the chapter method, the request will return a "wrong" index.
    // so we must ALWAYS use the index parameter from this method
    try {
      // We are directly making the request using puppeteer
      const res = await this.crawler({urls: [current_url], waitForSelector: 'img.reader-main-img', waitTime: this.waitTime});
      // if puppeteer failed to load the page, we return an error in the images array
      if(isCrawlerError(res[0])) return {error: 'chapter_error_fetch', trace: res[0].error, url: current_url.replace(this.host, ''), index};

      // loading the HTML and getting the image url
      const $ = this.loadHTML(res[0].data);
      const src = $('img.reader-main-img').attr('src');

      // if we don't have a valid image url, we return an error. (no array this time)
      if(!src) return {error: 'chapter_error_no_image', url: current_url.replace(this.host, ''), index};
      return {index, src};
    } catch(e) {
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) return {error: 'chapter_error', trace: e.message, index};
      if(typeof e === 'string') return {error: 'chapter_error', trace: e, index};
      return {error: 'chapter_error_unknown', src: current_url.replace(this.host, ''), index};
    }
  }
}

const mangafox = new Mangafox();
export default mangafox;
