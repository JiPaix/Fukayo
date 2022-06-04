import type { SchedulerClass } from './../../server/helpers/scheduler';
import type { mirrorInfo } from '../types/shared';
import type { socketInstance } from '../../server/types';

/** Interface for Mirror classes */
export default interface MirrorInterface {
  /**
   * Whether the mirror is enabled
   */
  get enabled(): boolean;
  /** full name */
  displayName: string;
  /** slug name */
  name: string;
  /**
   * hostname without ending slash
   * @example 'https://www.mirror.com'
   */
  host: string;
  /** alternative hostnames were the site can be reached */
  althost: string[]
  /**
   * Languages supported by the mirror
   *
   * ISO 639-1 codes
   */
  langs: string[];
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
  }
  /**
   * Time to wait in ms between requests
   */
  waitTime: number;
  /**
   * The icon in base 64 data string
   * @example "data:image/png;base64,..."
   */
  get icon(): string;

  /**
   * Mirror informations
   */
  get mirrorInfo(): mirrorInfo;
  /** Change the mirror settings */
  changeSettings(options: Record<string, unknown>): void;
  /**
   * Test if url is a manga page
   */
  isMangaPage(url:string): boolean;

  /**
   * Test if url is a chapter page
   */
  isChapterPage(url:string): boolean;

  /**
   * Optional: get volume, chapter number and chapter name from string
   */
  getChapterInfoFromString?(str:string): RegExpExecArray | null

  /**
   * Search manga by name
   * @param {String} query Search string
   * @param {socketInstance} socket user socket
   * @param {Number} id request's uid
   */
  search(query: string, socket:socketInstance, id:number): void;
  /**
   * Get manga info from
   * @param {String} url Relative url to the manga page
   * @param {String} lang ISO-639-1 language code
   * @param {socketInstance} socket the request initiator
   * @param {Number} id arbitrary id
   */
  manga(url:string, lang:string, socket:socketInstance|SchedulerClass, id:number): void;
  /**
   * Get all images from chapter
   * @param link Relative url of chapter page (any page)
   * @param lang requested language
   * @param socket the request initiator
   * @param id arbitrary id
   * @param callback callback function to tell the client how many pages to expect
   * @param retryIndex If you don't need the whole chapter, you can pass the index of the page you want to start from (0-based)
   */
  chapter(link:string, lang:string, socket:socketInstance, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number): void;

  /**
   *
   * @param socket the request initiator
   * @param id arbitrary id
   */
  recommend(socket:socketInstance, id:number): void;

  mangaFromChapterURL(socket:socketInstance, id:number, url: string, lang?:string): void;
// eslint-disable-next-line semi
}
