import type { MangaInDB, MangaPage } from './../../models/types/manga';
import type { mirrorInfo } from '../../models/types/shared';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents } from '../../server/types';

export type SocketClientConstructor = {
  accessToken?: string | null,
  refreshToken?: string | null,
  ssl: 'false' | 'provided' | 'app',
  port: number,
}

export type LoginAuth = { login: string, password:string }


export interface ClientToServerEvents {
  getMirrors: (showdisabled:boolean, callback: (m: mirrorInfo[]) => void) => void;
  searchInMirrors: (query:string, id:number, mirrors: string[], langs:string[], callback: (nbOfDonesToExpect:number)=>void) => void;
  stopSearchInMirrors: () => void;
  stopShowManga: () => void;
  stopShowChapter: () => void;
  stopShowRecommend: () => void;
  stopShowLibrary: () => void;
  showManga: (id:number, mirror:string, lang:string, url:string) => void;
  showChapter: (id:number, mirror:string, lang:string, url:string, callback: (nbOfPagesToExpect:number)=>void, retryIndex?:number) => void;
  showRecommend: (id:number, mirror:string) => void;
  changeSettings: (mirror:string, options:Record<string, unknown>, callback: (m: mirrorInfo[])=>void) => void;
  getCacheSize: (callback: (size: number, files:string[]) => void) => void;
  emptyCache: (files?:string[]) => void;
  addManga: (manga:MangaPage, callback:(dbManga: MangaInDB)=>void) => void;
  removeManga: (dbManga:MangaInDB, callback:(manga: MangaPage)=>void) => void;
  showLibrary:(id:number) => void;
}

export type socketClientInstance = Socket<ServerToClientEvents, ClientToServerEvents>
