import { Database } from '@api/db/index';
import { MangaDatabase } from '@api/db/mangas';
import { SettingsDatabase } from '@api/db/settings';
import type { uuid } from '@api/db/uuids';
import { UUID } from '@api/db/uuids';
import type { MirrorConstructor } from '@api/models/types/constructor';
import type { mirrorInfo } from '@api/models/types/shared';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import { crawler } from '@api/utils/crawler';
import { FileServer } from '@api/utils/fileserv';
import type { ClusterJob } from '@api/utils/types/crawler';
import type { mirrorsLangsType } from '@i18n/index';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import axios from 'axios';
import type { AnyNode, CheerioAPI, CheerioOptions } from 'cheerio';
import { load } from 'cheerio';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { env } from 'process';

const uuidgen = UUID.getInstance();

/**
 * The default mirror class
 *
 * All mirror classes should extend this class
 * @template T Mirror specific options
 * @example
 * class myMirror extends Mirror<{ lowres: boolean }> {}
 * // if mirror has no options use undefined
 * class myMirror extends Mirror<undefined> {}
 */
export default class Mirror<T extends Record<string, unknown> = Record<string, unknown>> {
  private concurrency = 0;
  protected crawler = crawler;
  private _icon;
  /** slug name */
  name: string;
  /** full name */
  displayName: string;
  /**
   * hostname without ending slash
   * @example 'https://www.mirror.com'
   */
  host: string;
  /** alternative hostnames were the site can be reached */
  althost?: string[];
  /**
   * Languages supported by the mirror
   *
   * ISO 639-1 codes
   */
  langs: mirrorsLangsType[];
  /** Meta information */
  meta: {
    /**
     * quality of scans
     *
     * Number between 0 and 1
     */
    quality: number,
    /**
     * Speed of releases
     *
     * Number between 0 and 1
     */
    speed: number,
    /**
     * Mirror's popularity
     *
     * Number between 0 and 1
     */
    popularity: number,
  };
  /**
   * Time to wait in ms between requests
   */
  waitTime: number;


  /**
   * mirror specific options
   */
  private db: Database<MirrorConstructor<T>['options']>;


  constructor(opts: MirrorConstructor<T>) {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    this.name = opts.name;
    this.displayName = opts.displayName;
    this.host = opts.host;
    this.althost = opts.althost;
    this.langs = opts.langs;
    this.waitTime = opts.waitTime || 200;
    this._icon = opts.icon;
    this.meta = opts.meta;
    if(this.cacheEnabled) {
      const cacheDir = resolve(env.USER_DATA, '.cache', this.name);
      if(!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    }
    this.db = new Database(resolve(env.USER_DATA, '.options', this.name+'.json'), opts.options);
  }

  public get enabled() {
    return this.db.data.enabled;
  }

  public set enabled(val:boolean) {
    this.options.enabled = val;
    this.db.write();
  }

  public get options() {
    return this.db.data;
  }

  public set options(opts: MirrorConstructor<T>['options']) {
    this.db.data = { ...this.db.data, ...opts };
    this.logger('options changed', opts);
    this.db.write();
  }

  public get cacheEnabled() {
    return SettingsDatabase.data.cache.age.enabled || SettingsDatabase.data.cache.size.enabled;
  }
  /**
   * Returns the mirror icon
   * @type {String}
   */
  public get icon() {
    if(import.meta.env.DEV) {
      const __dirname = import.meta.url.replace('file://', '').replace(/\/\w+\.ts$/, '');
      const resolved = resolve(__dirname, '../', 'icons', `${this.name}.png`);
      return `file://${resolved}`;
    }
    return this._icon;
  }

  public get mirrorInfo():mirrorInfo {
    const allOptions = this.options;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _v, ...options } = allOptions;
    return {
      name: this.name,
      displayName: this.displayName,
      host: this.host,
      enabled: this.enabled,
      icon: this.icon,
      langs: this.langs,
      meta: this.meta,
      options: options,
    };
  }

