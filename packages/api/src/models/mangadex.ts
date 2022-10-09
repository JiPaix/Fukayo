import Mirror from '@api/models';
import icon from '@api/models/icons/mangadex.png';
import type MirrorInterface from '@api/models/interfaces';
import type { MangaPage } from '@api/models/types/manga';
import { SchedulerClass } from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { mirrorsLang } from '@i18n/index';

type MangaAttributes = {
  title: {
    [key: string]: string
  }
  altTitles: {
    [key: string]: string
  },
  description: {
    [key: string]: string | null
  },
  lastChapter: string | null
  lastVolume: string | null
  tags: {
    id: string,
    type: 'tag',
    attributes: {
      name: {
        [key: string]: string
      }
    }
  }[],
  availableTranslatedLanguages: mirrorsLangsType[]
}

type ChapterAttributes = {
  title: string,
  volume: string | null,
  chapter: string | null,
  translatedLanguage: mirrorsLangsType,
  externalUrl: string | null
  readableAt: string,
}

type ChapterRelationShips = (
  {
    id: string,
    type: 'scanlation_group' | 'user'
  }
  |
  {
    id:string
    type: 'manga'
    attributes: MangaAttributes
  }
)[]

type MangaRelationShips =
  (
    {
      id: string,
      type: 'author'
      attributes: {
        name: string,
      }
    }
    |
    {
      id: string,
      type: 'artist'
      attributes: {
        name: string,
      }
    }
    |
    {
      id: string,
      type: 'cover_art'
      attributes: {
        fileName: string
      }
    }
  )[]


type chapterRelationShips =
  ({
    id: string,
    type: 'scanlation_group'
    attributes: {
      name: string
    }
  }
  |
  {
    id: string,
    type: 'user'
    attributes: {
      username: string
    }
  }
  |
  {
    id: string,
    type: 'manga',
    attributes:MangaAttributes
  })[]

type Routes = {
  '/auth/login' : {
    payload: { username: string, password: string }
    ok: {
      result: 'ok',
      token: {
        session: string,
        refresh: string
      }
    },
    err: {
      result: 'error',
      errors: [
        {
          title: string,
          detail: string
        }
      ]
    }
  },
  '/auth/refresh' : {
    payload: { token: string }
    ok: Routes['/auth/login']['ok']
    err: Routes['/auth/login']['err']
  },
  '/chapter': {
    ok: {
      result: 'ok',
      reponse: 'collection',
      data: {
        id: string,
        type: string,
        attributes : {
          title: string,
          volume: null | string,
          chapter: null | string,
          translatedLanguage: string,
          externalUrl: string | null
        }
        relationships: chapterRelationShips
      }[]
    }
    err: Routes['/auth/login']['err']
  },
  '/chapter/{id}': {
    ok: {
      result: 'ok',
      reponse: 'entity',
      data: {
        id: string,
        type: 'chapter',
        attributes : {
          title: string,
          volume: null | string,
          chapter: null | string,
          translatedLanguage: string,
          externalUrl: string | null
        }
        relationships: chapterRelationShips
      }
    }
    err: Routes['/auth/login']['err']
  },
  '/at-home/server/{id}': {
    ok: {
      result: 'ok',
      baseUrl: string,
      chapter: {
        hash: string,
        data: string[]
        dataSaver: string[]
      }
    }
    err: Routes['/auth/login']['err']
  },
  '/manga/{id}': {
    ok: {
      result: 'ok',
      response: 'entity',
      data: {
        id: string
        type: string,
        attributes: MangaAttributes
        relationships: MangaRelationShips
      }
    },
    err: Routes['/auth/login']['err']
  },
  '/manga/{search}': {
    ok: {
      result: 'ok',
      response: 'entity',
      data: {
        id: string
        type: string,
        attributes: MangaAttributes
        relationships: MangaRelationShips
      }[]
    },
    err: Routes['/auth/login']['err']
  }
  '/manga/{id}/feed': {
    ok: {
      result: 'ok',
      response: 'collection',
      data: {
        id: string,
        type: 'chapter',
        attributes: ChapterAttributes
        relationships: ChapterRelationShips
      }[],
      limit: number,
      offset: number,
      total: number,
    }
    err: Routes['/auth/login']['err']
  },
  '/manga/{id}/read': {
    ok: {
      result: 'ok',
      data: string[],
    }
    err: Routes['/auth/login']['err']
  },
  '/group': {
    err: Routes['/auth/login']['err']
    ok: {
      result:'ok',
      response: 'entity',
      data: {
        id: string,
        type: 'scanlation_group',
        attributes: {
          name: string,
        }
      }[]
    }
  }
}

