import type { ClusterJob } from '@api/utils/types/crawler';
import browser, { detectBrowserPlatform, resolveBuildId } from '@puppeteer/browsers';
import { resolve } from 'path';
import { env } from 'process';
import type { Page } from 'puppeteer';
import vanillaPuppeteer from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { addExtra } from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker-no-vulnerabilities';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import si from 'systeminformation';
import UserAgent from 'user-agents';


export class Crawler {
  static #instance: Crawler;
  cluster?: Cluster<ClusterJob> = undefined;
  #puppeteer?: ReturnType<typeof addExtra> = undefined;
  #userAgent: UserAgent;
  #revision = '1140545';
  runningTask = 0;
  #specs = { cores: 0, speedMax: 0, mem: 0 };
  #chromium?: string;
  constructor() {
    this.#userAgent = new UserAgent(/Chrome/);
  }

  protected logger(...args: unknown[]) {
    const prefix = env.VERBOSE === 'true' ? `${new Date().toLocaleString()} [api] (${this.constructor.name})` : `[api] (\x1b[33m${this.constructor.name}\x1b[0m)`;
    if(env.MODE === 'development' || env.VERBOSE === 'true') console.log(prefix ,...args);
  }

  async #init() {
    try {
      const platform = detectBrowserPlatform();
      if(!platform || (!platform.includes('linux') || !platform.includes('win'))) throw new Error('Your platform is not supported');
      if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
      // keeping chromium up to date
      const buildId = await resolveBuildId(browser.Browser.CHROME, platform, this.#revision);
      const { path } = await browser.install({
        browser: browser.Browser.CHROMIUM,
        buildId: buildId,
        cacheDir: resolve(env.USER_DATA, '.chromium'),
        downloadProgressCallback: (dl, total) => {
          this.logger(`updating chromium ${dl}/${total}`);
        },
      });

      // we have to manually provide the path to the executable
      if(platform.includes('linux')) this.#chromium = resolve(path, 'chrome-linux', 'chrome');
      else if(platform.includes('win')) this.#chromium = resolve(path, 'chrome-win', 'chrome.exe');
      else throw Error(`platform ${platform} isn't supported`);

      // loading plugins
      this.#puppeteer = addExtra(vanillaPuppeteer);
      this.#puppeteer.use(StealthPlugin());
      this.#puppeteer.use(AdblockerPlugin());

      // PC specs (use to define how many concurrencies can be run)
      const cores = (await si.cpu()).physicalCores;
      const speedMax = (await si.cpu()).speedMax;
      const mem = parseFloat(((await si.mem()).available / 1024 / 1024 / 1024).toFixed(2));
      this.#specs = { cores, speedMax, mem };
    } catch(e) {
      this.logger(e);
    }
  }