  private async wait() {
    return new Promise(resolve => setTimeout(resolve, this.waitTime*this.concurrency));
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[32m${this.name}\x1b[0m)` ,...args);
  }

  /** check if the fetched manga is part of the library */
  protected isInLibrary(mirror:string, lang:mirrorsLangsType | mirrorsLangsType[], url:string) {
    return MangaDatabase.has(mirror, lang, url);
  }

  uuidv5(options: { lang: mirrorsLangsType, url: string }, force?:false):string
  uuidv5(options: { url: string, id: string}, force: true):string
  uuidv5(
    options: {
      lang?: mirrorsLangsType,
      /**
       * chapter url
       *
       * @important if chapters share the same url the same uuid will be generated
       * @workaround append the chapter number/index/some other identifier at the end of the url
       */
      url: string
      id?: string
    },
    force = false,
  ): string {
    if(force && options.id) return uuidgen.generate({ mirror: this.name, ...options } as uuid, true);
    if(!force && options.url && options.lang) return uuidgen.generate({ mirror: this.name, ...options } as uuid, true);
    throw Error('uuidgen: missing options');
  }

  /** change the mirror settings */
  changeSettings(opts: Record<string, unknown>) {
    this.options = { ...this.options, ...opts };
  }

  /**
   *
   * @param url the url to fetch
   * @param referer the referer to use
   * @param dependsOnParams whether the data depends on the query parameters
   * @example
   * // dependsOnParams: true
   * const url = 'https://www.example.com/images?id=1';
   * downloadImage(url, true)
   * // dependsOnParams: false
   * const url = 'https://www.example.com/images/some-image.jpg?token=123';
   * downloadImage(url, false)
   */
  protected async downloadImage(url:string, returnType: 'cover'|'page', referer?:string, dependsOnParams = false, config?:AxiosRequestConfig):Promise<string|undefined> {
    this.concurrency++;
    const {identifier, filename} = await this.generateCacheFilename(url, dependsOnParams);

    const cache = await this.loadFromCache({identifier, filename}, returnType);
    if(cache) return this.returnFetch(cache, filename);

    await this.wait();
    // fetch the image using axios, or use puppeteer as fallback
    let buffer:Buffer|undefined;
    try {
      const ab = await axios.get<ArrayBuffer>(url,  { responseType: 'arraybuffer', headers: { referer: referer || this.host }, ...config, timeout: 5000 });
      buffer = Buffer.from(ab.data);
    } catch {
      const res = await this.crawler({url, referer: referer||this.host, waitForSelector: `img[src^="${identifier}"]`, ...config, timeout: 10000 }, true);
      if(res instanceof Buffer) buffer = res;
    }

    // if none of the methods worked, return undefined
    if(!buffer) return this.returnFetch(undefined);

    const { mime } = await this.getFileMime(buffer);
    if(mime && mime.startsWith('image/')) {
      if(this.options.cache) this.saveToCache(filename, buffer);
      if(returnType === 'page') return this.returnFetch(buffer, filename);
      return this.returnFetch(`data:${mime};charset=utf-8;base64,`+buffer.toString('base64'));
    }
  }

  private async getFileMime(buffer:Buffer) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const { fileTypeFromBuffer } = await (eval('import("file-type")') as Promise<typeof import('file-type')>);
    const fT = await fileTypeFromBuffer(buffer);
    if(fT) return { mime: fT.mime };
    else return { mime: 'image/jpeg' };
  }

  private async filenamify(string:string) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const imp = await (eval('import("filenamify")') as Promise<typeof import('filenamify')>);
    const filenamify = imp.default;
    return filenamify(string);
  }

  protected async post<PLOAD, RESP = unknown>(url:string, data:PLOAD, type: 'post'|'patch'|'put' = 'post', config?:AxiosRequestConfig) {
    this.concurrency++;
    await this.wait();
    try {
      const resp = await axios[type]<RESP>(url, data, { ...config, timeout: 5000 });
      return resp.data;
    } catch(e) {
      if((e as AxiosError).response) {
        this.logger({
          type: 'post error',
          message: (e as AxiosError).response?.data,
          url,
        });
      } else if(e instanceof Error){
        this.logger({
          type: 'post error',
          message: e.message,
          url,
        });
      } else {
        this.logger({
          type: 'post error',
          message: e,
          url,
        });
      }
      return undefined;
    }
  }

  protected async fetch(config: ClusterJob, type:'html'):Promise<CheerioAPI>
  protected async fetch<T>(config: ClusterJob, type:'json'):Promise<T>
  protected async fetch(config: ClusterJob, type:'string'):Promise<string>
  protected async fetch<T>(config: ClusterJob, type: 'html'|'json'|'string'): Promise<T|CheerioAPI|string> {
    // wait for the previous request to finish (this.waitTime * this.concurrency)
    this.concurrency++;
    await this.wait();

    // fetch the data (try to use axios first, then puppeteer)
    const res = await this.internalFetch<T>(config, type);

    // throw an error if both axios and puppeteer failed
    if(typeof res === 'undefined' || res instanceof Error) {
      this.concurrency--;
      throw res || new Error('no_response');
    }
    // parse the data into the requested type
    else if(typeof res === 'string') {
      if(type === 'string') return this.returnFetch(res);
      if(type === 'html') return this.returnFetch(this.loadHTML(res));
      if(type === 'json') {
        try {
          return this.returnFetch<T>(JSON.parse(res));
        } catch {
          this.concurrency--;
          throw new Error('invalid_json');
        }
      }
      this.concurrency--;
      throw new Error(`unknown_type: ${type}`);
    }
    // if the data is a JSON object, parse it into the requested type
    else if(typeof res === 'object') {
      if(type === 'json') return this.returnFetch(res);
      if(type === 'string') return this.returnFetch(JSON.stringify(res));
      this.concurrency--;
      if(type === 'html') {
        throw new Error('cant_parse_json_to_html');
      }
      throw new Error(`unknown_type: ${type}`);
    }
    else {
      this.concurrency--;
      throw new Error('unknown_fetch_error');
    }
  }

  private async internalFetch<T>(config: ClusterJob, type: 'html'|'json'|'string') {
    // prepare the config for both Axios and Puppeteer
    config.headers = {
      ...config.headers,
    };

    if(type !== 'json') config.headers.referer = config.referer || this.host.replace(/http(s?):\/\//g, '');
    if(config.cookies) config.headers['Cookie'] = config.cookies.map(c => c.name+'='+c.value+';').join(' ') + ' path=/; domain='+this.host.replace(/http(s?):\/\//g, '');

    try {
      // try to use axios first
      const response = await axios.get<string|T>(config.url, { ...config, timeout: 5000 });

      if(typeof response.data === 'string') {

        if(config.waitForSelector) {
          const $ = this.loadHTML(response.data);
          if($(config.waitForSelector).length) return response.data;
          else throw new Error('selector_not_found');
        }
        return response.data;
      } else {
        if(config.waitForSelector) throw new Error('no_selector_in_'+typeof response.data);
        return response.data;
      }
    } catch(e) {
      if(e instanceof Error && e.message.includes('no_selector_in_')) throw e;
      // if axios fails or the selector is not found, try puppeteer
      return this.crawler({...config, waitForSelector: config.waitForSelector, timeout: 10000 }, false, type);
    }
  }

  private returnFetch<T>(data : T, filename?: undefined):T
  private returnFetch<T>(data : T, filename: string):string
  private returnFetch<T>(data : T, filename?: string|undefined):T|string {
    this.concurrency--;
    if(this.concurrency < 0) this.concurrency = 0;
    if(data instanceof Buffer && filename) {
      return FileServer.getInstance().serv(data, filename);
    }
    return data;
  }

  /**
   * Cheerio.load() wrapper
   * @param {string | Buffer | AnyNode | AnyNode[]} content
   * @param {CheerioOptions | null | undefined} options
   * @param {boolean | undefined} isDocument
   * @returns {CheerioAPI}
   */
  protected loadHTML(content: string | Buffer | AnyNode | AnyNode[], options?: CheerioOptions | null | undefined, isDocument?: boolean | undefined): CheerioAPI {
    return load(content, options, isDocument);
  }

  protected getVariableFromScript<Expected>(varname:string, sc:string):Expected {
    let res = undefined;
    // eslint-disable-next-line no-useless-escape
    const rx = new RegExp('(var|let|const)\\s+' + varname + '\\s*=\\s*([0-9]+|\\"|\\\'|\\\{|\\\[|JSON\\s*\\\.\\s*parse\\\()', 'gmi');
    const match = rx.exec(sc);
    if (match) {
        const ind = match.index;
        const varchar = match[2];
        const start = sc.indexOf(varchar, ind) + 1;
        if (varchar.match(/[0-9]+/)) {
            res = Number(varchar);
        } else {
            if (varchar === '"' || varchar === '\'') { // var is a string
                let found = false,
                    curpos = start,
                    prevbs = false;
                while (!found) {
                    const c = sc.charAt(curpos++);
                    if (c === varchar && !prevbs) {
                        found = true;
                        break;
                    }
                    prevbs = c === '\\';
                }
                res = sc.substring(start, curpos - 1);
            } else { // if (varchar === '[' || varchar === "{" || varchar === 'JSON.parse(') { // var is object or array or parsable
                let curpos = start + varchar.length - 1,
                    openings = 1;
                const opening = varchar === 'JSON.parse(' ? '(' : varchar,
                      opposite = varchar === '[' ? ']' : (varchar === '{' ? '}' : ')');
                while (openings > 0 && curpos < sc.length) {
                    const c = sc.charAt(curpos++);
                    if (c === opening) openings++;
                    if (c === opposite) openings--;
                }
                let toparse = sc.substring(start - 1 + varchar.length - 1, curpos);
                if (toparse.match(/atob\s*\(/g)) { // if data to parse is encoded using btoa
                    const m = /(?:'|").*(?:'|")/g.exec(toparse);
                    if (m) toparse = Buffer.from(m[0].substring(1, m[0].length - 1)).toString('base64');
                }
                res = JSON.parse(toparse);
            }
        }
    }
    return res;
  }

  private async saveToCache(filename:string, buffer:Buffer) {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    if(this.cacheEnabled) {
      writeFileSync(resolve(env.USER_DATA, '.cache', this.name, filename), buffer);
      this.logger('saved to cache', filename);
    }
  }

  private async loadFromCache(id:{ identifier: string, filename:string }, returnType: 'cover' | 'page'):Promise<Buffer|string|undefined> {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    if(this.cacheEnabled) {
      let cacheResult:{mime: string|undefined, buffer:Buffer} | undefined;
      try {
        const buffer = readFileSync(resolve(env.USER_DATA, '.cache', this.name, id.filename));
        if(returnType === 'cover') cacheResult = { mime: (await this.getFileMime(buffer)).mime, buffer };
        else cacheResult = { mime:undefined, buffer };
      } catch {
        cacheResult = undefined;
      }
      if(cacheResult) {
        this.logger('cache hit', id.filename);
        if(returnType === 'cover') return `data:${cacheResult.mime};base64,${cacheResult.buffer.toString('base64')}`;
        else return cacheResult.buffer;
      }
    }
  }

  private async generateCacheFilename(url:string, dependsOnParams:boolean) {
    const uri = new URL(url);
    const identifier = uri.origin + uri.pathname + (dependsOnParams ? uri.search : '');
    const filename = await this.filenamify(identifier);
    return {filename, identifier};
  }

  /** stop listening to "stop" messages */
  protected stopListening(socket:socketInstance|SchedulerClass) {
    if(!(socket instanceof SchedulerClass)) {
      socket.removeAllListeners('stopShowManga');
      socket.removeAllListeners('stopShowChapter');
      socket.removeAllListeners('stopSearchInMirrors');
      socket.removeAllListeners('stopShowRecommend');
    }
  }
}

