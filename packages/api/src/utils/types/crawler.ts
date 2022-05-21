import type { AxiosRequestConfig } from 'axios';

export interface ClusterJob extends AxiosRequestConfig {
  url: string
  /** The CSS selector to wait for */
  waitForSelector?: string;
  /** Cookies */
  cookies?: { name: string, value: string, domain: string, path: string }[]
  /** referer */
  referer?: string;
}
