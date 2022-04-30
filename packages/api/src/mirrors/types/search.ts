import type { mirrorInfo } from './shared';

export type SearchResult = {
  id:string,
  mirrorinfo:mirrorInfo,
  lang: string,
  name: string,
  link: string,
  covers:string[],
  synopsis?: string,
  last_release?: {name?:string, volume?: number, chapter?: number},
}
