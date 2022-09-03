import type { mirrorsLangsType } from '@i18n/index';

export type TaskDone = {
  done: boolean;
}
/**
 * Mirror information
 */
export type mirrorInfo = {
  /** Mirror's slug */
  name:string,
  /** Mirror's full name */
  displayName: string,
  /**
   * hostname without ending slash
   * @example 'https://www.mirror.com'
   */
  host:string,
  /**
   * Whether the mirror is enabled
   */
  enabled:boolean,
  /**
   * The icon in base 64 data string
   * @example "data:image/png;base64,..."
   */
  icon:string,
  /**
   * Languages supported by the mirror
   *
   * ISO 639-1 codes
   */
  langs: mirrorsLangsType[],
  /**
   * does the mirror treats different languages for the same manga as different entries
   * @default true
   * @example
   * ```js
   * // multipleLangsOnSameEntry = false
   * manga_from_mangadex = { title: 'A', url: `/manga/xyz`, langs: ['en', 'jp'] }
   *
   * // multipleLangsOnSameEntry = true
   * manga_from_tachidesk = { title: 'B', url: `/manga/yz`, langs: ['en'] }
   * manga_from_tachidesk2 = { title: 'B', url: `/manga/xyz`, langs: ['jp'] }
   * ```
   */
   entryLanguageHasItsOwnURL: boolean,
  /**
   * Mirror specific option
   * @example { adult: true, lowres: false }
   */
  options: Record<string, unknown>,
    /** Meta information */
    meta: {
      /**
       * quality of scans
       *
       * Number between 0 and 1
       */
      quality: number,
      /**
       * Speed of releases
       *
       * Number between 0 and 1
       */
      speed: number,
      /**
       * Mirror's popularity
       *
       * Number between 0 and 1
       */
      popularity: number,
    };
}
