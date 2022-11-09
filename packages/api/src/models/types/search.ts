import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n';

export type SearchResult = {
  /**
   * id of the manga
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
  langs: mirrorsLangsType[],
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
  /** is the manga in the library */
  inLibrary: boolean,
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
