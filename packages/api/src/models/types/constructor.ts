export type MirrorConstructor = {
  /** slug name: `az-_` */
  name: string,
  /** full name */
  displayName: string,
  /**
   * hostname without ending slash
   * @example 'https://www.mirror.com'
   */
  host: string,
  /**
   * Whether the mirror is enabled
   */
  enabled: boolean,
  /**
   * mirror icon (import)
   * @example
   * import icon from './my-mirror.png';
   * opts.icon = icon;
   */
  icon: string
  /**
   * Languages supported by the mirror
   *
   * ISO 639-1 codes
   */
  langs: string[],
  /**
   * Time to wait in ms between requests
   */
  waitTime?: number,
  /**
   * Mirror specific option
   * @example { adult: true, lowres: false }
   */
  options?: Record<string, unknown>
  /**
   * Enable/disable cache
   */
  cache: boolean
}
