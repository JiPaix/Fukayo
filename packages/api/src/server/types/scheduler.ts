import type { MangaInDB } from '@api/models/types/manga';
import type { mirrorsLangsType } from '@i18n';

type MangaLogs = {
  /** date of log */
  date: number,
  /** message */
  message: string,
  /** manga id */
  id: string
}

export type LogChapterError = MangaLogs & {
  message: 'log_chapter_error'
  /** error message */
  data: string
}

export type LogChapterNew = MangaLogs & {
  message: 'log_chapter_new',
  data: MangaInDB['chapters'][0]
}

export type LogChapterRead = MangaLogs & {
  message: 'log_chapter_read',
  data: MangaInDB['chapters'][0]
}


export type LogMangaNewMetadata = MangaLogs & {
  message: 'log_manga_metadata',
  data: {
    tag: 'name' | 'langs' | 'synopsis' | 'authors' | 'covers' | 'tags' | 'status'
    oldVal?: string  | string[] | mirrorsLangsType[]
    newVal?: string  | string[] | mirrorsLangsType[]
  }
}
