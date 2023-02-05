import Mirror from '@api/models/abstracts';
import icon from '@api/models/icons/mangadex.png';
import Importer from '@api/models/imports/abstracts';
import type MirrorInterface from '@api/models/interfaces';
import type { importErrorMessage } from '@api/models/types/errors';
import type { MangaPage } from '@api/models/types/manga';
import Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import type { BaseClient } from 'openid-client';
import { generators, Issuer } from 'openid-client';

type MangaAttributes = {
  title: {
    [key: string]: string
  }
  altTitles: {
    [key: string]: string
  },
  description: {
    [key in mirrorsLangsType]: string | null | undefined
  },
  lastChapter: string | null
  lastVolume: string | null
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | null
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
  '/manga': {
    ok: {
      result: 'ok',
      response: 'collection'
      data: Routes['/manga/{id}']['ok']['data'][]
      limit: number,
      offset: number,
      total: number
    }
    err: Routes['/auth/login']['err']
  }
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
  },
  '/user/list' : {
    err: Routes['/auth/login']['err'],
    ok: {
      result: 'ok',
      response: 'collection'
      total: number,
      data: {
        id: string,
        type: 'custom_list',
        attributes: {
          name: string
          visibility: 'private' | 'public'
        },
        relationships: {
          id:string,
          type: 'manga'|'user',
        }[]
      }[]
    }
  },
  '/user/{id}/list': {
    err: Routes['/auth/login']['err'],
    ok: {
      result: 'ok',
      response: 'collection',
      data: {
        id: string,
        type: 'custom_list',
        attributes: {
          name: string,
          visibility: string,
          version: number
        },
        relationships: {
          id: string,
          type: 'manga' | 'user'
        }[]
      }[]
    }
  }
}

