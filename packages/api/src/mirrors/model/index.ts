import axios from 'axios';
import { load } from 'cheerio';
import sharp from 'sharp';
import { crawler } from './crawler';
import { resolve } from 'path';
import type { AxiosRequestConfig } from 'axios';
import type { CheerioAPI, CheerioOptions, Node } from 'cheerio';
import type { MirrorConstructor } from './types';


export default class Mirror {
  
  enabled = true;
  waitTime: number;
  protected concurrency = 0;
  protected crawler = crawler;
  protected name = '';
  private _icon;

  
  constructor(opts: MirrorConstructor) {
    this.waitTime = opts.waitTime || 200;
    this._icon = opts.icon;
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

  private async wait() {
    return new Promise(resolve => setTimeout(resolve, this.waitTime*this.concurrency));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async fetch(config: AxiosRequestConfig<any>) {
    this.concurrency++;
    await this.wait();
    const response = await axios(config);
    this.concurrency--;
    return response;
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

  private async pngify(
    input?:
        | Buffer
        | Uint8Array
        | Uint8ClampedArray
        | Int8Array
        | Uint16Array
        | Int16Array
        | Uint32Array
        | Int32Array
        | Float32Array
        | Float64Array
        | string,
  ): Promise<string> {
    return (await sharp(input).png().toBuffer()).toString('base64');
  }

  /**
   * Takes an image url and returns a base64 encoded png
   * @param {String} url absolute url to image
   * @returns {Promise<String>} base64 encoded image
   * @example
   * this.getImage("https://mangafox.me/images/manga/one_piece/1.jpg")
   */
  protected async getImage(url:string): Promise<string> {
    const response = await this.fetch({url, responseType: 'arraybuffer'});
    return this.pngify(Buffer.from(response.data, 'binary'));
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

