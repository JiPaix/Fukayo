import { SelfHosted } from '@api/models/abstracts/selfhosted';
import icon from '@api/models/icons/komga.png';
import Importer from '@api/models/imports/abstracts';
import type { ImportResults } from '@api/models/imports/types';
import type MirrorInterface from '@api/models/interfaces';
import type { importErrorMessage } from '@api/models/types/errors';
import type { MangaPage } from '@api/models/types/manga';
import type { SearchResult } from '@api/models/types/search';
import Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';
import { BC47_TO_ISO639_1, mirrorsLang } from '@i18n';

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
      status: 'ENDED' | 'ONGOING' | 'HIATUS' | 'ABANDONED'
    },
    booksMetadata: {
      authors: {name: string, role: string}[],
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

type claim = {
  isClaimed: boolean
}

type violation = {
  fieldName: string
  message: string
}

class Komga extends SelfHosted implements MirrorInterface {
  #logged = false;
  constructor() {
    super({
      version: 1,
      isDead: false,
      host: 'http://127.0.0.1',
      name: 'komga',
      displayName: 'Komga',
      langs: mirrorsLang.map(x=>x), // makes mirrorsLang mutable
      entryLanguageHasItsOwnURL: true,
      credentialsRequired: true,
      requestLimits: {
        time: 10,
        concurrent: 5,
      },
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

  get enabled():boolean {
    return this.#logged && super.enabled;
  }

  set enabled(val: boolean) {
    this.options.enabled = val;
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

  public get loggedIn():boolean {
    const { login, password } = this.options;
    if(!login || !password) return false;
    return this.#logged;
  }

  async login(socket?: socketInstance) {
    try {
      const { login, password } = this.options;
      if(!login || !password) {
        this.logger('no credentials');
        if(socket) socket.emit('loggedIn', this.name, false);
        this.#logged = false;
        return false;
      }
      const data = await this.fetch<claim | violation[]>({ url: this.#path('/claim'), auth: { username: login, password } }, 'json');
      if(!data || (data as violation[]).length || !(data as claim).isClaimed) {
        this.logger('not logged in:', data);
        if(socket) socket.emit('loggedIn', this.name, false);
        this.#logged = true;
        return false;
      }

      if(socket) socket.emit('loggedIn', this.name, true);
      this.#logged = true;
      this.logger('is logged-in');
      return true;
    } catch(e) {
      this.logger('not logged in', e);
      if(socket) socket.emit('loggedIn', this.name, false);
      this.#logged = true;
      return false;
    }
  }

  async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|Scheduler|Importer, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler) && !(socket instanceof Importer)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopSearchInMirrors', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopSearchInMirrors', stopListening);
      socket.once('disconnect', stopListening);
    }

    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';

      const url = this.#path(`/series?search=${query}`);
      const res = await this.fetch<searchContent>({url, auth: {username: this.options.login, password: this.options.password}}, 'json');

      const result = res.content.reduce((resultArray:typeof res.content[], item, index) => {
        const chunkIndex = Math.floor(index / 100);
        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = [];
        }
        resultArray[chunkIndex].push(item);
        return resultArray;
      }, []);

      await Promise.all(result.map(async res => {
        const mangaList = (await Promise.all(res.map(async manga => {
          if (cancel) return;
          if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) return;
          if(!this.options.login.length || !this.options.password.length || !this.options.host.length) return;
          if (!manga.metadata.title.toLowerCase().includes(query.toLowerCase())) return;

          let lang = 'xx' as mirrorsLangsType;
          if(manga.metadata.language && manga.metadata.language.length) lang = BC47_TO_ISO639_1(manga.metadata.language);
          const covers: string[] = [];

          const img = await this.downloadImage(this.#path(`/series/${manga.id}/thumbnail`), undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
          if (img) covers.push(img.src);

          if (cancel) return;
          const mg = await this.searchResultsBuilder({
            id: manga.id,
            url: `/series/${manga.id}`,
            name: manga.metadata.title,
            covers,
            langs: [lang],
          });
          return mg;
        }))).filter(ele => ele !== undefined) as SearchResult[];
        if (cancel) return;
        if (!cancel) socket.emit('searchInMirrors', id, mangaList);
      }));
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

  async manga(url:string, langs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number)  {
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

    const isMangaPage = this.isMangaPage(url);
    if(!isMangaPage) {
      socket.emit('showManga', id, {error: 'manga_error_invalid_link'});
      if(stopListening) return stopListening();
      return;
    }

    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';

      const result = await this.fetch<searchContent['content'][0]>({
        url: this.#path(`${url}`),
        auth: {username: this.options.login, password: this.options.password},
      }, 'json');
      const name = result.metadata.title;

      let lang = 'xx' as mirrorsLangsType;
      if(result.metadata.language && result.metadata.language.length) lang = BC47_TO_ISO639_1(result.metadata.language);

      if(cancel) return;
      const covers:string[] = [];
      const img = await this.downloadImage(this.#path(`/series/${result.id}/thumbnail`), undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
      if(img) covers.push(img.src);

      let status:MangaPage['status'] = 'unknown';
      if(result.metadata.status === 'ABANDONED') status = 'cancelled';
      else if (result.metadata.status === 'ONGOING') status = 'ongoing';
      else if(result.metadata.status === 'ENDED') status = 'completed';
      else if(result.metadata.status === 'HIATUS') status = 'hiatus';
      else status = 'unknown';

      const synopsis = result.metadata.summary;
      const authors:string[] = result.booksMetadata.authors.map(x => x.name);
      const tags:string[] = [...result.booksMetadata.tags, ...result.metadata.genres, ...result.metadata.tags];

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
        status,
      });
      if(cancel) return;
      socket.emit('showManga', id, mg);
    } catch(e) {
      this.logger('error while fetching manga', '@', url, e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
      else socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
    if(stopListening) stopListening();
  }

  async   chapter(url:string, lang:mirrorsLangsType, socket:socketInstance|Scheduler, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number) {
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

    // safeguard, we return an error if the link is not a chapter page
    const isLinkaChapter = this.isChapterPage(url);
    if(!isLinkaChapter) {
      socket.emit('showChapter', id, {error: 'chapter_error_invalid_link'});
      if(stopListening) return stopListening();
      return;
    }

    if(cancel) return;

    try {
      if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'no credentials';
      const res = await this.fetch<book>({url: this.#path(url), auth: {username: this.options.login, password: this.options.password}}, 'json');
      const nbOfPages = res.media.pagesCount;
      if(callback) callback(nbOfPages);
      if(cancel) return;

      if(nbOfPages < 1) {
        socket.emit('showChapter', id, { error: 'chapter_error_no_pages' });
        if(stopListening) stopListening();
        return;
      }

      // loop for each page

      for(let i = 0; i < nbOfPages; i++) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;
        // URL de la demande: https://demo.komga.org/api/v1/books/64/pages/35
        const img = await this.downloadImage(this.#path(`/books/${res.id}/pages/${i+1}`), undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
        if(img) {
          if(!cancel) socket.emit('showChapter', id, { index: i, src: img.src, height: img.height, width: img.width, lastpage:i+1 === nbOfPages });
        } else {
          if(!cancel) socket.emit('showChapter', id, { error: 'chapter_error_fetch', index: i, lastpage:i+1 === nbOfPages });
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
    if(stopListening) stopListening();
  }

  async recommend(requestLangs:mirrorsLangsType[], socket: socketInstance|Scheduler, id: number) {
    socket.emit('showRecommend', id, { mirror: this.name, error: 'recommend_error', trace: 'selfhosted mirror'});
    // self hosted don't need recommendations
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

  async getLists(): Promise<importErrorMessage | searchContent['content']> {
      try {
        if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) return {error: 'import_error', trace: 'unauthorized'};
        if(!this.options.login.length || !this.options.password.length || !this.options.host.length) return {error: 'import_error', trace: 'unauthorized'};
        // we will check if user don't need results anymore at different intervals
        const url = this.#path('/series?size=20000');
        const $ = await this.fetch<searchContent>({
          url,
          auth: {username: this.options.login, password: this.options.password},
        }, 'json');
        return $.content;
      } catch(e) {
        this.logger('error while importing mangas', e);
        if(e instanceof Error) return {error: 'import_error', trace: e.message};
        else if(typeof e === 'string') return {error: 'import_error', trace: e};
        else return { error: 'import_error' };
      }
    }

    async getMangasToImport(id:number, socket:socketInstance, langs: mirrorsLangsType[], inputArray:searchContent['content']) {
      // we will check if user don't need results anymore at different intervals
      let cancel = false;
      let stopListening: (() => void) | undefined = undefined;
      if(!(socket instanceof Scheduler)) {
        stopListening = () => {
          cancel = true;
          socket.removeListener('stopShowImports', stopListening as () => void);
          socket.removeListener('disconnect', stopListening as () => void);
        };
        socket.once('stopShowImports', stopListening);
        socket.once('disconnect', stopListening);
      }
      try {
        if(!this.options.login || !this.options.password || !this.options.host || !this.options.port) throw 'unauthorized';
        if(!this.options.login.length || !this.options.password.length || !this.options.host.length) throw 'unauthorized';

        for(const manga of inputArray) {
          if(cancel) break;
          const covers:string[] = [];
          const img = await this.downloadImage(this.#path(`/series/${manga.id}/thumbnail`), undefined, false, {auth: { username: this.options.login, password: this.options.password}} ).catch(() => undefined);
          let lang = 'xx' as mirrorsLangsType;
          if(manga.metadata.language && manga.metadata.language.length) lang = BC47_TO_ISO639_1(manga.metadata.language);
          if(img) covers.push(img.src);
          const res:ImportResults = {
            mirror: { name: this.name, langs: this.langs },
            name: manga.metadata.title,
            langs: [lang],
            url: `/series/${manga.id}`,
            covers,
            inLibrary: false,
          };
          if(!cancel) socket.emit('showImports', id, res);
        }
        if(cancel) return;
        socket.emit('showImports', id, { done: true });
      } catch(e) {
        this.logger('error while importing mangas', e);
        if (e instanceof Error) socket.emit('showImports', id, { error: 'import_error', trace: e.message });
        else if (typeof e === 'string') socket.emit('showImports', id, { error: 'import_error', trace: e });
        else socket.emit('showImports', id, {error: 'import_error' });
      }
      if(stopListening) stopListening();
    }
  }



const komga = new Komga();
export default komga;
