export type ClusterJob = {
  url:string;
  waitForSelector: string;
  cookies?: { name: string, value: string, domain: string, path: string }[]
}
