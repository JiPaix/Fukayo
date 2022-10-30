import type SettingsDB from '@api/db/settings';
import type Importer from '@api/models/imports/interfaces';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { mirrorInfo } from '@api/models/types/shared';
import type Scheduler from '@api/server/scheduler';
import type { ServerToClientEvents } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import type { Socket } from 'socket.io-client';

export type SocketClientConstructor = {
  accessToken?: string | null,
  refreshToken?: string | null,
  ssl: 'false' | 'provided' | 'app',
  port: number,
}

export type LoginAuth = { login: string, password:string }


export type ClientToServerEvents = {
  getMirrors: (showdisabled:boolean, callback: (m: mirrorInfo[]) => void) => void;
  getImports: (showdisabled:boolean, callback: (m: Importer['showInfo'][]) => void) => void
  searchInMirrors: (query:string, id:number, mirrors: string[], langs:mirrorsLangsType[], callback: (nbOfDonesToExpect:number)=>void) => void;
  stopSearchInMirrors: () => void;
  stopShowManga: () => void;
  stopShowChapter: () => void;
  stopShowRecommend: () => void;
  stopShowLibrary: () => void;
  showManga: (id:number, opts: {mirror?:string, langs:mirrorsLangsType[], id?:string, url?:string }) => void;
  showChapter: (id:number, opts: { mangaId:string, chapterId: string, url?:string, mirror:string, lang:mirrorsLangsType, retryIndex?:number }, callback?: (nbOfPagesToExpect:number)=>void) => void;
  showRecommend: (id:number, mirror:string) => void;
  changeMirrorSettings: (mirror:string, options:Record<string, unknown>, callback: (m: mirrorInfo[])=>void) => void;
  getCacheSize: (callback: (size: number, files:number) => void) => void;
  emptyCache: (files?:string[]) => void;
  addManga: ( payload: { manga:MangaPage|MangaInDB, settings?:MangaInDB['meta']['options'] }, callback:(dbManga: MangaInDB)=>void) => void;
  removeManga: (dbManga:MangaInDB, lang:mirrorsLangsType, callback:(manga: MangaPage)=>void) => void;
  showLibrary:(id:number) => void;
  forceUpdates: () => void;
  isUpdating: (callback:(isUpdating:boolean)=>void) => void;
  schedulerLogs: (callback:(logs:Scheduler['logs'])=>void) => void;
  getSettings: (callback:(settings:SettingsDB['data'])=>void) => void;
  changeSettings: (settings:SettingsDB['data'], callback:(settings:SettingsDB['data'])=>void) => void;
  markAsRead: ({ mirror, lang, url, chapterUrls, read, mangaId }: { mirror:string, lang:mirrorsLangsType, url:string, chapterUrls:string[], read:boolean, mangaId:string }) => void;
  showImports: (id:number, mirrorName: string, langs:mirrorsLangsType[]) => void;
  stopShowImports: () => void;
}

export type socketClientInstance = Socket<ServerToClientEvents, ClientToServerEvents>