class MangaDex extends Mirror<{login?: string|null, password?:string|null, dataSaver: boolean, markAsRead: boolean, excludedGroups:string[], excludedUploaders:string[]}> implements MirrorInterface {
  #scanlatorCache:Set<{id:string, name:string}> = new Set();
  #openID = {
    auth: 'https://auth.mangadex.dev/realms/mangadex/protocol/openid-connect/auth?client_id=thirdparty-oauth-client&redirect_uri=http://127.0.0.1&response_type=code',
    token: 'https://auth.mangadex.dev/realms/mangadex/protocol/openid-connect/token',
    redirect_uri: 'http://127.0.0.1',
    client_id: 'thirdparty-oauth-client',
  };
  #tokens = {
    session: null as string | null | undefined,
    refresh_token: null as string | null | undefined,
  };

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
      requestLimits: {
        time: 500,
        concurrent: 1,
      },
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
  }

  get #headers() {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36 Edg/104.0.1293.63',
    };

    if(!this.#tokens.session) return headers;
    else return { ...headers, Authorization: `Bearer ${this.#tokens.session}` };

  }

  #includeLangs(langs: mirrorsLangsType[], type?: 'available') {
    langs = langs.filter(l => this.langs.includes(l));
    if(type === 'available') return langs.map(x => 'availableTranslatedLanguage[]=' + x).join('&');
    else return langs.map(x => 'translatedLanguage[]=' + x).join('&');
  }

  public get loggedIn():boolean {
    const { login, password } = this.options;
    const { session, refresh_token } = this.#tokens;
    return ![login, password, session, refresh_token].some(x => x == null);
  }

  async #fillLoginForm(url: string, login:string, password: string):Promise<undefined|string> {
    return await this.puppeteer((async ({ page }):Promise<undefined|string> => {
      await page.goto(url);
      await page.waitForSelector('#username');
      await page.type('#username', login);
      await page.type('#password', password);
      page.click('#kc-login');

      const request:undefined|string = await new Promise((resolve) => {
        const tm = setTimeout(() => resolve(undefined), 15000);
        let alreadyDone = false;

        const done = (value:undefined|string) => {
          clearTimeout(tm);
          if(alreadyDone) return;
          alreadyDone = true;
          resolve(value);
        };

        page.on('request', request => {
          if (request.isNavigationRequest() && request.redirectChain().length > 0) {
            const match = /code=(.*)/.exec(request.url());
            if(match) {
              done(request.url());
            }
            else {
              done(undefined);
            }
            request.continue();
          }
        });
      });

      await page.waitForNetworkIdle({ idleTime: 500 });
      return request;
    }));
  }

  async login(socket?: socketInstance) {
    const {login, password} = this.options;
    if(!this.enabled) return this.logger('mirror is disabled');

    if(!login || !password || login.length === 0 || password.length === 0) {
      if(socket) socket.emit('loggedIn', this.name, false);
      return this.logger('no credentials');
    }

    // clear previous instances?
    this.#nullTokens();

    const now = Date.now();
    try {

      const mangaDexIssuer = await Issuer.discover('https://auth.mangadex.dev/realms/mangadex/.well-known/openid-configuration');

      const client = new mangaDexIssuer.Client({
        client_id: this.#openID.client_id,
        redirect_uris: [this.#openID.redirect_uri],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      });
      const code_verifier = generators.codeVerifier();
      const code_challenge = generators.codeChallenge(code_verifier);

      const url = client.authorizationUrl({
        scope: 'openid email profile',
        resource: this.#openID.redirect_uri,
        code_challenge,
        code_challenge_method: 'S256',
      });

      const token = await this.#fillLoginForm(url, login, password);

      if(!token) {
        if(socket) socket.emit('loggedIn', this.name, false);
        return false;
      }

      const params = client.callbackParams(token);
      const { access_token, expires_at, refresh_token, expires_in } = await client.callback(this.#openID.redirect_uri, params, { code_verifier });
      if(!access_token || !expires_at || !refresh_token || !expires_in) return false;
      this.#tokens = {
        session: access_token,
        refresh_token: refresh_token,
      };
      setTimeout(() => this.#tokenLoop(client), (expires_at*1000) - now);
      if(socket) socket.emit('loggedIn', this.name, true);
      this.logger('is logged-in');
      return true;
    } catch(e) {
      if(e instanceof Error) this.logger('not logged in:', e.message);
      else this.logger('not logged in:', e);
      this.#nullTokens();
      if(socket) socket.emit('loggedIn', this.name, false);
      return false;
    }
  }


  async #tokenLoop(client:BaseClient) {
    if(!this.#tokens.refresh_token) return;
    const now = Date.now();
    try {
      const { access_token, expires_at, refresh_token, expires_in } = await client.refresh(this.#tokens.refresh_token);
      if(!access_token || !expires_at || !refresh_token || !expires_in) return this.login();
      this.#tokens = {
        session: access_token,
        refresh_token: refresh_token,
      };
      setTimeout(() => this.#tokenLoop(client), (expires_at*1000) - now);
    } catch(e) {
      this.login();
    }
  }

  #nullTokens() {
    this.#tokens = {
      session: null,
      refresh_token: null,
    };
  }

  async #getReadMarker(mangaId: string):Promise<string[]> {
    if(!this.options.login || !this.options.password) return [];
    if(!this.#tokens.session) return [];

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
    return 'https://api.mangadex.dev'+path;
  }

  // until SEASONAL lists are made public we show last released chapters
  async recommend(requestLangs: mirrorsLangsType[], socket: socketInstance, id: number) {
    // TODO: handle empty chapters
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

    if(cancel) return;
    try {
      const threeMonthAgo = new Date(new Date().setMonth(new Date().getMonth() - 3));

      const date = `${threeMonthAgo.getFullYear()}-${threeMonthAgo.getDay().toString().padStart(2, '0')}-${threeMonthAgo.getDay().toString().padStart(2, '0')}`;
      const time = 'T00:00:00';
      const datetime = date+time;

      const list = await this.fetch<Routes['/manga']['ok']|Routes['/manga']['err']>({
        url: this.#path(`manga?limit=16&includes[]=cover_art&includes[]=author&includes[]=artist&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&hasAvailableChapters=true&createdAtSince=${datetime}`),
        headers: this.#headers,
      }, 'json');

      if(list.result !== 'ok') throw new Error(`${list.errors[0].title}: ${list.errors[0].detail}`);
      const ids = list.data.filter(i => i.type === 'manga').map(r=>r.id);
      const idsChunk = ids.reduce((resultArray:string[][], item, index) => {
        const chunkIndex = Math.floor(index / 10);
        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = [] as string[];
        }
        resultArray[chunkIndex].push(item);
        return resultArray;
      }, []);

      for(const arrIds of idsChunk) {
        let url = this.#path('/manga?includes[]=cover_art&');
        url += arrIds.map(i => 'ids[]='+i).join('&');
        const res = await this.fetch<Routes['/manga']['ok']|Routes['/manga']['err']>({
          url,
          headers: this.#headers,
        }, 'json');

        if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

        res.data = res.data.filter(d => d.attributes.availableTranslatedLanguages.some(l => requestLangs.includes(l)));

        for(const d of res.data) {
          if(cancel) break;
          let coverURL: undefined | string = undefined;
          const coverData = d.relationships.find(x => x.type === 'cover_art');
          if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
          if(!coverURL) return this.logger('no coverURL');
          const cover = (await this.downloadImage(`${this.host}/covers/${d.id}/${coverURL}.512.jpg`))?.src;
          const langs = d.attributes.availableTranslatedLanguages.filter(Boolean); // sometimes language = null
          const name = d.attributes.title[Object.keys(d.attributes.title)[0]];

          const searchResult = await this.searchResultsBuilder({
            id: d.id,
            name,
            url: `/manga/${d.id}`,
            langs: langs,
            covers: cover ? [cover] : [],
          });
          if(!cancel) socket.emit('showRecommend', id, searchResult);
        }
      }
    } catch(e) {
        this.logger('error while recommending mangas', e);
        // we catch any errors because the client needs to be able to handle them
        if(e instanceof Error) socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e.message});
        else if(typeof e === 'string') socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e});
        else socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error_unknown' });
    }
    if(!cancel) socket.emit('showRecommend', id, { done: true });
    if(stopListening) stopListening();
  }

  async search(query:string, requestedLangs: mirrorsLangsType[], socket: socketInstance|Scheduler|Importer, id:number) {
    // we will check if user don't need results anymore at different intervals
    this.logger('searching for', query, 'in', requestedLangs);
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
      // TODO: handle empty chapters
      const url =
        this.#path(`/manga?title=${query}&limit=16&${this.#includeLangs(requestedLangs, 'available')}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&order[relevance]=desc`);
      const res = await this.fetch<Routes['/manga/{search}']['ok']|Routes['/manga/{search}']['err']>({url}, 'json');
      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      for(const result of res.data) {
        if(cancel) break;
        const name = result.attributes.title[Object.keys(result.attributes.title)[0]];

        let coverURL: undefined | string = undefined;
        const coverData = result.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return;
        const cover = (await this.downloadImage(`${this.host}/covers/${result.id}/${coverURL}.512.jpg`))?.src;

        // search for synopsis that matches requestedLangs
        const descriptions = requestedLangs.map(m => result.attributes.description[m]).filter(Boolean);
        let synopsis:string|undefined|null = undefined;
        // join different languages together
        if(descriptions.length) synopsis = descriptions.join('\r\n');
        // if none where found try english
        else synopsis = result.attributes.description['en'];
        // if none of the above worked set undefined
        if(!synopsis) synopsis = undefined;

        const last_release =
          result.attributes.lastChapter && isNaN(parseFloat(result.attributes.lastChapter)) ?
            { chapter: parseFloat(result.attributes.lastChapter) } : undefined;

        const searchResult = await this.searchResultsBuilder({
          id: result.id,
          name,
          url: `/manga/${result.id}`,
          covers: cover ? [cover] : [],
          synopsis,
          last_release,
          langs: result.attributes.availableTranslatedLanguages.filter(Boolean), // sometimes language = null
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
    if(stopListening) stopListening();
  }

  async #findGroup(ids: string[]):Promise<{
    id: string;
    name: string;
  }[]> {
    ids = [...new Set(ids)];

    try {
      const results:{id: string, name: string}[] = [];

      // we will look into cache first
      for(const id of ids) {
        const find = Array.from(this.#scanlatorCache).find(s => s.id === id);
        if(find) {
          results.push(find);
          // we remove the cached id from ids
          ids = ids.filter(id => id !== find.id);
        }
      }

      // return results if we found everything in cache
      if(results.length === ids.length) return results;


      const size = 99;
      const arrayOfArrays:string[][] = [];
      // put remaining ids into chunks (because of MD limitation)
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
          const val = {id: group.id, name: group.attributes.name};
          results.push(val);
          this.#scanlatorCache.add(val);
        }
      }
      return results;
    } catch(e) {
      return [];
    }
  }

  async manga(url:string, requestedLangs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number) {
    // TODO: handle empty chapters
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

    try {
      this.logger('checking', url);
      const manga = await this.fetch<
      Routes['/manga/{id}']['ok']|Routes['/manga/{id}']['err']
      >({
        url: this.#path(
          `${url}?contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&includes[]=artist&includes[]=author`,
        ),
        headers: this.#headers,
      }, 'json');

      if(manga.result !== 'ok') throw new Error(`${manga.errors[0].title}: ${manga.errors[0].detail}`);

      const langs = manga.data.attributes.availableTranslatedLanguages.filter(Boolean); // sometimes language = null
      if(!requestedLangs.some(x => langs.includes(x))) throw new Error(`this manga has no translation for this languages ${requestedLangs}`);

      const name =  manga.data.attributes.title[Object.keys(manga.data.attributes.title)[0]];
      const status = manga.data.attributes.status || undefined;
      const tags = manga.data.attributes.tags.map(x => x.attributes.name[Object.keys(x.attributes.name)[0]]);

      // search for synopsis that matches requestedLangs
      const descriptions = requestedLangs.map(m => manga.data.attributes.description[m]).filter(Boolean);
      let synopsis:string|undefined|null = undefined;
      // join different languages together
      if(descriptions.length) synopsis = descriptions.join('\r\n');
      // if none where found try english
      else synopsis = manga.data.attributes.description['en'];
      // if none of the above worked set undefined
      if(!synopsis) synopsis = undefined;

      const authors = manga.data.relationships
        .filter(x => x.type === 'artist' || x.type === 'author')
        .map(x => (x.attributes as {name: string}).name);

      let coverURL: undefined | string = undefined;
      const coverData = manga.data.relationships.find(x => x.type === 'cover_art');
      if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
      if(!coverURL) return;
      const cover = (await this.downloadImage(`${this.host}/covers/${manga.data.id}/${coverURL}.512.jpg`))?.src;
      const requestLangs = this.#includeLangs(requestedLangs);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [page, _] of Array(20).entries()) {

        if(cancel) break;

        let reqURL = this.#path(
          `${url}/feed?limit=500&offset=${page*500}&${requestLangs}&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
        );

        // filter Boolean in just in case
        if(this.options.excludedGroups.length) reqURL += this.options.excludedUploaders.filter(Boolean).map(g=> `&excludedGroups[]=${g}`).join('');
        if(this.options.excludedUploaders.length) reqURL += this.options.excludedUploaders.filter(Boolean).map(g=> `&excludedUploaders[]=${g}`).join('');

        const res = await this.fetch<
          Routes['/manga/{id}/feed']['ok']|Routes['/manga/{id}/feed']['err']
        >({
          url: reqURL,
          headers: this.#headers,
        }, 'json');

        if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

        // retrieving read markers
        const readMarkers = await this.#getReadMarker(url.replace('/manga/', ''));

        const chapters:MangaPage['chapters'] = [];

        for(const x of res.data.filter(x => (!x.attributes.externalUrl || !x.attributes.chapter) && requestedLangs.includes(x.attributes.translatedLanguage))) {
          // retrieving scanlators names
          const groups = x.relationships.filter(y=>y.type==='scanlation_group').map(g => g.id);
          const scanlators = await this.#findGroup(groups);
          const scanlationGroups = new Set<string>();
          scanlators.forEach(s => scanlationGroups.add(s.name));

          const built = await this.chaptersBuilder({
            id: x.id,
            url: '/chapter/'+x.id,
            lang: x.attributes.translatedLanguage,
            date: new Date(x.attributes.readableAt).getTime(),
            number: parseFloat(x.attributes.chapter as string),
            volume: x.attributes.volume ? parseFloat(x.attributes.volume) : undefined,
            name: x.attributes.title ? x.attributes.title : undefined,
            read: readMarkers.includes(x.id),
            group: scanlationGroups.size > 0 ? Array.from(scanlationGroups).join(', ') : undefined,
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
          status,
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
    if(stopListening) stopListening();
  }

  async chapter(link: string, lang: mirrorsLangsType, socket: socketInstance, id: number, callback?: ((nbOfPagesToExpect: number) => void) | undefined, retryIndex?: number | undefined) {
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

    if(cancel) return;

    try {
      const match = link.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);
      if(!match) throw new Error('invalid chapter id');

      const resp = await this.fetch<
        Routes['/at-home/server/{id}']['ok'] | Routes['/at-home/server/{id}']['err']
      >({url: this.#path(`/at-home/server/${match[0]}`)}, 'json');

      if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
      if(callback) callback(resp.chapter.data.length);

      const type = this.options.dataSaver ? 'dataSaver' : 'data';

      const pagecount = Array.from(resp.chapter[type].entries()).length;

      if(pagecount < 1) {
        socket.emit('showChapter', id, { error: 'chapter_error_no_pages' });
        if(stopListening) stopListening();
        return;
      }

      for(const [i, v] of resp.chapter[type].entries()) {
        if(cancel) break;
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;
        const img = await this.downloadImage(`${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`);
        if(img) socket.emit('showChapter', id, {index: i, src: img.src, height: img.height, width: img.width, lastpage: i+1 === resp.chapter.data.length });
        else socket.emit('showChapter', id, { error: 'chapter_error_no_image', trace: `cannot open: ${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`, index: i, lastpage:i+1 === resp.chapter.data.length });
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

  isChapterPage(url: string): boolean {
    return /chapter\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
  }

  isMangaPage(url: string): boolean {
    return /title\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
  }

  async markAsRead(mangaURL: string, lang: mirrorsLangsType, chapterURLs: string[], read: boolean) {
    if(!!this.options.markAsRead || chapterURLs.length) return;
    if(!this.loggedIn && this.options.login && this.options.password) {
      return setTimeout(async () => {
        try {
          await this.login();
          await this.markAsRead(mangaURL, lang, chapterURLs, read);
        } catch(e) {
          return;
        }
      }, 60*1000);
    }
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

  /** Get connected user list */
  async getLists(): Promise<importErrorMessage | Routes['/user/list']['ok']['data']> {
    if(!this.loggedIn) return {error: 'import_error', trace: 'unauthorized'};
    try {

      const lists: Routes['/user/list']['ok']['data'] = [];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for(const [i,_v] of Array.from({ length: 100 }).entries()) {

        const resp = await this.fetch<
        Routes['/user/list']['ok'] | Routes['/auth/login']['err']
        >({
          url: this.#path('/user/list?limit=100'+'&offset='+i),
          headers: this.#headers,
        },
        'json',
        );
        if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
        resp.data.filter(d=>d.attributes.visibility !== 'public').forEach(d=>lists.push(d));
        if(resp.total === resp.data.length || resp.total === lists.length) break;
      }
      return lists;
    } catch(e) {
      this.logger('error while importing mangas', e);
      if(e instanceof Error) return {error: 'import_error', trace: e.message};
      else if(typeof e === 'string') return {error: 'import_error', trace: e};
      else return { error: 'import_error' };
    }
  }

  async getMangasFromList(id:number, socket:socketInstance, requestedLangs: mirrorsLangsType[],ids:string[]) {
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

    const idChunks = ids.reduce((res: string[][], item: string, index) => {
      const chunkIndex = Math.floor(index/50);
      if(!res[chunkIndex]) {
        res[chunkIndex] = [];
      }
      res[chunkIndex].push(item);
      return res;
    }, []);

    try {
      const list: Routes['/manga']['ok']['data'] = [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for(const [i,chunk] of idChunks.entries()) {
        if(cancel) break;
        const ids = chunk.map(x => 'ids[]=' + x).join('&');
        const resp = await this.fetch<
        Routes['/manga']['ok'] |  Routes['/manga']['err']
        >({
          url: this.#path(`/manga?${ids}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&includes[]=artist&includes[]=author&includes[]=chapter&includes[]=scanlation_group&limit=100&offset=${i}`),
          headers: this.#headers,
        },
        'json',
        );
        if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
        resp.data.forEach(d=>list.push(d));
      }

      for(const manga of list) {
        if(cancel) break;
        const langs = manga.attributes.availableTranslatedLanguages.filter(Boolean); // sometimes language = null
        const name =  manga.attributes.title[Object.keys(manga.attributes.title)[0]];
        let coverURL: undefined | string = undefined;
        const coverData = manga.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return;
        const cover = (await this.downloadImage(`${this.host}/covers/${manga.id}/${coverURL}.512.jpg`))?.src;
        socket.emit('showImports', id, {name, langs, covers: cover ? [cover]: [], inLibrary: false, url: `/manga/${manga.id}`, mirror: { name: this.name, langs: this.mirrorInfo.langs } });
      }
      if(!cancel) socket.emit('showImports', id, { done: true });
    } catch(e) {
      this.logger('error while importing manga', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showImports', id, {error: 'import_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showImports', id, {error: 'import_error', trace: e});
      else socket.emit('showImports', id, {error: 'import_error'});
    }
    if(stopListening) stopListening();
  }
}

const mangadex = new MangaDex();
export default mangadex;
