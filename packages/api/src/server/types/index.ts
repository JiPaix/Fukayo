import type { Socket } from 'socket.io';
import type { ChapterImage } from '../../models/types/chapter';
import type { SearchErrorMessage, RecommendErrorMessage, MangaErrorMessage, ChapterImageErrorMessage, ChapterErrorMessage } from '../../models/types/errors';
import type { MangaInDB, MangaPage } from '../../models/types/manga';
import type { SearchResult } from '../../models/types/search';
import type { TaskDone } from '../../models/types/shared';
import type { ClientToServerEvents } from '../../client/types';

export type ServerToClientEvents = {
  authorized: () => void;
  unauthorized: () => void;
  token: (acessToken: string) => void;
  refreshToken: (acessToken: string) => void;
  searchInMirrors: (id:number, mangas:SearchResult|SearchErrorMessage|TaskDone) => void;
  showManga: (id:number, manga:MangaPage|MangaInDB|MangaErrorMessage) =>void
  showChapter: (id:number, chapter:ChapterImage|ChapterImageErrorMessage|ChapterErrorMessage) => void;
  showRecommend: (id:number, mangas:SearchResult|RecommendErrorMessage|TaskDone) => void;
  showLibrary: (id:number, manga:MangaInDB) => void;
  getMangaURLfromChapterURL: (id:number, infos: { mirror:string, lang:string, url:string } | undefined) => void;
  finishedMangasUpdate: () => void;
  startMangasUpdate: () => void;
}

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>
