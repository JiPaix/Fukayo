export interface MangaPage {
  /**
   * ID of the manga
   * @example 'mirror_name/manga_lang/relative-url-of-manga'
   */
  id: string
  /**
   * Relative url of the manga (with leading slash)
   *
   * @example '/manga/manga-name'
   */
  url:string,
  /**
   * Language of the manga
   *
   * ISO 639-1 codes
   */
  lang: string,
  /** Manga's full name */
  name: string,
  /** Custom manga's name defined by user */
  displayName?: string,
  /**
   * Array of covers in base64 data string
   *
   * @example ["data:image/png;base64,...", "data:image/png;base64,..."]
   */
  covers: string[],
  /** Summary */
  synopsis?: string,
  /** Tags */
  tags:string[],
  /** Authors */
  authors: string[],
  /** Is the manga saved in db */
  inLibrary: boolean
  /** chapters */
  chapters: {
    /**
     * ID of the chapter
     * @example 'manga_id/relative-url-of-chapter'
     */
    id: string,
    /**
     * Chapter's relative URL
     * @example '/manga/manga-name/chapter-name'
     */
    url: string
    /** fetch date */
    date: number
    /**
     * Chapter number (float) or position in the list
     *
     * position is used if the chapter is not numbered (or not available)
     */
    number: number
    /** Chapter's name */
    name?: string
    /**
     * Chapter's volume number
     */
    volume?: number
    /**
     * Scanlator's name
     *
     * to use if mirror can provide the same chapter from multiple scanlators
     */
    group?: string|number
    /**
     * Chapter's read status
     *
     * reset to false if the chapter is reloaded without being in the library
     */
    read: boolean
  }[]
  /** mirror name */
  mirror: string
}

export interface MangaInDB extends MangaPage {
  chapters : (MangaPage['chapters'][0])[]
  meta : {
    /** the last read chapter id */
    lastReadChapterId?: string,
    /** last time chapters list has been updated */
    lastUpdate: number,
    /** notify user when new chapter is out */
    notify: boolean,
    /** should the manga chapters list be updated  */
    update: boolean,
    options: {
      webtoon: boolean,
      showPageNumber: boolean,
      zoomMode: 'auto' | 'fit-width' | 'fit-height' | 'custom',
      zoomValue: number,
      longStrip:boolean,
    }
  }
}
