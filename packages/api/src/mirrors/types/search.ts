import type { mirrorInfo } from './shared';

export type SearchResult = {
  /**
   * ID of the manga
   *
   * @example 'mirror_name/manga_lang/relative-url-of-manga'
   */
  id:string,
  /**
   * Relative url of the manga (with leading slash)
   *
   * @example '/manga/manga-name'
   */
  url: string,
  /**
   * Language of the manga
   *
   * ISO 639-1 codes
   */
  lang: string,
  /** Manga's full name */
  name: string,
  /**
   * Array of covers in base64 data string
   *
   * @example ["data:image/png;base64,...", "data:image/png;base64,..."]
   */
  covers:string[],
  /** Summary */
  synopsis?: string,
  /** Mirror's information */
  mirrorinfo:mirrorInfo,
  /** Latest release */
  last_release?: {
    /** Chapter's name */
    name?:string,
    /** Chapter's Volume */
    volume?: number,
    /**
     * Chapter's Number
     * @import use `chapter.name` if chapter is not numbered
     */
    chapter?: number
  },
}
