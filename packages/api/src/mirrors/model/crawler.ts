import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import si from 'systeminformation';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker-no-vulnerabilities';

import type { Page, ResourceType } from 'puppeteer';
import {EventEmitter} from 'events';
import type { ClusterError, ClusterJob, ClusterResult, CrawlerJob } from './types/crawler';


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

puppeteer.use(AdblockerPlugin({blockTrackers: true}));
puppeteer.use(StealthPlugin());

const intercept:ResourceType[] = ['stylesheet', 'font', 'image', 'media'];


// instance watchers
let cluster:Cluster<ClusterJob,ClusterResult|ClusterError> | null = null;
let runningTask = 0;
const emitter = new EventEmitter();

/**
 * Initialize cluster instance if not already initialized.
 */
async function useCluster() {
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
    timeout: 1000*60,
    puppeteer,
    puppeteerOptions: {
      headless: process.env.MODE === 'development' ? false : true,
      // headless:true,
    },
  });
  return cluster;
}

/**
 * Close cluster instance if all tasks are done.
 * @param {number} closeAfter - time in seconds to wait before closing cluster
 */
 async function closeClusterIfAllDone(closeAfter: number) {
  setTimeout(async () => {
    if(!cluster) return;
    if(runningTask > 0) return;
    await cluster.idle();
    await cluster.close();
    cluster = null;
  }, closeAfter*1000);
}


/**
 * task function to be executed by cluster instance.
 * @param param0
 * @returns
 */
async function task({page, data }: { page: Page, data: ClusterJob }) {
  console.log('task()');
  try {
    await page.setCookie({name: 'isAdult', value: '1', domain: new URL(data.url).hostname, path: '/'});
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      if (req.isInterceptResolutionHandled()) return;
      if(intercept.includes(req.resourceType())) req.abort();
    });
    // let start: number | undefined;
    page.once('requestfinished', () => {
      // start = Date.now();
    });
    page.once('response', () => {
      // const stop = Date.now();
      // emitter.emit(`req:${data.id}`, stop-(start||0));
      emitter.emit(`req:${data.id}`);
    });
    await page.goto(data.url);

    if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, {timeout: 1000*60});

    const html = await page.content();
    page.close();
    emitter.emit(`done:${data.id}`, {index: data.index, url: data.url, data: html});
    return {index: data.index, url:data.url, data: html};
  } catch(e) {
    if(e instanceof Error) {
      emitter.emit(`done:${data.id}`, {index: data.index, url:data.url, error: 'cralwer_error', trace: e.message});
      return {index: data.index, url:data.url, error: 'cralwer_error', trace: e.message};
    }
    if(typeof e === 'string') {
      emitter.emit(`done:${data.id}`, {index: data.index, url:data.url, error: 'cralwer_error', trace: e});
      return {index: data.index, url:data.url, error: 'cralwer_error', trace: e};
    }
    emitter.emit(`done:${data.id}`, {index: data.index, url:data.url, error: 'cralwer_error'});
    return {index: data.index, url:data.url, error: 'crawler_error_unknown'};
  }
}

/**
 * Helper to check if task response is an error.
 */
export function isCrawlerError(x: unknown): x is ClusterError {
  if(!x) return false;
  if(typeof x === 'object') {
      return Object.prototype.hasOwnProperty.call(x, 'error');
  }
  return false;
}


/**
 * Returns the url HTML.
 */
export async function crawler({ urls, waitForSelector, waitTime }: CrawlerJob): Promise<(ClusterResult|ClusterError)[]> {
  const instance = await useCluster();
  runningTask = runningTask + urls.length;

  // generate a random id for the task
  const id = new Date().getTime();
  // watch task advance
  let todo = urls.length;

  let index = 0;
  instance.queue({url:urls[index], waitForSelector, id, index:index, waitTime}, task);
  index = index + 1;
  instance.queue({url:urls[index], waitForSelector, id, index:index, waitTime}, task);

  emitter.on(`req:${id}`, async ()=> {
    index = index + 1;
    const url = urls[index];
    if(typeof url === 'undefined') return;
    // if(time < waitTime) {
    //   await wait(waitTime - time);
    // }
    instance.queue({url, waitForSelector, id, index:index, waitTime}, task);
  });




  // urls.forEach((url, i) => instance.queue({url, waitForSelector, id, index:urls.length-i-1, waitTime}, task));

  const res:(ClusterResult|ClusterError)[] = [];

  return new Promise(resolve => {
    emitter.on(`done:${id}`, (data: ClusterResult|ClusterError) => {
      runningTask = runningTask -1;
      todo = todo - 1;
      res.push(data);
      if(todo === 0) {
        if(runningTask === 0) closeClusterIfAllDone(10);
        resolve(res);
      }
    });
  });
}
