import type { mirrorInfo } from './shared';

export type MangaPage = {
  id:string // "mirrorName/manga_lang/relative-url-of-manga"
  url:string, // relative-url-of-manga
  lang: string,
  name: string,
  mirrorInfo: mirrorInfo,
  synopsis?: string,
  covers?: string[], // base64
  tags?:string[],
  authors?: string[]
  chapters: {
    number: number, // float
    volume?: number // int
    url: string, // relative url
    name?: string,
    date: number
    group?: string|number
  }[]
}
