import type { mirrorInfo } from './../../types/shared';
import type { ChapterPage } from '../../types/chapter';
import type { ChapterErrorMessage, ChapterPageErrorMessage } from '../../types/errorMessages';
import type { socketInstance } from '../../../routes';

export type MirrorConstructor = {
  /**
   * slug name of mirror
   */
  name: string,
  /**
   * display name
   */
  displayName: string,
  /**
   * mirror url
   */
  host: string,
  /**
   * is the mirror enabled?
   */
  enabled: boolean,

  /**
   * mirror icon (import)
   */
  icon: string

  /**
   * languages supported by this mirror
   */
  langs: string[],
  /**
   * Time to wait in ms between requests
   */
  waitTime?: number,

  options?: Record<string, unknown>

}

export default interface MirrorInterface {
  /**
   * Initialize the mirror
   */
  enabled: boolean;
  /**
   * Mirror full name
   * @example "Manwha "
   */
  displayName: string;
  /**
   * Mirror name slug
   *
   * This is used to generate the mirror route
   * @example
   * ✅ name: 'my_awesome-mirror'
   * ❌ name: 'My Awesome Mirror ©☆'
   */
  name: string;
  /**
   * Mirror website
   * @important no trailing slash
   * @example
   *  ✅ host = 'https://mangadex.org'
   *  ❌ host = 'https://mangadex.org/'
   */
  host: string;
  /**
   * Mirror Language
   * @important make sure the language is localized in the renderer
   */
  langs: string[];
  /**
   * list of options
   */
  options?: { [key:string]: unknown };
  /**
   * Time to wait in ms between requests
   */
  waitTime: number;
  /**
   * The icon of the mirror
   */
  get icon(): string;

  /**
   * Mirror informations
   */
  get mirrorInfo(): mirrorInfo;
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
   * Returns manga information and chapters
   * @param {String} url url to manga page
   * @param {String} lang requested language
   * @param {socketInstance} socket the request initiator
   * @param {Number} id arbitrary id
   * @example
   * this.manga("/mangas/one-piece/")
   * //=> https://{mirror.host}/mangas/one-piece/
   */
  manga(url:string, lang:string, socket:socketInstance, id:number): void;

  /**
   * Returns all images from chapter
   * @param link Relative url of chapter page (any page)
   */
  chapter(link: string): Promise<(ChapterPage|ChapterPageErrorMessage)[] | ChapterErrorMessage>

  /**
   * Same as chapter() but for a specific page
   * @param link Relative url of the chapter page
   * @param index the page index, starting from 0
   */
   retryChapterImage(link: string, index:number): Promise<ChapterPage | ChapterPageErrorMessage>
// eslint-disable-next-line semi
}
