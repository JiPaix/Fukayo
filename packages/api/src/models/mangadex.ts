import Mirror from '@api/models';
import icon from '@api/models/icons/mangadex.png';
import type MirrorInterface from '@api/models/interfaces';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { mirrorsLang } from '@i18n/index';
import type { MangaPage } from './types/manga';

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


class MangaDex extends Mirror<{login?: string|null, password?:string|null, dataSaver: boolean}> implements MirrorInterface {
  sessionToken: string|null = null;
  authToken: string|null = null;
  sessionInterval: NodeJS.Timer|null = null;
  authInterval: NodeJS.Timer|null = null;
  constructor() {
    super({
      host: 'https://mangadex.org',
      name: 'mangadex',
      displayName: 'MangaDex',
      langs: mirrorsLang.map(x=>x), // makes mirrorsLangs mutable
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
      },
    });
  }

  private get headers() {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36 Edg/104.0.1293.63',
    };

    if(!this.sessionToken) return headers;
    else return { ...headers, Authorization: `Bearer ${this.sessionToken}` };

  }

  private includeLangs(langs: mirrorsLangsType[]) {
    return langs.map(x => 'originalLanguage[]=' + x).join('&');
  }

  private async login(username: string, password:string) {
    this.clearIntervals();
    this.nullTokens();

    try {
      const resp = await this.post<
        Routes['/auth/login']['payload'], Routes['/auth/login']['ok'] | Routes['/auth/login']['err']
      >(this.path('/auth/login'), { username, password }, 'post', { headers: this.headers });

      if(!resp) {
        this.logger('no response', '/auth/login');
        return false;
      }

      if(resp.result === 'ok') {
        this.authToken = resp.token.refresh;
        this.sessionToken = resp.token.session;
        this.loginLoop(username, password);
        this.refreshLoop(username, password);
        return true;
      } else {
        this.logger(resp.errors);
        return false;
      }
    } catch(e) {
      this.logger(e);
      return false;
    }
  }

  private async refresh():Promise<boolean> {
    if(this.authToken) {
      const resp = await this.post<
        Routes['/auth/refresh']['payload'], Routes['/auth/refresh']['ok']|Routes['/auth/refresh']['err']
      >(this.path('/auth/refresh'), { token: this.authToken }, 'post', { headers: this.headers } );

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

  private clearIntervals() {
    if(this.authInterval) clearInterval(this.authInterval);
    if(this.authInterval) clearInterval(this.authInterval);
  }

  private nullTokens() {
    this.authToken = null;
    this.sessionToken = null;
  }

  private loginLoop(username: string, password: string) {
    this.authInterval = setInterval(async () => {
      const res = await this.login(username, password);
      if(!res) {
        this.clearIntervals();
        this.nullTokens();
      }
    }, 29 * 24 * 60 * 60 * 1000); // 29 days
  }

  private refreshLoop(username: string, password: string) {
    this.sessionInterval = setInterval(async () => {
      const res = await this.refresh();
      if(!res) {
        // login will clear all intervals and null tokens
        this.login(username, password);
      }
    }, 14 * 60 * 1000); // 14 minutes
  }

  private path(path:string) {
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
      const url = this.path('/chapter?limit=32&offset=0&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[readableAt]=desc');
      const res = await this.fetch<Routes['/chapter']['ok']|Routes['/chapter']['err']>({
        url,
        headers: this.headers,
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
          url: this.path(`${url}?includes[]=artist&includes[]=author&includes[]=cover_art`),
          headers: this.headers,
        }, 'json');

        if(manga.result !== 'ok') return this.logger('error', manga.errors[0]);

        let coverURL: undefined | string = undefined;

        const langs = manga.data.attributes.availableTranslatedLanguages;

        const coverData = manga.data.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return this.logger('no coverURL');

        const cover = await this.downloadImage(`${this.host}/covers/${mangadata.id}/${coverURL}.512.jpg`, 'cover');
        if(!cover) return this.logger('no cover'); // TODO default cover when mirror doesn't have one?

        const mangaId = this.uuidv5({id: manga.data.id, url, langs}, true);

        socket.emit('showRecommend', id, {
          id: mangaId,
          mirrorinfo: this.mirrorInfo,
          name,
          url,
          langs: langs,
          covers: [cover],
          inLibrary: await this.isInLibrary(this.mirrorInfo.name, langs, url) ? true : false,
        });
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

  async search(query:string, langs: mirrorsLangsType[] ,socket: socketInstance|SchedulerClass, id:number) {
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
        this.path(`/manga?title=${query}&limit=16&${this.includeLangs(langs)}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&order[relevance]=desc`);
      const res = await this.fetch<Routes['/manga/{search}']['ok']|Routes['/manga/{search}']['err']>({url}, 'json');
      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      for(const result of res.data) {
        if(cancel) break;
        const name = result.attributes.title[Object.keys(result.attributes.title)[0]];
        const link = `/manga/${result.id}`;

        let coverURL: undefined | string = undefined;
        const coverData = result.relationships.find(x => x.type === 'cover_art');
        if(coverData && coverData.type === 'cover_art') coverURL = coverData.attributes.fileName;
        if(!coverURL) return;
        const cover = await this.downloadImage(`${this.host}/covers/${result.id}/${coverURL}.512.jpg`, 'cover');
        if(!cover) return; // TODO default cover when mirror doesn't have one?

        const synopsis = result.attributes.description[Object.keys(result.attributes.description)[0]] || undefined;
        const last_release =
          result.attributes.lastChapter && isNaN(parseFloat(result.attributes.lastChapter)) ?
            { chapter: parseFloat(result.attributes.lastChapter) } : undefined;

        const langs = result.attributes.availableTranslatedLanguages;

        const mangaId = this.uuidv5({id: result.id, url, langs}, true);
        // we return the results based on SearchResult model
        if(!cancel) socket.emit('searchInMirrors', id, {
          id: mangaId,
          mirrorinfo: this.mirrorInfo,
          name,
          url:link,
          covers: [cover],
          synopsis,
          last_release,
          langs: langs,
          inLibrary: await this.isInLibrary(this.mirrorInfo.name, langs, link) ? true : false,
        });
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
          url: this.path(`/group?${stringIDs}`),
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
        url: this.path(
          `${url}?contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&includes[]=artist&includes[]=author`,
        ),
        headers: this.headers,
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
      if(!cover) return; // TODO default cover when mirror doesn't have one?

      const requestLangs = requestedLangs.map(x => `translatedLanguage[]=${x}`).join('&');

      const scanlationGroups:Set<{id:string, name: string}> = new Set();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [page, _] of Array(20).entries()) {

        if(cancel) break;

        const res = await this.fetch<
          Routes['/manga/{id}/feed']['ok']|Routes['/manga/{id}/feed']['err']
        >({
          url: this.path(
            `${url}/feed?limit=500&offset=${page*500}&${requestLangs}&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
          ),
          headers: this.headers,
        }, 'json');

        if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

        // retrieving scanlators names
        const groups = res.data.map(x=>x.relationships.find(y=>y.type==='scanlation_group')?.id);
        const scanlators = await this.#findGroup(groups.filter(x => typeof x !== 'undefined') as string[]);
        scanlators.forEach(s => scanlationGroups.add(s));

        const chapters:MangaPage['chapters'] = res.data
          .filter(x => !x.attributes.externalUrl || !x.attributes.chapter)
          .map(x => {
            return {
              id: x.id,
              url: '/chapter/'+x.id,
              lang: x.attributes.translatedLanguage,
              date: new Date(x.attributes.readableAt).getTime(),
              number: parseFloat(x.attributes.chapter as string),
              volume: x.attributes.volume ? parseFloat(x.attributes.volume) : undefined,
              name: x.attributes.title ? x.attributes.title : undefined,
              read: false,
              group: Array.from(scanlationGroups).find(s => s.id === x.relationships.find(r => r.type === 'scanlation_group')?.id)?.name,
            };
          });

        const mg:MangaPage = {
          id: url.replace('/manga/', ''),
          mirror: this.name,
          url,
          langs: requestedLangs,
          covers: [cover],
          name,
          synopsis,
          tags,
          authors,
          inLibrary: await this.isInLibrary(this.mirrorInfo.name, requestedLangs, url) ? true : false,
          chapters,
        };

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
      >({url: this.path(`/at-home/server/${match[0]}`)}, 'json');

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
      return socket.emit('getMangaURLfromChapterURL', id, {url: `/manga/${mangaId[0]}`, langs: [lang], mirror:this.name});
    }
    else if(isChapterPage) {
      try {
        const chapterId = url.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);

        const res = await this.fetch<
          Routes['/chapter/{id}']['ok'] | Routes['/chapter/{id}']['err']
        >({ url: this.path(`/chapter/${chapterId}?includes[]=manga`), headers: this.headers }, 'json');

        if(res.result !== 'ok') return socket.emit('getMangaURLfromChapterURL', id, undefined);

        const find = res.data.relationships.find(x => x.type === 'manga');
        if(!find) return socket.emit('getMangaURLfromChapterURL', id, undefined);

        const mangaId = find.id;
        return socket.emit('getMangaURLfromChapterURL', id, {url: `/manga/${mangaId}`, langs: [lang], mirror:this.name});
      } catch {
        return socket.emit('getMangaURLfromChapterURL', id, undefined);
      }
    }
    else return socket.emit('getMangaURLfromChapterURL', id, undefined);
  }
}

const mangadex = new MangaDex();
export default mangadex;
