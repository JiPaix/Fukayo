import type { mirrorInfo } from './shared';

export type MangaPage = {
  /**
   * ID of the manga
   *
   * @example 'mirror_name/manga_lang/relative-url-of-manga'
   */
  id:string
  /**
   * Relative url of the manga (with leading slash)
   *
   * @example '/manga/manga-name'
   */
  url:string,
  /**
   * Language of the manga
   *
   * ISO 639-1 codes
   */
  lang: string,
  /** Manga's full name */
  name: string,
  /** Custom manga's name defined by user */
  displayName?: string,
  /**
   * Array of covers in base64 data string
   *
   * @example ["data:image/png;base64,...", "data:image/png;base64,..."]
   */
  covers?: string[],
  /** Summary */
  synopsis?: string,
  /** Tags */
  tags?:string[],
  /** Authors */
  authors?: string[],
  /** Mirror's information */
  mirrorInfo: mirrorInfo,
  /** List of chapters */
  chapters: {
    /**
     * Chapter number (float) or position in the list
     *
     * position is used if the chapter is not numbered (or not available)
     */
    number: number,
    /**
     * Chapter's volume number
     */
    volume?: number
    /**
     * Chapter's relative URL
     *
     * @example '/manga/manga-name/chapter-name'
     */
    url: string,
    /** Chapter's name */
    name?: string,
    /** Fetch date */
    date: number
    /**
     * Has the chapter been read?
     *
     * Only required for mangas which are stored in the database
     */
    read?: boolean
    /**
     * Scanlator's name
     *
     * to use if mirror can provide the same chapter from multiple scanlators
     */
    group?: string|number
  }[]
}

export type MangaInDB = MangaPage & {
  /** Mirror's slug */
  mirror: string,
  chapters: MangaPage['chapters'] & {
    read: boolean
  }
}
