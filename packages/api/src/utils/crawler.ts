import type { ClusterJob } from '@api/utils/types/crawler';
import { resolve } from 'path';
import { env } from 'process';
import type { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker-no-vulnerabilities';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import si from 'systeminformation';
import UserAgent from 'user-agents';

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin());
const userAgent = new UserAgent(/Chrome/);

/**
 * Pseudo Benchmark
 * @param CPU_cores_count Number of physical cores
 * @param CPU_max_speed_inGhz  Max speed of CPU in Ghz
 * @param MEM_available_inGb  Available memory in GB
 * @returns Number of chrome tabs to be launched
 */
function benchmark(CPU_cores_count:number, CPU_max_speed_inGhz:number, MEM_available_inGb:number) {
  // how many 500MB's of RAM are available?
  const MEM_available_500s = Math.floor(MEM_available_inGb / 0.5);
  // how many Ghz of CPU speed per core is available?
  const CPU_max_speed_1s = Math.floor(CPU_max_speed_inGhz / 1);
  // how many Ghz of CPU is available?
  const CPU_max_speed_with_cores = CPU_max_speed_1s * CPU_cores_count;
  // returns median betwen CPU_max_speed_with_cores and MEM_available_500s
  return Math.floor((CPU_max_speed_with_cores + MEM_available_500s) / 2);
}

// instance watchers
let cluster:Cluster<ClusterJob> | null = null;
let runningTask = 0;

/**
 * Initialize cluster instance if not already initialized.
 */
async function useCluster() {
  if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
  if(cluster) return cluster;
  // pseudo benchmarking
  const cores = (await si.cpu()).physicalCores;
  const speedMax = (await si.cpu()).speedMax;
  const mem = parseFloat(((await si.mem()).available / 1024 / 1024 / 1024).toFixed(2));
  const nbOfChromeTabs = benchmark(cores, speedMax, mem);
  // launching cluster
  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: nbOfChromeTabs,
    timeout: 1000*20,
    puppeteer,
    puppeteerOptions: {
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
        `--user-agent="${userAgent.random().toString()}"`,
      ],
    },
  });
  return cluster;
}

/**
 * Close cluster instance if all tasks are done.
 */
 async function closeClusterIfAllDone(closeAfter = 60) {
  setTimeout(async () => {
    if(!cluster) return;
    if(runningTask > 0) return;
    await cluster.idle();
    await cluster.close();
    cluster = null;
  }, closeAfter*1000);
}


async function task({page, data}: { page: Page, data: ClusterJob }) {
  try {
    let html:undefined|string|Error = undefined;
    if(data.auth) await page.authenticate({username:data.auth.username, password:data.auth.password});
    page.setDefaultTimeout(data.timeout || 10000);
    await page.setUserAgent(userAgent.random().toString());
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
    runningTask = runningTask-1;
    closeClusterIfAllDone();

    return html;
  } catch(e) {
    // in most cases happens because waitForSelector timeout is reached (cloudflare?)
    runningTask = runningTask-1;
    closeClusterIfAllDone();
    if(e instanceof Error) return e;
  }
}

async function taskFile({page, data}: { page: Page, data: ClusterJob }) {
  try {
    await page.setUserAgent(userAgent.random().toString());
    if(data.cookies) data.cookies.forEach(c => page.setCookie(c));

    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      if (req.isInterceptResolutionHandled()) return;
    });

    // get the content
    const res = await page.goto(data.url, { referer: data.referer, waitUntil: 'networkidle2' });
    if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, {timeout: 1000*20});
    // remove task from task list then close cluster if needed
    runningTask = runningTask-1;
    closeClusterIfAllDone();
    if(res) return res.buffer();
  } catch(e) {
    // in most cases happens because waitForSelector timeout is reached (cloudflare?)
    runningTask = runningTask-1;
    closeClusterIfAllDone();
    if(e instanceof Error) return e;
  }
}

/**
 * execute a task with headless browser
 */
export async function crawler(data: ClusterJob, isFile: false, type: 'html'|'json'|'string'): Promise<string | Error | undefined>
export async function crawler(data: ClusterJob, isFile: true): Promise<Buffer | Error | undefined>
export async function crawler(data: ClusterJob, isFile: boolean, type?: 'html'|'json'|'string') {
  const instance = await useCluster();
  if(type) data.type = type;
  if(isFile) {
    return instance.execute(data, taskFile) as Promise<Buffer | Error | undefined>;
  }
  return instance.execute(data, task) as Promise<string | Error | undefined>;
}
