export type ClusterJob = {
  url:string;
  waitForSelector?: string;
  id:string;
  index:number;
  waitTime: number;
}

export type CrawlerJob = {
  /**
   * url to crawl
   */
   urls:string[];
   /**
    * CSS selector to wait for before returning html
    */
   waitForSelector?: string;
   /**
    * Time to wait between each requests
    * 
    * `mirror.waitTime`
    */
    waitTime:number;
}

export type ClusterResult = {
  index:number;
  /**
   * crawled url
   */
  url: string,
  /**
   * html content
   */
  data: string,
}

export type ClusterError = {
  index:number,
  /**
   * crawled url
   */
  url: string,
  /**
   * type of error
   */
  error: string,
  /**
   * error message
   */
  trace?: string,
}