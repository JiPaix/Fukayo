import type { MangaErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { LogChapterError, LogChapterNew, LogChapterRead, LogMangaNewMetadata } from '@api/server/types/scheduler';

export function isMangaInDB(res: MangaPage | MangaInDB | MangaErrorMessage): res is MangaInDB {
  return (res as MangaInDB).inLibrary === true && (res as MangaInDB).meta !== undefined;
}

export function isManga(res: MangaPage | MangaErrorMessage | MangaInDB | unknown): res is MangaPage|MangaInDB {
  return (res as MangaPage).inLibrary !== undefined;
}

export function isMangaPage(res: unknown): res is MangaPage {
  return (res as MangaPage).inLibrary == false;
}

export function isMangaLog(res: unknown): res is LogChapterNew|LogChapterRead|LogMangaNewMetadata|LogChapterError {
  const x = res as LogChapterNew|LogChapterRead|LogMangaNewMetadata|LogChapterError;
  if(x.message === 'log_chapter_new') return true;
  if(x.message === 'log_chapter_read') return true;
  if(x.message === 'log_manga_metadata') return true;
  if(x.message === 'log_chapter_error') return true;
  return false;

}

export function isLogChapterError(res: unknown): res is LogChapterError {
  return (res as LogChapterError).message === 'log_chapter_error';
}

export function isLogChapterNew(res: unknown): res is LogChapterNew {
  return (res as LogChapterNew).message === 'log_chapter_new';
}

export function isLogChapterRead(res: unknown): res is LogChapterRead {
  return (res as LogChapterRead).message === 'log_chapter_read';
}

export function isLogMangaNewMetadata(res: unknown): res is LogMangaNewMetadata {
  return (res as LogMangaNewMetadata).message === 'log_manga_metadata';
}
