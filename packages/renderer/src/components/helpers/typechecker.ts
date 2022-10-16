import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage, RecommendErrorMessage, SearchErrorMessage } from '@api/models/types/errors';
import type { SearchResult } from '@api/models/types/search';
import type { TaskDone } from '@api/models/types/shared';
export { isManga, isMangaInDB } from '@api/db/helpers';

export function isChapterImage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterImage {
  return (res as ChapterImage).index !== undefined && (res as ChapterImage).src !== undefined && (res as ChapterImage).lastpage !== undefined;
}

export function isChapterErrorMessage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterErrorMessage {
  return (res as ChapterImage).index === undefined && (res as ChapterImageErrorMessage).error !== undefined;
}

export function isChapterImageErrorMessage(res: ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage): res is ChapterImageErrorMessage {
  return (res as ChapterImage).src === undefined && (res as ChapterImageErrorMessage).error !== undefined && (res as ChapterImageErrorMessage).index !== undefined;
}

export function isSearchResult(res: SearchResult | SearchResult[] | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is SearchResult {
  return (res as SearchResult).url !== undefined;
}

export function isTaskDone(res: SearchResult | SearchResult[] | SearchErrorMessage | RecommendErrorMessage | TaskDone): res is TaskDone {
  return (res as TaskDone).done !== undefined;
}