  static async getInstance () {
    if (!this.#instance) {
      this.#instance = new this();
      await this.#instance.#init();
    }
    return this.#instance;
  }
  /**
   * Pseudo Benchmark
   * @param CPU_cores_count Number of physical cores
   * @param CPU_max_speed_inGhz  Max speed of CPU in Ghz
   * @param MEM_available_inGb  Available memory in GB
   * @returns Number of chrome tabs to be launched
   */
  #benchmark(CPU_cores_count:number = this.#specs.cores, CPU_max_speed_inGhz:number = this.#specs.speedMax, MEM_available_inGb:number = this.#specs.mem) {
    // how many 500MB's of RAM are available?
    const MEM_available_500s = Math.floor(MEM_available_inGb / 0.5);
    // how many Ghz of CPU speed per core is available?
    const CPU_max_speed_1s = Math.floor(CPU_max_speed_inGhz / 1);
    // how many Ghz of CPU is available?
    const CPU_max_speed_with_cores = CPU_max_speed_1s * CPU_cores_count;
    // median betwen CPU_max_speed_with_cores and MEM_available_500s
    const median = Math.floor((CPU_max_speed_with_cores + MEM_available_500s) / 2);
    if(median < 1) return 1;
    return median;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async useCluster():Promise<Cluster<ClusterJob, any> | undefined> {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    if(typeof this.#puppeteer === 'undefined') throw Error('call init() before');
    if(typeof this.#chromium === 'undefined') throw Error('Puppeteer needs chromium to be installed');
    if(this.cluster) return this.cluster;
    try {
      const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency: this.#benchmark(),
        timeout: 1000*20,
        puppeteer: this.#puppeteer,
        puppeteerOptions: {
          executablePath: this.#chromium,
          userDataDir: resolve(env.USER_DATA, '.cache', 'puppeteer'),
          headless: env.MODE === 'development' ? false : true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--disable-gpu',
            `--user-agent="${this.#userAgent.random().toString()}"`,
          ],
        },
      });
      this.cluster = cluster;
      return cluster;
    } catch(e) {
      this.logger(e);
    }
  }

  async closeClusterIfAllDone(closeAfter = 60) {
    setTimeout(async () => {
      if(!this.cluster) return;
      if(this.runningTask > 0) return;
      await this.cluster.idle();
      await this.cluster.close();
      this.cluster = undefined;
    }, closeAfter*1000);
  }

  async task({page, data}: { page: Page, data: ClusterJob }) {
    try {
      let html:undefined|string|Error = undefined;
      if(data.auth) await page.authenticate({username:data.auth.username, password:data.auth.password});
      page.setDefaultTimeout(data.timeout || 10000);
      await page.setUserAgent(this.#userAgent.random().toString());
      if(data.cookies) data.cookies.forEach(c => page.setCookie(c));

      // block: 'stylesheet', 'font', 'image', 'media'
      await page.setRequestInterception(true);
      page.on('request', async (req) => {
        if (req.isInterceptResolutionHandled()) return;
      });

      page.on('response', async resp => {
        if(data.type !== 'json') return;
        if(!resp.url()) return;
        if(resp.ok()) html = await resp.text();
        else new Error(`bad_request: ${resp.status()} @ ${data.url}`);
      });

      // go to page and wait for network idle
      await page.goto(data.url, { referer: data.referer });
      await page.waitForNetworkIdle();

      // if we didn't get a 404, and user asked for HTML/STRING, get it
      if(data.type !== 'json' && !html) {
        if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, { timeout: 1000*20 });
        html = await page.content();
      }

      // remove task from task list then close cluster if needed
      this.runningTask--;
      this.closeClusterIfAllDone();
      return html;
    } catch(e) {
      // in most cases happens because waitForSelector timeout is reached (cloudflare?)
      this.runningTask--;
      this.closeClusterIfAllDone();
      if(e instanceof Error) return e;
    }
  }

  async taskFile({page, data}: { page: Page, data: ClusterJob }) {
    try {
      await page.setUserAgent(this.#userAgent.random().toString());
      if(data.cookies) data.cookies.forEach(c => page.setCookie(c));

      await page.setRequestInterception(true);
      page.on('request', async (req) => {
        if (req.isInterceptResolutionHandled()) return;
      });

      // get the content
      const res = await page.goto(data.url, { referer: data.referer, waitUntil: 'networkidle2' });
      if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, {timeout: 1000*20});
      // remove task from task list then close cluster if needed
      this.runningTask--;
      this.closeClusterIfAllDone();

      if(res) return await res.buffer();
      else return undefined;
    } catch(e) {
      // in most cases happens because waitForSelector timeout is reached (cloudflare?)
      this.runningTask--;
      this.closeClusterIfAllDone();
      if(e instanceof Error) return e;
    }
  }
}


/**
 * execute a task with headless browser
 */
export async function crawler(data: ClusterJob, isFile: false, type: 'html'|'json'|'string'): Promise<string | Error | undefined>
export async function crawler(data: ClusterJob, isFile: true): Promise<Buffer | Error | undefined>
export async function crawler(data: ClusterJob, isFile: boolean, type?: 'html'|'json'|'string') {

  const crawler = await Crawler.getInstance();
  const instance = await crawler.useCluster();

  // const instance = await useCluster();
  if(type) data.type = type;
  if(isFile) {
    return instance?.execute(data, crawler.taskFile.bind(crawler)) as Promise<Buffer | Error | undefined>;
  }
  if(type === 'json') {
    const json = instance?.execute(data, crawler.taskFile.bind(crawler)) as Promise<Buffer | Error | undefined>;
    if(json instanceof Buffer) {
      try {
        return json.toString();
      } catch(e) {
        return e;
      }
    }
    return json;
  }
  return instance?.execute(data, crawler.task.bind(crawler)) as Promise<string | Error | undefined>;
}

export async function puppeteerExec<T = void>(callback: ({ page }: { page: Page }) => Promise<T>) {
  const crawler = await Crawler.getInstance();
  crawler.runningTask++;
  try {
    const instance = await crawler.useCluster();
    const exec = instance?.execute(callback);
    crawler.runningTask--;
    crawler.closeClusterIfAllDone();
    return exec;
  } catch(e) {
    crawler.runningTask--;
    crawler.closeClusterIfAllDone();
    throw e;
  }
}
