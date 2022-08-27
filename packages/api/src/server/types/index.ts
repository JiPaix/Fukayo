import type { ClientToServerEvents } from '@api/client/types';
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage, MangaErrorMessage, RecommendErrorMessage, SearchErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { SearchResult } from '@api/models/types/search';
import type { TaskDone } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n/index';
import type { Socket } from 'socket.io';

export type ServerToClientEvents = {
  authorized: () => void;
  unauthorized: () => void;
  token: (acessToken: string) => void;
  refreshToken: (acessToken: string) => void;
  searchInMirrors: (id:number, mangas:SearchResult|SearchErrorMessage|TaskDone) => void;
  showManga: (id:number, manga:MangaPage|MangaInDB|MangaErrorMessage) =>void
  showMangas: (id:number, mangas:(MangaInDB | MangaPage | MangaErrorMessage)[]) =>void
  showChapter: (id:number, chapter:ChapterImage|ChapterImageErrorMessage|ChapterErrorMessage) => void;
  showRecommend: (id:number, mangas:SearchResult|RecommendErrorMessage|TaskDone) => void;
  showLibrary: (id:number, manga:MangaInDB) => void;
  getMangaURLfromChapterURL: (id:number, infos: { mirror:string, lang:mirrorsLangsType, url:string } | undefined) => void;
  finishedMangasUpdate: () => void;
  startMangasUpdate: () => void;
}

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>
