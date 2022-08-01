import type { supportedLangs } from '../../../../renderer/src/locales/lib/supportedLangs';

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
  langs:string[] | typeof supportedLangs,
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
