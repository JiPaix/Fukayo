import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage, MangaErrorMessage, RecommendErrorMessage, SearchErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaPage } from '../../../../api/src/models/types/manga';
import type { SearchResult } from '../../../../api/src/models/types/search';
import type { TaskDone } from '../../../../api/src/models/types/shared';

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
  return (res as MangaPage).name !== undefined;
}
