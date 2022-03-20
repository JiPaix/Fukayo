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

function wait (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  await wait(runningTask*data.waitTime);
  try {
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      if (req.isInterceptResolutionHandled()) return;
      if(intercept.includes(req.resourceType())) req.abort();
    });
    await page.goto(data.url);
    if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, {timeout: 1000*60});
    const html = await page.content();
    page.close();
    runningTask = runningTask -1;
    emitter.emit(`done:${data.id}`, {index: data.index, url: data.url, data: html});
    return {index: data.index, url:data.url, data: html};
  } catch(e) {
    runningTask = runningTask -1;
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
  runningTask = runningTask + 1;

  // generate a random id for the task
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  // watch task advance
  let start = 0;
  const finish = urls.length-1;

  urls.forEach((url, i) => instance.queue({url, waitForSelector, id, index:i, waitTime}, task));

  const res:(ClusterResult|ClusterError)[] = [];

  return new Promise(resolve => {
    emitter.on(`done:${id}`, (data: ClusterResult|ClusterError) => {
      start = start + 1;
      res.push(data);
      if(start === finish) {
        closeClusterIfAllDone(10);
        resolve(res);
      }
    });
  });
}
