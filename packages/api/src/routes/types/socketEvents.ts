import type { ChapterPage } from '../../mirrors/types/chapter';
import type { SearchErrorMessage, MangaErrorMessage, ChapterPageErrorMessage, ChapterErrorMessage } from '../../mirrors/types/errorMessages';
import type { MangaPage } from '../../mirrors/types/manga';
import type { SearchResult } from '../../mirrors/types/search';
import type { TaskDone, mirrorInfo } from '../../mirrors/types/shared';

export interface ServerToClientEvents {
  authorized: () => void;
  unauthorized: () => void;
  token: (acessToken: string) => void;
  refreshToken: (acessToken: string) => void;
  searchInMirrors: (id:number, mangas:SearchResult|SearchErrorMessage|TaskDone) => void;
  showManga: (id:number, manga:MangaPage|MangaErrorMessage) =>void
  showChapter: (id:number, chapter:ChapterPage|ChapterPageErrorMessage|ChapterErrorMessage) => void;
}

export interface ClientToServerEvents {
  getMirrors: (callback: (m: mirrorInfo[]) => void) => void;
  searchInMirrors: (query:string, id:number, mirrors: string[], langs:string[], callback: (nbOfDonesToExpect:number)=>void) => void;
  stopSearchInMirrors: () => void;
  stopShowManga: () => void;
  stopShowChapter: () => void;
  showManga: (id:number, mirror:string, lang:string, url:string) => void;
  showChapter: (id:number, mirror:string, lang:string, url:string, callback: (nbOfPagesToExpect:number)=>void, retryIndex?:number) => void;
}
