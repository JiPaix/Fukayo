import type { MangaPage } from './types/manga';
import Mirror from './model';
import type { ChapterPage } from './types/chapter';
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

  async manga(link:string, lang:string, socket:socketInstance, id:number) {
    // link = relative url
    // url = full url (hostname+path)
    const url = `${this.host}${link}`;

    // safeguard, we return an error if the link is not a manga page
    const isLinkaPage = this.isMangaPage(link);
    if(!isLinkaPage) {
      return socket.emit('showManga', id, {error: 'manga_error_invalid_link'});
    }

    // manga id = "mirror_name/lang/link-of-manga-page"
    const mangaId = `${this.name}/${this.langs[0]}${link}`;

    try {
      const $ = await this.fetch({
        url,
        cookies: [{name: 'isAdult', value: '1', path: '/', domain: 'fanfox.net'}],
        waitForSelector: 'ul.detail-main-list > li > a',
      });

      // title of manga
      const name = $('span.detail-info-right-title-font').text().trim();
      // synopsis
      const synopsis = $('p.fullcontent').text().trim(); // optional

      // covers (some mirror have multiple covers, not fanfox though)
      const covers:string[] = [];
      const coverLink =  $('img.detail-info-cover-img').attr('src');
      if(coverLink) {
        // mangafox images needs to be downloaded (you can't just link the external url due to cors).
        const img = await this.downloadImage(coverLink).catch(() => undefined);
        if(img) covers.push(img);
      }

      // authors and tags
      const authors:string[] = [];
      const tags:string[] = [];

      $('p.detail-info-right-say > a').each((i, el) => {
        const author = $(el).text().toLocaleLowerCase().trim();
        if(author.length) authors.push(author);
      });

      $('p.detail-info-right-tag-list > a').each((i, el) => {
        const tag = $(el).text().toLocaleLowerCase().trim();
        if(tag.length) tags.push(tag);
      });

      // chapters table
      const chapters:MangaPage['chapters'] = [];
      const tablesize = $('ul.detail-main-list > li > a').length;
      $('ul.detail-main-list > li > a').each((i, el) => {
        // making sure the link match the pattern we're expecting
        const chapterHref = $(el).attr('href');
        if(!chapterHref || !this.isChapterPage(chapterHref)) return;

        // a regex that help us get the volume, chapter number and chapter name
        const match = this.getChapterInfoFromString($('.detail-main-list-main > p.title3', el).text());
        if(!match || typeof match !== 'object') return;
        // getting capture groups
        const [, , volumeNumber, chapterNumber, , , , chapterName] = match;

        // parsing the values
        const volumeNumberInt = volumeNumber ? parseInt(volumeNumber) : undefined; // if no volume number is given, we set it to undefined
        const chapterNumberFloat = chapterNumber ? parseFloat(chapterNumber) : tablesize-i; // if no chapter number is found we fallback to the position in the table
        const chapterNameTrim = chapterName ? chapterName.trim() : undefined; // if no chapter name is given, we set it to undefined
        const chapterUrl = chapterHref.trim();

        // ensure we at least have a chapter number OR a chapter name
        if(!chapterNameTrim && !chapterNumberFloat) return;

        // dates in manga pages aren't reliable so we use the fetch date instead
        const date = Date.now();

        // pushing the chapter to the chapters array
        chapters.push({
          name: chapterNameTrim,
          number: chapterNumberFloat,
          volume: volumeNumberInt,
          url: chapterUrl,
          date,
        });

      });

      // returning the manga page based on MangaPage model
      return socket.emit('showManga', id, {id: mangaId, url: link, lang: this.langs[0], mirrorInfo: this.mirrorInfo, name, synopsis, covers, authors, tags, chapters });

    } catch(e) {
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) return socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      if(typeof e === 'string') return socket.emit('showManga', id, {error: 'manga_error', trace: e});
      console.log('[api]', 'mangafox error', e);
      return socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
  }

  async chapter(link: string):Promise<(ChapterPage|ChapterPageErrorMessage)[]> {
    throw Error('not impt');
  }

  async retryChapterImage(link: string, index:number): Promise<ChapterPage | ChapterPageErrorMessage> {
    throw Error('not impt');
  }
}

const mangafox = new Mangafox();
export default mangafox;
