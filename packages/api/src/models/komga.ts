import Mirror from '@api/models';
import icon from '@api/models/icons/komga.png';
import type MirrorInterface from '@api/models/interfaces';
import type { MangaPage } from '@api/models/types/manga';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { ISO3166_1_ALPHA2_TO_ISO639_1, mirrorsLang } from '@i18n/index';

//  /series?search=word
type searchContent = {
  content: {
    id: string,
    metadata: {
      title: string,
      summary: string,
      language: string,
      genres: string[],
      tags: string[],
    },
    booksMetadata: {
      authors: string[],
      tags: string[],
    },
  }[]

}

// /series/{id}/books
type bookContent = {
  content: {
    created: string,
    deleted: boolean,
    id: string,
    media: {
      pagesCount: number,
    },
    metadata: {
      numberSort: number,
      releaseDate: null|string,
      title: string,
    },
    readProgress: null | {
      completed: boolean,
    },
  }[]
}
// /books/{id}
type book = {
  id: string,
  seriesId: string
  media: {
    pagesCount: number,
  },
}

class Komga extends Mirror<{login?: string|null, password?:string|null, host?:string|null, port?:number|null, protocol:'http'|'https', markAsRead: boolean}> implements MirrorInterface {
  constructor() {
    super({
      version: 1,
      host: 'http://localhost',
      name: 'komga',
      displayName: 'Komga',
      langs: mirrorsLang.map(x=>x), // makes mirrorsLang mutable
      waitTime: 100,
      icon,
      meta: {
        speed: 1,
        quality:1,
        popularity: 1,
      },
      options: {
        enabled: true,
        cache: true,
        login: null,
        password: null,
        host: null,
        port: null,
        protocol: 'http',
        markAsRead: true,
      },
    });
  }

  /** needs at least these three options to be enabled */
  public get enabled(): boolean {
    const { enabled, host, port, password, login} = this.options;
    if(enabled && host && port && password && login) return true;
    return false;
  }

