import type { AxiosRequestConfig } from 'axios';

export interface ClusterJob extends AxiosRequestConfig {
  url: string
  waitForSelector?: string;
  cookies?: { name: string, value: string, domain: string, path: string }[]
}
