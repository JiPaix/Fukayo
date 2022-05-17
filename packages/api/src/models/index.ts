import axios from 'axios';
import { load } from 'cheerio';
import { crawler } from '../utils/crawler';
import { resolve } from 'node:path';
import { env } from 'node:process';
import type { CheerioAPI, CheerioOptions, Node } from 'cheerio';
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
  /**
   * Time to wait in ms between requests
   */
  waitTime: number;
  /**
   * Mirror specific option
   * @example { adult: true, lowres: false }
   */
  options: Record<string, unknown> | undefined;

  constructor(opts: MirrorConstructor) {
    this.name = opts.name;
    this.displayName = opts.displayName;
    this.host = opts.host;
    this.enabled = opts.enabled;
    this.langs = opts.langs;
    this.waitTime = opts.waitTime || 200;
    this._icon = opts.icon;
    this.options = opts.options;
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
    };
  }
  private async wait() {
    return new Promise(resolve => setTimeout(resolve, this.waitTime*this.concurrency));
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[32m${this.name}\x1b[0m)` ,...args);
  }

  protected async downloadImage(url:string) {
    // https://github.com/sindresorhus/file-type/issues/535#issuecomment-1065952695
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const { fileTypeFromBuffer } = await (eval('import("file-type")') as Promise<typeof import('file-type')>);

    const ab = await axios({ method: 'GET' , url, responseType: 'arraybuffer', headers: { referer: this.host } });
    const buffer = Buffer.from(ab.data, 'binary');
    const fT = await fileTypeFromBuffer(buffer);
    return `data:${fT?.mime || 'image/jpeg'};charset=utf-8;base64,`+buffer.toString('base64');
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
      referer: this.host.replace(/http(s?):\/\//g, ''),
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
      return this.usePuppeteer(config);
    }
  }

  private usePuppeteer(config: ClusterJob) {
    return this.crawler({url: config.url, waitForSelector: config.waitForSelector });
  }

  private returnFetch<T>(data : T) {
    this.concurrency--;
    return data;
  }

  /**
   * Cheerio.load() wrapper
   * @param {string | Buffer | Node | Node[]} content
   * @param {CheerioOptions | null | undefined} options
   * @param {boolean | undefined} isDocument
   * @returns {CheerioAPI}
   */
  protected loadHTML(content: string | Buffer | Node | Node[], options?: CheerioOptions | null | undefined, isDocument?: boolean | undefined): CheerioAPI {
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
                    if (m) toparse = atob(m[0].substring(1, m[0].length - 1));
                }
                res = JSON.parse(toparse);
            }
        }
    }
    return res;
  }

}

