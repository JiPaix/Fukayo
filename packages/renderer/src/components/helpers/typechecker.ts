import type { ChapterPage } from '../../../../api/src/mirrors/types/chapter';
import type { ChapterErrorMessage, ChapterPageErrorMessage, MangaErrorMessage, SearchErrorMessage } from '../../../../api/src/mirrors/types/errorMessages';
import type { MangaPage } from '../../../../api/src/mirrors/types/manga';
import type { SearchResult } from '../../../../api/src/mirrors/types/search';
import type { TaskDone } from '../../../../api/src/mirrors/types/shared';

export function isChapterPage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterPage {
  return (res as ChapterPage).index !== undefined;
}

export function isChapterErrorMessage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterErrorMessage {
  return (res as ChapterPage).index !== undefined;
}

export function isChapterPageErrorMessage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterPageErrorMessage {
  return (res as ChapterPage).src === undefined;
}

export function isSearchResult(res: SearchResult | SearchErrorMessage | TaskDone): res is SearchResult {
  return (res as SearchResult).link !== undefined;
}

export function isTaskDone(res: SearchResult | SearchErrorMessage | TaskDone): res is TaskDone {
  return (res as TaskDone).done !== undefined;
}

export function isManga(res: MangaPage | MangaErrorMessage): res is MangaPage {
  return (res as MangaPage).name !== undefined;
}
