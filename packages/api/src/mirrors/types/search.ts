export type SearchResult = {
  mirror:string,
  lang: string,
  name: string,
  link: string,
  cover?:string,
  synopsis?: string,
  last_release?: {name?:string, volume?: number, chapter?: number},
}