  #path(path:string) {
    if(!this.options.protocol || !this.options.host || !this.options.port) throw new Error('missing credentials');
    return `${this.options.protocol}://${this.options.host}:${this.options.port}/api/v1${path}`;
  }

  isMangaPage(url: string): boolean {
    url = url.replace(/(\?.*)/g, ''); // remove hash/params from the url
    const res = /^(\/series\/\w+)|(\/book\/\w+)$/gmi.test(url);
    if(!res) this.logger('not a manga page:', url);
    return res;
  }
  isChapterPage(url: string): boolean {
    url = url.replace(/(\?.*)/g, ''); // remove hash/params from the url
    const res = /^(\/books\/\w+)|(\/book\/\w+\/read)$/gmi.test(url);
    if(!res) this.logger('not a chapter page:', url);
    return res;
  }

  async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|SchedulerClass, id:number) {
    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';
      // we will check if user don't need results anymore at different intervals
      let cancel = false;
      if(!(socket instanceof SchedulerClass)) {
        socket.once('stopSearchInMirrors', () => {
          this.logger('search canceled');
          this.stopListening(socket);
          cancel = true;
        });
      }

      const url = this.#path(`/series?search=${query}`);
      const res = await this.fetch<searchContent>({url, auth: {username: this.options.login, password: this.options.password}}, 'json');
      for(const result of res.content) {
        if(cancel) break;
        const name = result.metadata.title;
        const covers: string[] = [];
        const img = await this.downloadImage(this.#path(`/series/${result.id}/thumbnail`), 'cover', undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
        if(img) covers.push(img);

        const synopsis = result.metadata.summary;
        const books = await this.fetch<bookContent>({url: this.#path(`/series/${result.id}/books?sort=metadata.numberSort%2Cdesc`), auth: {username: this.options.login, password: this.options.password}}, 'json');
        const last_release = { chapter: books.content[0].metadata.numberSort, name: books.content[0].metadata.title };

        let lang = ISO3166_1_ALPHA2_TO_ISO639_1('xx');
        if(result.metadata.language && result.metadata.language.length) lang = ISO3166_1_ALPHA2_TO_ISO639_1(result.metadata.language);

        if(!langs.some(l => l === lang)) return;

        const mg = await this.searchResultsBuilder({
          id: result.id,
          name,
          url: `/series/${result.id}`,
          synopsis,
          covers,
          last_release,
          langs: [lang],
        });
        // we return the results based on SearchResult model
        if(!cancel) socket.emit('searchInMirrors', id, mg);
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while searching mangas', e);
      if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
      else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error'});
    }
    socket.emit('searchInMirrors', id, { done: true });
    return this.stopListening(socket);
  }

  async manga(url:string, langs:mirrorsLangsType[], socket:socketInstance|SchedulerClass, id:number)  {

    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowManga', () => {
        this.logger('fetching manga canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }
    const isMangaPage = this.isMangaPage(url);
    if(!isMangaPage) {
      socket.emit('showManga', id, {error: 'manga_error_invalid_link'});
      return this.stopListening(socket);
    }

    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';

      const result = await this.fetch<searchContent['content'][0]>({
        url: this.#path(`${url}`),
        auth: {username: this.options.login, password: this.options.password},
      }, 'json');
      const name = result.metadata.title;

      let lang = ISO3166_1_ALPHA2_TO_ISO639_1('xx');
      if(result.metadata.language && result.metadata.language.length) lang = ISO3166_1_ALPHA2_TO_ISO639_1(result.metadata.language);

      if(cancel) return;
      const covers:string[] = [];
      const img = await this.downloadImage(this.#path(`/series/${result.id}/thumbnail`), 'cover', undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
      if(img) covers.push(img);

      const synopsis = result.metadata.summary;
      const authors:string[] = result.booksMetadata.authors;
      const tags:string[] = [...result.booksMetadata.tags, ...result.metadata.genres];

      const chapters:MangaPage['chapters'] = [];

      const books = await this.fetch<bookContent>({url: this.#path(`/series/${result.id}/books?size=2000&sort=metadata.numberSort%2Cdesc`), auth: {username: this.options.login, password: this.options.password}}, 'json');
      for(const book of books.content) {
        let date:number = Date.now();
        if(book.created && book.created.length) date = new Date(book.created).getTime();
        if(book.metadata.releaseDate && book.metadata.releaseDate.length) date = new Date(book.metadata.releaseDate).getTime();
        if(cancel) break;
        const chaplink = `/books/${book.id}`; // chapter links aren't unique, so we use the book id
        const read = book.readProgress ? book.readProgress.completed : false;

        const release = await this.chaptersBuilder({
          id: book.id,
          name: book.metadata.title,
          lang,
          number: book.metadata.numberSort,
          url: chaplink,
          date: date,
          read,
        });

        chapters.push(release);
      }
      if(cancel) return;

      const mg = await this.mangaPageBuilder({
        id: result.id,
        url: `/series/${result.id}`,
        langs: [lang],
        name,
        synopsis,
        covers,
        authors,
        tags,
        chapters,
      });

      socket.emit('showManga', id, mg);
    } catch(e) {
      this.logger('error while fetching manga', '@', url, e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
      else socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
    return this.stopListening(socket);
  }

  async chapter(url:string, lang:mirrorsLangsType, socket:socketInstance|SchedulerClass, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowChapter', () => {
        this.logger('fetching chapter canceled');
        cancel = true;
      });
    }

    // safeguard, we return an error if the link is not a chapter page
    const isLinkaChapter = this.isChapterPage(url);
    if(!isLinkaChapter) {
      this.stopListening(socket);
      return socket.emit('showChapter', id, {error: 'chapter_error_invalid_link'});
    }

    if(cancel) return;

    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';
      const res = await this.fetch<book>({url: this.#path(url), auth: {username: this.options.login, password: this.options.password}}, 'json');
      const nbOfPages = res.media.pagesCount;
      if(callback) callback(nbOfPages);
      if(cancel) return;
      // loop for each page

      for(let i = 0; i < nbOfPages; i++) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;
        // URL de la demande: https://demo.komga.org/api/v1/books/64/pages/35
        const img = await this.downloadImage(this.#path(`/books/${res.id}/pages/${i+1}`), 'page', undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
        if(img) {
          if(!cancel) socket.emit('showChapter', id, { index: i, src: img, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
        } else {
          if(!cancel) socket.emit('showChapter', id, { error: 'chapter_error_fetch', index: i, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
        }
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

  async recommend(socket: socketInstance|SchedulerClass, id: number) {
    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';
      // we will check if user don't need results anymore at different intervals
      let cancel = false;
      if(!(socket instanceof SchedulerClass)) {
        socket.once('stopShowRecommend', () => {
          this.logger('fetching recommendations canceled');
          cancel = true;
        });
      }
      const url = this.#path('/series?size=2000');
      const $ = await this.fetch<searchContent>({
        url,
        auth: {username: this.options.login, password: this.options.password},
      }, 'json');

      for(const serie of $.content) {
        if(cancel) break;

        const covers: string[] = [];
        const img = await this.downloadImage(this.#path(`/series/${serie.id}/thumbnail`), 'cover', undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
        if(img) covers.push(img);

        let lang = ISO3166_1_ALPHA2_TO_ISO639_1('xx');
        if(serie.metadata.language && serie.metadata.language.length) lang = ISO3166_1_ALPHA2_TO_ISO639_1(serie.metadata.language);

        const mg = await this.searchResultsBuilder({
          id: serie.id,
          url: `/series/${serie.id}`,
          name: serie.metadata.title,
          covers,
          langs: [lang],
        });

        socket.emit('showRecommend', id, mg);
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

  async mangaFromChapterURL(socket: socketInstance, id: number, url: string, lang?: mirrorsLangsType) {
    url = url.replace(/(\?.*)/g, ''); // remove hash/params from the url
    url = url.replace(this.host, ''); // remove the host from the url
    url = url.replace(/\/$/, ''); // remove trailing slash
    if(this.options.host && this.options.port && this.options.protocol) {
      url = url.replace(this.options.host, '');
      url = url.replace(':'+this.options.port.toString(), '');
      url = url.replace(/http(s?):\/\//, '');
    }
    // if no lang is provided, we will use the default one
    lang = lang||this.langs[0];
    // checking what kind of page this is
    const isMangaPage = this.isMangaPage(url),
          isChapterPage = this.isChapterPage(url);

    if(!isMangaPage && !isChapterPage) {
      socket.emit('getMangaURLfromChapterURL', id, undefined);
      return this.stopListening(socket);
    }
    if(isMangaPage || isChapterPage) {
      try {
        if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
        if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';
        url = url.replace('/read', '');
        url = url.replace(/book(s?)/, 'books');
        const match = url.match(/\/series\/(\w+)/);
        let mangaPageURL = '/series/';
        if(match) {
          mangaPageURL += match[1];
        } else {
          const res = await this.fetch<book>({url: this.#path(url), auth: {username: this.options.login, password: this.options.password}}, 'json');
          mangaPageURL += res.seriesId;
        }
        if(mangaPageURL) return socket.emit('getMangaURLfromChapterURL', id, { url: mangaPageURL, langs: [lang], mirror: {name: this.name, version: this.version} });
        return socket.emit('getMangaURLfromChapterURL', id, undefined);
      } catch(e) {
        if(e instanceof Error) this.logger('error while fetching manga from chapter url', e.message);
        else this.logger('error while fetching manga from chapter url', e);
        return socket.emit('getMangaURLfromChapterURL', id, undefined);
      }
    }
  }

  async markAsRead(mangaURL:string, lang:mirrorsLangsType, chapterURLs:string[], read:boolean) {
    if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) return;
    if(!this.options.login.length || !this.options.password.length || !this.options.host.length) return;
    if(!mangaURL.length || !lang.length || !chapterURLs.length) return;
    if(!this.options.markAsRead) return;

    for(const chapterUrl of chapterURLs) {
      try {
        const payload = read ? { completed: true } : { completed: false, page: 1 };
        await this.post(this.#path(chapterUrl+'/read-progress'), payload, 'patch', {auth: {username: this.options.login, password: this.options.password}});
      } catch(e) {
        if(e instanceof Error) this.logger('markAsRead:', e.message);
        else this.logger('markAsRead:', e);
      }
    }
  }
}


const komga = new Komga();
export default komga;
