import type { ChapterPage } from '../../types/chapter';
import type { SearchErrorMessage, MangaErrorMessage, ChapterErrorMessage, ChapterPageErrorMessage } from '../../types/errorMessages';
import type { MangaPage } from '../../types/manga';
import type { SearchResult } from '../../types/search';

export type MirrorConstructor = {
  /**
   * Time to wait in ms between requests
   */
  waitTime?: number,
  /**
   * mirror icon (import)
   */
  icon: string,
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
   * indicate if the mirror use an headless browser
   */
  headless: boolean;
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
   * Regexes related to mirror:
   */
  regexes: {
    /**
     * Regex to test if the page is a manga page
     */
    manga: RegExp,
    /**
     * Regex to test if the page is a chapter page
     */
    chapter: RegExp,
    /**
     * Regex to capture volume, chapter, and chapter name
     */
    chapter_info: RegExp,
  };
  /**
   * Search manga by name
   * @param {String} query Search string  
   */
  search(query: string): Promise<SearchResult[] | SearchErrorMessage>;
  /**
   * Returns manga information and chapters
   * @param {String} link link to manga page (Relative URL)
   * @example
   * this.manga("/mangas/one-piece/")
   * //=> https://{mirror.host}/mangas/one-piece/
   */
  manga(link:string): Promise<MangaPage| MangaErrorMessage>

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