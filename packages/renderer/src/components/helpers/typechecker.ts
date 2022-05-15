import type { ChapterPage } from '../../../../api/src/models/types/chapter';
import type { ChapterErrorMessage, ChapterPageErrorMessage, MangaErrorMessage, RecommendErrorMessage, SearchErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaPage } from '../../../../api/src/models/types/manga';
import type { SearchResult } from '../../../../api/src/models/types/search';
import type { TaskDone } from '../../../../api/src/models/types/shared';

export function isChapterPage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterPage {
  return (res as ChapterPage).index !== undefined;
}

export function isChapterErrorMessage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterErrorMessage {
  return (res as ChapterPage).index !== undefined;
}

export function isChapterPageErrorMessage(res: ChapterPage | ChapterPageErrorMessage | ChapterErrorMessage): res is ChapterPageErrorMessage {
  return (res as ChapterPage).src === undefined;
}

export function isSearchResult(res: SearchResult | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is SearchResult {
  return (res as SearchResult).url !== undefined;
}

export function isTaskDone(res: SearchResult | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is TaskDone {
  return (res as TaskDone).done !== undefined;
}

export function isManga(res: MangaPage | MangaErrorMessage): res is MangaPage {
  return (res as MangaPage).name !== undefined;
}
