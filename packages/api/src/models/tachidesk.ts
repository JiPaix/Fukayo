import Mirror from '@api/models';
import icon from '@api/models/icons/tachidesk.png';
import type MirrorInterface from '@api/models/interfaces';
import type { MangaPage } from '@api/models/types/manga';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { ISO3166_1_ALPHA2_TO_ISO639_1, mirrorsLang } from '@i18n/index';
import fd from 'form-data';

type CategoryList = {
  default: boolean;
  id: number
  name: string
  order: number
}

type CategoryManga = {
  id: number,
  artist: string
  author: string
  description: string
  thumbnailUrl: string
  title: string
  sourceId: string
  url: string
}

type Source = {
  id: string
  lang: string
}

type Manga = {
  id: number,
  sourceId: number,
  title: string,
  thumbnailUrl: string,
  artist: string,
  author: string,
  description: string,
  genre: string[],
}

type Chapter = {
  url: string,
  name: string,
  uploadDate: number,
  chapterNumber: number,
  scanlator?: string|null ,
  mangaId: number,
  read: boolean,
  index: number,
  fetchedAt: number,
  pageCount: number,
}

export class Tachidesk extends Mirror<{login?: string|null, password?:string|null, host?:string|null, port?:number|null, protocol:'http'|'https', markAsRead: boolean}> implements MirrorInterface {
  constructor() {
    super({
      version: 1,
      host: 'http://localhost',
      name: 'tachidesk',
      displayName: 'Tachidesk',
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
  get enabled(): boolean {
    const { enabled, host, port } = this.options;
    if(enabled && host && port) return true;
    return false;
  }

  set enabled(val: boolean) {
    this.options.enabled = val;
  }

  #path(path:string) {
    if(!this.options.protocol || !this.options.host || !this.options.port) throw new Error('missing credentials');
    if(this.options.login && this.options.password) return `${this.options.protocol}://${this.options.login}:${this.options.password}@${this.options.host}:${this.options.port}/api/v1${path}`;
    return `${this.options.protocol}://${this.options.host}:${this.options.port}/api/v1${path}`;
  }

  isMangaPage(url: string): boolean {
    url = url.replace(/(\?.*)/g, ''); // remove hash/params from the url
    const res = /^\/manga\/\w+(\/?)$/gmi.test(url);
    if(!res) this.logger('not a manga page:', url);
    return res;
  }
  isChapterPage(url: string): boolean {
    url = url.replace(/(\?.*)/g, ''); // remove hash/params from the url
    const res = /^\/manga\/\w+\/chapter\/\w+$/gmi.test(url);
    if(!res) this.logger('not a chapter page:', url);
    return res;
  }

  async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|SchedulerClass, id:number) {
    try {
      if(!this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.host.length) throw 'no credentials';
      // we will check if user don't need results anymore at different intervals
      let cancel = false;
      if(!(socket instanceof SchedulerClass)) {
        socket.once('stopSearchInMirrors', () => {
          this.logger('search canceled');
          this.stopListening(socket);
          cancel = true;
        });
      }

      const catUrl = this.#path('/category');
      const categories = await this.fetch<CategoryList[]>({
        url: catUrl,
        withCredentials: true,
      }, 'json');

      for(const cat of categories) {
        if(cancel) break;
        const res = await this.fetch<CategoryManga[]>({
          url: this.#path(`/category/${cat.id}`),
          withCredentials: true,
        }, 'json');

        for(const manga of res) {
          if(cancel) break;
          if(!manga.title.toLowerCase().includes(query.toLowerCase())) continue;
          const lang = ISO3166_1_ALPHA2_TO_ISO639_1((await this.fetch<Source>({
            url: this.#path(`/source/${manga.sourceId}`),
          }, 'json')).lang);

          const covers: string[] = [];
          const img = await this.downloadImage(this.#path(manga.thumbnailUrl.replace('/api/v1', '')), 'cover', undefined, false, { withCredentials: true });
          if(img) covers.push(img);


          const chapters = await this.fetch<Chapter[]>({
            url:this.#path(`/manga/${manga.id}/chapters`),
            withCredentials: true,
          }, 'json');

          // find the chapter with the highest chapterNumber
          const chapter = chapters.reduce((a, b) => a.chapterNumber > b.chapterNumber ? a : b);

          if(!cancel) socket.emit('searchInMirrors', id, {
            id: this.uuidv5({ langs, url: `/manga/${manga.id}` }),
            mirrorinfo: this.mirrorInfo,
            name: manga.title,
            url:`/manga/${manga.id}`,
            covers,
            last_release: {
              name: chapter.name,
              chapter: chapter.chapterNumber,
            },
            synopsis: manga.description,
            langs: [lang],
            inLibrary: await this.isInLibrary(this.mirrorInfo.name, [lang], manga.url) ? true : false,
          });
        }
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
      if(!this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.host.length) throw 'no credentials';
      const manga = await this.fetch<Manga>({
        url: this.#path(url),
        withCredentials: true,
      }, 'json');

      if(cancel) return;

      const lang = ISO3166_1_ALPHA2_TO_ISO639_1((await this.fetch<Source>({
        url: this.#path(`/source/${manga.sourceId}`),
      }, 'json')).lang);

      const covers: string[] = [];
      const img = await this.downloadImage(this.#path(manga.thumbnailUrl.replace('/api/v1', '')), 'cover', undefined, false, { withCredentials: true });
      if(img) covers.push(img);
      const synopsis = manga.description;
      const authors = (manga.author + (manga.author.length ? ', ' : '') + manga.artist).split(',').map(a => a.trim());
      const tags = manga.genre;

      const chapters:MangaPage['chapters'] = [];

      const chaptersRes = await this.fetch<Chapter[]>({
        url: this.#path(`/manga/${manga.id}/chapters`),
        withCredentials: true,
      }, 'json');

      for(const chapter of chaptersRes) {

        if(cancel) break;
        const chapLink = `/manga/${manga.id}/chapter/${chapter.index}`;
        let date: number= Date.now();
        if(chapter.uploadDate) date = chapter.uploadDate;
        const read = chapter.read;
        const number = chapter.chapterNumber;
        const name = chapter.name;
        const group = chapter.scanlator || undefined;
        chapters.push({
          id: this.uuidv5({ langs, url: chapLink }),
          url: chapLink,
          name,
          number,
          date,
          read,
          group,
          lang,
        });
      }

      if(!cancel) socket.emit('showManga', id, {
        id: this.uuidv5({ langs, url:`/manga/${manga.id}` }),
        mirror: {name: this.name, version: this.version },
        name: manga.title,
        url: `/manga/${manga.id}`,
        covers,
        authors,
        tags,
        synopsis,
        langs,
        chapters: chapters.sort((a,b) => a.number - b.number),
        inLibrary: false,
        categories: [],
      });
      if(cancel) return;
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
    // // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowChapter', () => {
        this.logger('fetching chapter canceled');
        this.stopListening(socket);
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
      if(!this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.host.length) throw 'no credentials';

      const res = await this.fetch<Chapter>({
        url: this.#path(url),
        withCredentials: true,
      }, 'json');
      const nbOfPages = res.pageCount;
      if(callback) callback(nbOfPages);
      if(cancel) return;
      for(let i = 0; i < nbOfPages; i++) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;

        const img = await this.downloadImage(this.#path(url+'/page/'+i), 'page', undefined, false, { withCredentials: true });

        if(img) {
          socket.emit('showChapter', id, { index: i, src: img, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
        } else {
          socket.emit('showChapter', id, { error: 'chapter_error_fetch', index: i, lastpage: typeof retryIndex === 'number' ? true : i+1 === nbOfPages });
        }
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching chapter', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showChapter', id, {error: 'chapter_error', trace: e.message});
      else if(typeof e === 'string') return socket.emit('showChapter', id, {error: 'chapter_error', trace: e});
      else socket.emit('showChapter', id, {error: 'chapter_error_unknown'});
    }
    return this.stopListening(socket);
  }

  async recommend(socket: socketInstance|SchedulerClass, id: number) {
    try {
      if(!this.options.host || !this.options.port) throw 'no credentials';
      if(!this.options.host.length) throw 'no credentials';
      // we will check if user don't need results anymore at different intervals
      let cancel = false;
      if(!(socket instanceof SchedulerClass)) {
        socket.once('stopShowRecommend', () => {
          this.logger('fetching recommendations canceled');
          this.stopListening(socket);
          cancel = true;
        });
      }

      const catUrl = this.#path('/category');
      const categories = await this.fetch<CategoryList[]>({
        url: catUrl,
        withCredentials: true,
      }, 'json');

      for(const cat of categories) {
        if(cancel) break;
        const res = await this.fetch<CategoryManga[]>({
          url: this.#path(`/category/${cat.id}`),
          withCredentials: true,
        }, 'json');

        for(const manga of res) {
          if(cancel) break;
          const lang = ISO3166_1_ALPHA2_TO_ISO639_1((await this.fetch<Source>({
            url: this.#path(`/source/${manga.sourceId}`),
          }, 'json')).lang);

          const covers: string[] = [];
          const img = await this.downloadImage(this.#path(manga.thumbnailUrl.replace('/api/v1', '')), 'cover', undefined, false, { withCredentials: true });
          if(img) covers.push(img);
          if(!cancel) socket.emit('showRecommend', id, {
            id: this.uuidv5({ langs: [lang], url:`/manga/${manga.id}`}),
            mirrorinfo: this.mirrorInfo,
            name: manga.title,
            url:`/manga/${manga.id}`,
            covers,
            langs: [lang],
            inLibrary: await this.isInLibrary(this.mirrorInfo.name, [lang], manga.url) ? true : false,
          });
        }
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

    if(!isMangaPage && !isChapterPage) return socket.emit('getMangaURLfromChapterURL', id, undefined);
    if(isMangaPage || isChapterPage) {
      try {
        if(!this.options.host || !this.options.port) throw 'no credentials';
        if(!this.options.host.length) throw 'no credentials';
        url = url.replace(/chapter\/\w+(\/)?/, '');
        return socket.emit('getMangaURLfromChapterURL', id, {url, langs: [lang], mirror:{name: this.name, version: this.version}});
      } catch(e) {
        if(e instanceof Error) this.logger('error while fetching manga from chapter url', e.message);
        else this.logger('error while fetching manga from chapter url', e);
        return socket.emit('getMangaURLfromChapterURL', id, undefined);
      }
    }
  }

  async markAsRead(mangaURL:string, lang:mirrorsLangsType, chapterURLs:string[], read:boolean) {
    if(!this.options.host || !this.options.port) return;
    if(!this.options.host.length) return;
    if(!mangaURL.length || !lang.length || !chapterURLs.length) return;
    if(!this.options.markAsRead) return;

    for(const chapterURL of chapterURLs) {
      try {
        const body = new fd();
        body.append('read', read ? 'true': 'false');
        body.append('lastPageRead', '1');
        await this.post(this.#path(chapterURL), body, 'patch', { withCredentials: true});
      } catch(e) {
        if(e instanceof Error) this.logger('markAsRead:', e.message);
        else this.logger('markAsRead:', e);
      }
    }
  }
}


const tachidesk = new Tachidesk();
export default tachidesk;
