import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import axios from 'axios';
import { load } from 'cheerio';
import { crawler } from '../utils/crawler';
import type { CheerioAPI, CheerioOptions, AnyNode} from 'cheerio';
import type { mirrorInfo } from './types/shared';
import type { ClusterJob } from '../utils/types/crawler';
import type { MirrorConstructor } from './types/constructor';

/**
 * The default mirror class
 *
 * All mirror classes should extend this class
 */
export default class Mirror {
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
  /**
   * Whether the mirror is enabled
   */
  enabled: boolean;
  /**
   * Languages supported by the mirror
   *
   * ISO 639-1 codes
   */
  langs: string[];
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
   * Mirror specific option
   * @example { adult: true, lowres: false }
   */
  options: Record<string, unknown> | undefined;

  /** weither the mirror has cache enabled or not */
  private cache: {
    status: boolean,
    dir: string
  };



  constructor(opts: MirrorConstructor) {
    this.name = opts.name;
    this.displayName = opts.displayName;
    this.host = opts.host;
    this.enabled = opts.enabled;
    this.langs = opts.langs;
    this.waitTime = opts.waitTime || 200;
    this._icon = opts.icon;
    this.options = opts.options;
    this.meta = opts.meta;
    this.cache = {
      status: opts.cache,
      dir: resolve(env.USER_DATA, '.cache', this.name),
    };
    if(opts.cache) {
      if(!existsSync(this.cache.dir)) mkdirSync(this.cache.dir);
    }
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
    return {
      name: this.name,
      displayName: this.displayName,
      host: this.host,
      enabled: this.enabled,
      icon: this.icon,
      langs: this.langs,
      meta: this.meta,
    };
  }
  private async wait() {
    return new Promise(resolve => setTimeout(resolve, this.waitTime*this.concurrency));
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[32m${this.name}\x1b[0m)` ,...args);
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
  protected async downloadImage(url:string, referer?:string, dependsOnParams = false) {
    this.concurrency++;
    const uri = new URL(url);
    const identifier = uri.origin + uri.pathname + (dependsOnParams ? uri.search : '');
    const filename = await this.filenamify(identifier);

    // try to get the file from cache if it's enabled
    if(this.cache.status) {
      let cacheResult:{mime: string, buffer:Buffer} | undefined;
      try {
        const buffer = readFileSync(resolve(this.cache.dir, filename));
        const mime = await this.getFileMime(buffer);
        cacheResult = { mime, buffer };
      } catch {
        cacheResult = undefined;
      }
      if(cacheResult) {
        this.logger('cache hit', identifier);
        return this.returnFetch(`data:${cacheResult.mime};base64,${cacheResult.buffer.toString('base64')}`);
      }
    }

    // fetch the image using axios, or use puppeteer as fallback
    let buffer:Buffer|undefined;
    try {
      const ab = await axios.get<ArrayBuffer>(url,  { responseType: 'arraybuffer', headers: { referer: referer||this.host } });
      buffer = Buffer.from(ab.data);
    } catch {
      const res = await this.crawler({url, referer: referer||this.host, waitForSelector: `img[src^="${identifier}"]`}, true);
      if(res instanceof Buffer) buffer = res;
    }

    // if none of the methods worked, return undefined
    if(!buffer) return this.returnFetch(undefined);

    // check if the file is an image, if not return undefined
    const mime = await this.getFileMime(buffer);
    if(!mime) return this.returnFetch(undefined);
    if(!mime.startsWith('image')) return this.returnFetch(undefined);

    // if the file is an image, save it to the cache
    if(this.cache.status) writeFileSync(resolve(this.cache.dir, filename), buffer);

    // return the image
    return this.returnFetch(`data:${mime};charset=utf-8;base64,`+buffer.toString('base64'));
  }

  private async getFileMime(buffer:Buffer, fallback = 'image/jpeg') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const { fileTypeFromBuffer } = await (eval('import("file-type")') as Promise<typeof import('file-type')>);
    const fT = await fileTypeFromBuffer(buffer);
    if(fT) return fT.mime;
    return fallback;
  }

  private async filenamify(string:string) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const imp = await (eval('import("filenamify")') as Promise<typeof import('filenamify')>);
    const filenamify = imp.default;
    return filenamify(string);
  }

  protected async fetch(config: ClusterJob, type:'html'):Promise<CheerioAPI>
  protected async fetch<T>(config: ClusterJob, type:'json'):Promise<T>
  protected async fetch(config: ClusterJob, type:'string'):Promise<string>
  protected async fetch<T>(config: ClusterJob, type: 'html'|'json'|'string'): Promise<T|CheerioAPI|string> {

    // in case the concurrency counter is messed up (shouldn't happen)
    if(this.concurrency < 0) this.concurrency = 0;

    // wait for the previous request to finish (this.waitTime * this.concurrency)
    this.concurrency++;
    await this.wait();

    // fetch the data (try to use axios first, then puppeteer)
    const res = await this.internalFetch<T>(config);

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

  private async internalFetch<T>(config: ClusterJob) {
    // prepare the config for both Axios and Puppeteer
    config.headers = {
      referer: config.referer || this.host.replace(/http(s?):\/\//g, ''),
      'Cookie': config.cookies ? config.cookies.map(c => c.name+'='+c.value+';').join(' ') + ' path=/; domain='+this.host.replace(/http(s?):\/\//g, '') : '',
      ...config.headers,
    };

    try {
      // try to use axios first
      const response = await axios.get<string|T>(config.url, config);

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
      return this.crawler({url: config.url, waitForSelector: config.waitForSelector }, false);
    }
  }

  private returnFetch<T>(data : T) {
    this.concurrency--;
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

}

