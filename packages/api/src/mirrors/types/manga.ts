export type MangaPage = {
  langs: string[],
  name: string,
  mirror: string,
  synopsis?: string,
  covers?: string[], // base64
  chapters: {
    number: number, // float
    volume?: number // int
    link: string, // relative url
    name?: string,
  }[]
}