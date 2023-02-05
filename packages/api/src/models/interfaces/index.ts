import type Importer from '@api/models/imports/abstracts';
import type Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';

/** Interface for Mirror classes */
export default interface MirrorInterface {
  /**
   * log-in the mirror
   */
  login?(): Promise<boolean|void>
  /**
   * Test if url is a manga page
   */
  isMangaPage(url:string): boolean;

  /**
   * Test if url is a chapter page
   */
  isChapterPage(url:string): boolean;

  /**
   * Search manga by name
   * @param {String} query Search string
   * @param {socketInstance} socket user socket
   * @param {Number} id request's uid
   */
  search(query: string, requestLangs: mirrorsLangsType[] ,socket:socketInstance|Scheduler|Importer, id:number): void;
  /**
   * Get manga infos (title, authors, tags, chapters, covers, etc..)
   * @param url Relative url to the manga page
   * @param langs ISO-639-1 language code
   * @param socket the request initiator
   * @param id arbitrary id
   */
  manga(url:string, requestLangs: mirrorsLangsType[], socket:socketInstance|Scheduler, id:number): void;
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
  recommend(requestLangs: mirrorsLangsType[], socket:socketInstance, id:number): void;
// eslint-disable-next-line semi, @typescript-eslint/no-extra-semi
};