class MangaDex extends Mirror<{login?: string|null, password?:string|null, dataSaver: boolean, markAsRead: boolean, excludedGroups:string[], excludedUploaders:string[]}> implements MirrorInterface {
  sessionToken: string|null = null;
  authToken: string|null = null;
  sessionInterval: NodeJS.Timer|null = null;
  authInterval: NodeJS.Timer|null = null;
  constructor() {
    super({
      version: 1,
      isDead: false,
      host: 'https://mangadex.org',
      name: 'mangadex',
      displayName: 'MangaDex',
      langs: mirrorsLang
        .map(x=>x) // makes mirrorsLangs mutable
        .filter(x=>x!=='xx'), // remove "unknown" from lang list
      icon,
      waitTime: 500,
      entryLanguageHasItsOwnURL: false,
      meta: {
        speed: 0.7,
        quality: 0.8,
        popularity: 1,
      },
      options: {
        cache: true,
        enabled: true,
        login: null,
        password: null,
        dataSaver: false,
        markAsRead: false,
        excludedGroups: [],
        excludedUploaders: [],
      },
    });
    this.#login();
  }

  get #headers() {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36 Edg/104.0.1293.63',
    };

    if(!this.sessionToken) return headers;
    else return { ...headers, Authorization: `Bearer ${this.sessionToken}` };

  }

  #includeLangs(langs: mirrorsLangsType[]) {
    return langs.map(x => 'availableTranslatedLanguage[]=' + x).join('&');
  }

  async #login() {
    this.#clearIntervals();
    this.#nullTokens();
    if(!this.options.login || !this.options.password) return this.logger('no credentials');
    if(!this.options.enabled) return this.logger('mirror is disabled');

    const username = this.options.login,
          password = this.options.password;

    try {
      const resp = await this.post<
        Routes['/auth/login']['payload'], Routes['/auth/login']['ok'] | Routes['/auth/login']['err']
      >(this.#path('/auth/login'), { username, password }, 'post', { headers: this.#headers });

      if(!resp) {
        this.logger('no response', '/auth/login');
        return false;
      }

      if(resp.result === 'ok') {
        this.authToken = resp.token.refresh;
        this.sessionToken = resp.token.session;
        this.#loginLoop();
        this.#refreshLoop();
        this.logger('logged in!');
        return true;
      } else {
        this.logger(resp.errors);
        return false;
      }
    } catch(e) {
      if(e instanceof Error) this.logger('not logged in:', e.message);
      else this.logger('not logged in:', e);
      return false;
    }
  }

  async #refresh():Promise<boolean> {
    if(this.authToken) {
      const resp = await this.post<
        Routes['/auth/refresh']['payload'], Routes['/auth/refresh']['ok']|Routes['/auth/refresh']['err']
      >(this.#path('/auth/refresh'), { token: this.authToken }, 'post', { headers: this.#headers } );

      if(!resp) {
        this.logger('no response', '/auth/refresh');
        return false;
      }
      if(resp.result === 'ok') {
        this.authToken = resp.token.refresh;
        this.sessionToken = resp.token.session;
        return true;
      } else {
        this.logger(resp.errors);
        return false;
      }
    }
    return false;
  }

  #clearIntervals() {
    if(this.authInterval) clearInterval(this.authInterval);
    if(this.authInterval) clearInterval(this.authInterval);
  }

  #nullTokens() {
    this.authToken = null;
    this.sessionToken = null;
  }

  #loginLoop() {
    // 86400 seconds in a day
    const msInDay = 86400*1000;
    let dayCount = 0;
    if(this.authInterval) clearInterval(this.authInterval);

    this.authInterval = setInterval(() => {
        dayCount++;  // a day has passed

        if (dayCount === 29) {
          if(this.authInterval) clearInterval(this.authInterval);
          this.#login();
        }
    }, msInDay);
  }

  #refreshLoop() {
    this.sessionInterval = setInterval(async () => {
      const res = await this.#refresh();
      if(!res) {
        // login will clear all intervals and null tokens
        this.#login();
      }
    }, 14 * 60 * 1000); // 14 minutes
  }

  async #getReadMarker(mangaId: string):Promise<string[]> {
    if(!this.options.login || !this.options.password) return [];
    if(!this.authToken || !this.sessionToken) return [];

    try {
      const res = await this.fetch<Routes['/manga/{id}/read']['ok']|Routes['/manga/{id}/read']['err']>({
        url: this.#path(`/manga/${mangaId}/read`),
        headers: this.#headers,
      }, 'json');
      if(res.result == 'ok') return res.data;
      else {
        this.logger('Couldn\'t get read markers', res);
        return [];
      }
    } catch(e) {
      if(e instanceof Error) this.logger('Couldn\'t get read markers', e.message);
      else this.logger('Couldn\'t get read markers', e);
      return [];
    }
  }

  #path(path:string) {
    if(!path.startsWith('/')) path = '/'+path;
    return 'https://api.mangadex.org'+path;
  }

  // until SEASONAL lists are made public we show last released chapters
  async recommend(socket: socketInstance, id: number) {
    let cancel = false;
    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowRecommend', () => {
        this.logger('fetching recommendations canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }

    if(cancel) return;
    try {
      // limit to 8 results as mangas with multiple langs will be shown twice
      let url = this.#path('/chapter?limit=32&offset=0&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[readableAt]=desc');
      if(this.options.excludedGroups.length) url += this.options.excludedUploaders.map(g=> `&excludedGroups[]=${g}`).join('');
      if(this.options.excludedUploaders) url += this.options.excludedUploaders.map(g=> `&excludedGroups[]=${g}`).join('');

      const res = await this.fetch<Routes['/chapter']['ok']|Routes['/chapter']['err']>({
        url,
        headers: this.#headers,
      }, 'json');

      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      const toTreat = res.data.filter(x => !x.attributes.externalUrl)
        .filter((v,i,a)=> {
          return a.findIndex(v2 => (v2.relationships.find(x => x.type === 'manga')?.id ===v.relationships.find(x => x.type === 'manga')?.id))===i;
        });

      for(const chapdata of toTreat) {
        if(cancel) break;
        const mangadata = chapdata.relationships.find(x => x.type === 'manga');
        if(!mangadata) return;
        if(mangadata.type !== 'manga') return this.logger('type is not manga', mangadata.type); // impossible, but typescript..
        const url = `/manga/${mangadata.id}`;
        // get the first name that shows up (usually en)
        const name = mangadata.attributes.title[Object.keys(mangadata.attributes.title)[0]];

        const manga = await this.fetch<
          Routes['/manga/{id}']['ok']|Routes['/manga/{id}']['err']
        >({
          url: this.#path(`${url}?includes[]=artist&includes[]=author&includes[]=cover_art`),
          headers: this.#headers,
        }, 'json');

        if(manga.result !== 'ok') return this.logger('error', manga.errors[0]);

        let coverURL: undefined | string = undefined;

        const langs = manga.data.attributes.availableTranslatedLanguages;

        const coverData = manga.data.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return this.logger('no coverURL');

        const cover = await this.downloadImage(`${this.host}/covers/${mangadata.id}/${coverURL}.512.jpg`);

        const searchResult = await this.searchResultsBuilder({
          id: manga.data.id,
          name,
          url,
          langs: langs,
          covers: cover ? [cover] : [],
        });

        socket.emit('showRecommend', id, searchResult);
      }
      socket.emit('showRecommend', id, { done: true });
      if(cancel) return;
    } catch(e) {
        this.logger('error while recommending mangas', e);
        // we catch any errors because the client needs to be able to handle them
        if(e instanceof Error) socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e.message});
        else if(typeof e === 'string') socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e});
        else socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error_unknown' });
    }
  }

  async search(query:string, langs: mirrorsLangsType[], socket: socketInstance|SchedulerClass, id:number) {
    try {
      let cancel = false;
      if(!(socket instanceof SchedulerClass)) {
        socket.once('stopSearchInMirrors', () => {
          this.logger('search canceled');
          this.stopListening(socket);
          cancel = true;
        });
      }

      const url =
        this.#path(`/manga?title=${query}&limit=16&${this.#includeLangs(langs)}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&order[relevance]=desc`);
      const res = await this.fetch<Routes['/manga/{search}']['ok']|Routes['/manga/{search}']['err']>({url}, 'json');
      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      for(const result of res.data) {
        if(cancel) break;
        const name = result.attributes.title[Object.keys(result.attributes.title)[0]];

        let coverURL: undefined | string = undefined;
        const coverData = result.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return;
        const cover = await this.downloadImage(`${this.host}/covers/${result.id}/${coverURL}.512.jpg`);

        const synopsis = result.attributes.description[Object.keys(result.attributes.description)[0]] || undefined;
        const last_release =
          result.attributes.lastChapter && isNaN(parseFloat(result.attributes.lastChapter)) ?
            { chapter: parseFloat(result.attributes.lastChapter) } : undefined;

        const langs = result.attributes.availableTranslatedLanguages;

        const searchResult = await this.searchResultsBuilder({
          id: result.id,
          name,
          url: `/manga/${result.id}`,
          covers: cover ? [cover] : [],
          synopsis,
          last_release,
          langs: langs,
        });

        // we return the results based on SearchResult model
        if(!cancel) socket.emit('searchInMirrors', id, searchResult);
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

  async #findGroup(ids: string[]):Promise<{
    id: string;
    name: string;
  }[]> {
    ids = [...new Set(ids)];

    try {
      const size = 99;
      const arrayOfArrays:string[][] = [];
      const results:{id: string, name: string}[] = [];

      for (let i=0; i<ids.length; i+=size) {
        arrayOfArrays.push(ids.slice(i,i+size));
      }

      for(const chunkOfIDs of arrayOfArrays) {

        const stringIDs = chunkOfIDs.map(x => `ids[]=${x}`).join('&');
        const res = await this.fetch<Routes['/group']['ok']|Routes['/group']['err']>({
          url: this.#path(`/group?${stringIDs}`),
        }, 'json');

        if(res.result !== 'ok') continue;
        for(const group of res.data) {
          results.push({id: group.id, name: group.attributes.name});
        }
      }
      return results;
    } catch(e) {
      return [];
    }
  }

  async manga(url:string, requestedLangs:mirrorsLangsType[], socket:socketInstance|SchedulerClass, id:number) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;
    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowManga', () => {
        this.logger('fetching manga canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }

    try {

      const manga = await this.fetch<
      Routes['/manga/{id}']['ok']|Routes['/manga/{id}']['err']
      >({
        url: this.#path(
          `${url}?contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&includes[]=artist&includes[]=author`,
        ),
        headers: this.#headers,
      }, 'json');

      if(manga.result !== 'ok') throw new Error(`${manga.errors[0].title}: ${manga.errors[0].detail}`);

      const langs = manga.data.attributes.availableTranslatedLanguages;

      if(!requestedLangs.some(x => langs.includes(x))) throw new Error(`this manga has no translation for this languages ${requestedLangs}`);

      const name =  manga.data.attributes.title[Object.keys(manga.data.attributes.title)[0]];
      const tags = manga.data.attributes.tags.map(x => x.attributes.name[Object.keys(x.attributes.name)[0]]);
      const synopsis = manga.data.attributes.description[Object.keys(manga.data.attributes.description)[0]] || undefined;
      const authors = manga.data.relationships
        .filter(x => x.type === 'artist' || x.type === 'author')
        .map(x => (x.attributes as {name: string}).name);

      let coverURL: undefined | string = undefined;
      const coverData = manga.data.relationships.find(x => x.type === 'cover_art');
      if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
      if(!coverURL) return;
      const cover = await this.downloadImage(`${this.host}/covers/${manga.data.id}/${coverURL}.512.jpg`, 'cover');

      const requestLangs = requestedLangs.map(x => `translatedLanguage[]=${x}`).join('&');

      const scanlationGroups:Set<{id:string, name: string}> = new Set();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [page, _] of Array(20).entries()) {

        if(cancel) break;

        let reqURL = this.#path(
          `${url}/feed?limit=500&offset=${page*500}&${requestLangs}&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
        );
        if(this.options.excludedGroups.length) reqURL += this.options.excludedUploaders.map(g=> `&excludedGroups[]=${g}`).join('');
        if(this.options.excludedUploaders) reqURL += this.options.excludedUploaders.map(g=> `&excludedGroups[]=${g}`).join('');

        const res = await this.fetch<
          Routes['/manga/{id}/feed']['ok']|Routes['/manga/{id}/feed']['err']
        >({
          url: reqURL,
          headers: this.#headers,
        }, 'json');

        if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

        // retrieving scanlators names
        const groups = res.data.map(x=>x.relationships.find(y=>y.type==='scanlation_group')?.id);
        const scanlators = await this.#findGroup(groups.filter(x => typeof x !== 'undefined') as string[]);
        scanlators.forEach(s => scanlationGroups.add(s));
        // retrieving read markers
        const readMarkers = await this.#getReadMarker(url.replace('/manga/', ''));

        const chapters:MangaPage['chapters'] = [];

        for(const x of res.data.filter(x => !x.attributes.externalUrl || !x.attributes.chapter)) {
          const built = await this.chaptersBuilder({
            id: x.id,
            url: '/chapter/'+x.id,
            lang: x.attributes.translatedLanguage,
            date: new Date(x.attributes.readableAt).getTime(),
            number: parseFloat(x.attributes.chapter as string),
            volume: x.attributes.volume ? parseFloat(x.attributes.volume) : undefined,
            name: x.attributes.title ? x.attributes.title : undefined,
            read: readMarkers.includes(x.id),
            group: Array.from(scanlationGroups).find(s => s.id === x.relationships.find(r => r.type === 'scanlation_group')?.id)?.name,
          });
          chapters.push(built);
        }

        const mg = await this.mangaPageBuilder({
          id: url.replace('/manga/', ''),
          url,
          langs: requestedLangs,
          covers: cover ? [cover] : [],
          name,
          synopsis,
          tags,
          authors,
          chapters,
        });

        socket.emit('showManga', id, mg);

        // stop loop if we got all chapters
        const current = res.limit + res.offset;
        const total = res.total;
        if(current >= total) break;

      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching manga', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
      else socket.emit('showManga', id, {error: 'manga_error_unknown'});
    }
    return this.stopListening(socket);
  }

  async chapter(link: string, lang: mirrorsLangsType, socket: socketInstance, id: number, callback?: ((nbOfPagesToExpect: number) => void) | undefined, retryIndex?: number | undefined) {
    // we will check if user don't need results anymore at different intervals
    let cancel = false;

    if(!(socket instanceof SchedulerClass)) {
      socket.once('stopShowChapter', () => {
        this.logger('fetching chapter canceled');
        this.stopListening(socket);
        cancel = true;
      });
    }

    if(cancel) return;

    try {
      const match = link.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);
      if(!match) throw new Error('invalid chapter id');

      const resp = await this.fetch<
        Routes['/at-home/server/{id}']['ok'] | Routes['/at-home/server/{id}']['err']
      >({url: this.#path(`/at-home/server/${match[0]}`)}, 'json');

      if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
      if(callback) callback(resp.chapter.data.length);

      console.log(resp);

      const type = this.options.dataSaver ? 'dataSaver' : 'data';

      for(const [i, v] of resp.chapter[type].entries()) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;

        socket.emit('showChapter', id, {index: i, src: `${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`, lastpage: typeof retryIndex === 'number' ? true : i+1 === resp.chapter.data.length });
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

  isChapterPage(url: string): boolean {
    return /chapter\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
  }

  isMangaPage(url: string): boolean {
    return /title\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
  }

  async mangaFromChapterURL(socket: socketInstance, id: number, url: string, lang?: mirrorsLangsType) {
    url = url.replace(this.host, ''); // remove the host from the url
    url = url.replace('https://api.mangadex.org', ''); // remove the api url
    url = url.replace(/\/$/, ''); // remove trailing slash



    // if no lang is provided, we will use a default one
    lang = lang||'en';
    // checking what kind of page this is
    const isMangaPage = this.isMangaPage(url),
          isChapterPage = this.isChapterPage(url);

    if(isMangaPage) {
      const mangaId = url.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);
      if(!mangaId) return socket.emit('getMangaURLfromChapterURL', id, undefined);
      return socket.emit('getMangaURLfromChapterURL', id, {url: `/manga/${mangaId[0]}`, langs: [lang], mirror:{name: this.name, version: this.version}});
    }
    else if(isChapterPage) {
      try {
        const chapterId = url.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);

        const res = await this.fetch<
          Routes['/chapter/{id}']['ok'] | Routes['/chapter/{id}']['err']
        >({ url: this.#path(`/chapter/${chapterId}?includes[]=manga`), headers: this.#headers }, 'json');

        if(res.result !== 'ok') return socket.emit('getMangaURLfromChapterURL', id, undefined);

        const find = res.data.relationships.find(x => x.type === 'manga');
        if(!find) return socket.emit('getMangaURLfromChapterURL', id, undefined);

        const mangaId = find.id;
        return socket.emit('getMangaURLfromChapterURL', id, {url: `/manga/${mangaId}`, langs: [lang], mirror:{name: this.name, version: this.version}});
      } catch {
        return socket.emit('getMangaURLfromChapterURL', id, undefined);
      }
    }
    else return socket.emit('getMangaURLfromChapterURL', id, undefined);
  }

  async markAsRead(mangaURL: string, lang: mirrorsLangsType, chapterURLs: string[], read: boolean) {
    if(!this.options.login || !this.options.password || !this.options.markAsRead || chapterURLs.length) return;

    const mangaIdMatchArray = mangaURL.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/gm);
    if(!mangaIdMatchArray) return this.logger('markAsRead: incorrect manga id');
    const mangaId = mangaIdMatchArray[0];

    // check each of the chapter urls
    const chapters:Set<string> = new Set();
    for(const chapter of chapterURLs) {
      const chapterId = chapter.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/gm);
      if(chapterId) chapters.add(chapterId[0]);
      else continue;
    }

    const payload =  read ? { 'chapterIdsRead': Array.from(chapters) } : { 'chapterIdsUnread': Array.from(chapters) };
    if(chapters.size === 0) return this.logger('markAsRead: no chapter were selected');

    try {
      const resp = await this.post<typeof payload, { result: 'ok'}|Routes['/auth/login']['err']>(this.#path(`/manga/${mangaId}/read`), payload, 'post', { headers: this.#headers });
      if(!resp) return this.logger('markAsRead: no response');
      if(resp.result === 'error') return this.logger('markAsRead:', resp.errors[0].title, resp.errors[0].detail);
      else return this.logger(`markAsRead: read status successfully changed x${chapters.size}`);
    } catch(e) {
      if(e instanceof Error) return this.logger('markAsRead:', e.message);
      else return this.logger('markAsRead:', e);
    }
  }
}

const mangadex = new MangaDex();
export default mangadex;
