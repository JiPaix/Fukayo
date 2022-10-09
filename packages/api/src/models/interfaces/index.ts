import type { SchedulerClass } from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
/** Interface for Mirror classes */
export default interface MirrorInterface {
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
  search(query: string, langs: mirrorsLangsType[] ,socket:socketInstance|SchedulerClass, id:number): void;
  /**
   * Get manga infos (title, authors, tags, chapters, covers, etc..)
   * @param url Relative url to the manga page
   * @param langs ISO-639-1 language code
   * @param socket the request initiator
   * @param id arbitrary id
   */
  manga(url:string, langs:mirrorsLangsType[], socket:socketInstance|SchedulerClass, id:number): void;
  /**
   * Get all images from chapter
   * @param link Relative url of chapter page (any page)
   * @param lang requested language
   * @param socket the request initiator
   * @param id arbitrary id
   * @param callback callback function to tell the client how many pages to expect
   * @param retryIndex If you don't need the whole chapter, you can pass the index of the page you want to start from (0-based)
   */
  chapter(link:string, lang:mirrorsLangsType, socket:socketInstance, id:number, callback?: (nbOfPagesToExpect:number)=>void, retryIndex?:number): void;

  markAsRead?(mangaURL:string, lang:mirrorsLangsType, chapterURLs:string[], read:boolean): void;
  /**
   *
   * @param socket the request initiator
   * @param id arbitrary id
   */
  recommend(socket:socketInstance, id:number): void;

  mangaFromChapterURL(socket:socketInstance, id:number, url: string, lang?:mirrorsLangsType): void;
// eslint-disable-next-line semi
}
