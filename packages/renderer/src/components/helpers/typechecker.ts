import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage, MangaErrorMessage, RecommendErrorMessage, SearchErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { SearchResult } from '@api/models/types/search';
import type { TaskDone } from '@api/models/types/shared';

export function isChapterImage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterImage {
  return (res as ChapterImage).index !== undefined && (res as ChapterImage).src !== undefined && (res as ChapterImage).lastpage !== undefined;
}

export function isChapterErrorMessage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterErrorMessage {
  return (res as ChapterImage).index === undefined && (res as ChapterImageErrorMessage).error !== undefined;
}

export function isChapterImageErrorMessage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterImageErrorMessage {
  return (res as ChapterImage).src === undefined && (res as ChapterImageErrorMessage).error !== undefined && (res as ChapterImageErrorMessage).index !== undefined;
}

export function isSearchResult(res: SearchResult | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is SearchResult {
  return (res as SearchResult).url !== undefined;
}

export function isTaskDone(res: SearchResult | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is TaskDone {
  return (res as TaskDone).done !== undefined;
}

export function isManga(res: MangaPage | MangaErrorMessage): res is MangaPage {
  return (res as MangaPage).inLibrary === false;
}

export function isMangaInDb(res: MangaPage | MangaInDB | MangaErrorMessage ): res is MangaInDB {
  return (res as MangaInDB).inLibrary === true && (res as MangaInDB).meta !== undefined;
}
