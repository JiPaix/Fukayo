import type { MangaInDB } from '@api/models/types/manga';

type ServerSettings = {
  /** user's login */
  login: string,
  /** user's password */
  password: string|null,
  /** application port */
  port: number,
  /**
   * - 'false' = no ssl
   * - 'provided' = user's provided cert and keys
   * - 'app' = generated cert
   */
  ssl: 'false'|'provided'|'app'
  /**
   * hostname (required for https)
   */
  hostname: string,
  /** ssl cert */
  cert: string|null
  /** ssl key */
  key: string|null
  /** API access token */
  accessToken: string|null
  /** API refresh token */
  refreshToken: string|null
  /** Automatically start server if credentials are filled */
  autostart: boolean
}

type MangaPageSettings = {
  /** chapters settings */
  chapters : {
    /** sort asc-desc */
    sort: 'ASC' | 'DESC',
    /** hide read chapters */
    hideRead: boolean
    /** enable komga experimental parsing */
    KomgaTryYourBest: string[],
    /** list of ignored scanlators */
    scanlators : {
      ignore: {
        /** manga id */
        id: string,
        /** scanlator's name */
        name: string
      }[]
    }
  }
}

type ReaderSettings = MangaInDB['meta']['options']

type LibrarySettings = {
  /** Only display entries with unread chapters */
  showUnread: boolean,
  /**
   * Library page's entries sorting
   * - AZ
   * - ZA
   * - unread = most unread first
   * - read = most read first
   */
  sort: 'AZ' | 'ZA' | 'unread' | 'read',
  /**
   * Displays the step by step guide
   * - 1 = step 1
   * - 2 = step 2
   * - 3 = complete
   */
  firstTimer: 1 | 2 | 3
}

export type Settings = {
  /** color scheme */
  theme: 'dark' | 'light'
  /** server settings */
  server: ServerSettings
  /** Manga Page settings */
  mangaPage: MangaPageSettings
  /** Reader's settings */
  reader: ReaderSettings,
  /** Reader's global settings */
  readerGlobal: {
    preloadNext: boolean,
    pinRightDrawer: boolean,
  }
  /** Library settings */
  library: LibrarySettings,
}
