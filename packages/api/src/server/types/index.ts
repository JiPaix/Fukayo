import type { Socket } from 'socket.io';
import type { ChapterPage } from '../../models/types/chapter';
import type { SearchErrorMessage, RecommendErrorMessage, MangaErrorMessage, ChapterPageErrorMessage, ChapterErrorMessage } from '../../models/types/errors';
import type { MangaPage } from '../../models/types/manga';
import type { SearchResult } from '../../models/types/search';
import type { TaskDone } from '../../models/types/shared';
import type { ClientToServerEvents } from '../../client/types';

export interface ServerToClientEvents {
  authorized: () => void;
  unauthorized: () => void;
  token: (acessToken: string) => void;
  refreshToken: (acessToken: string) => void;
  searchInMirrors: (id:number, mangas:SearchResult|SearchErrorMessage|TaskDone) => void;
  showManga: (id:number, manga:MangaPage|MangaErrorMessage) =>void
  showChapter: (id:number, chapter:ChapterPage|ChapterPageErrorMessage|ChapterErrorMessage) => void;
  showRecommend: (id:number, mangas:SearchResult|RecommendErrorMessage|TaskDone) => void;
}

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>
