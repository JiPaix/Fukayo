import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import si from 'systeminformation';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker-no-vulnerabilities';

import type { Page } from 'puppeteer';
import type { ClusterJob } from './types/crawler';


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

puppeteer.use(AdblockerPlugin());
puppeteer.use(StealthPlugin());




// instance watchers
let cluster:Cluster<ClusterJob> | null = null;
let runningTask = 0;

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
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:99.0) Gecko/20100101 Firefox/99.0');
    if(data.cookies) data.cookies.forEach(c => page.setCookie(c));

    // block: 'stylesheet', 'font', 'image', 'media'
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      if (req.isInterceptResolutionHandled()) return;
      if(['stylesheet', 'font', 'image', 'media'].includes(req.resourceType())) req.abort();
    });

    // get the content
    await page.goto(data.url);
    if(data.waitForSelector) await page.waitForSelector(data.waitForSelector, {timeout: 1000*60});
    const html = await page.content();

    // remove task from task list then close cluster if needed
    runningTask = runningTask-1;
    closeClusterIfAllDone();

    return html;
  } catch(e) {
    // in most cases happens because waitForSelector timeout is reached (cloudflare?)
    runningTask = runningTask-1;
    if(e instanceof Error) return e;
  }
}

/**
 * execute a task with headless browser
 */
export async function crawler(data: ClusterJob): Promise<string | Error | undefined> {
  const instance = await useCluster();
  return instance.execute(data, task);
}
