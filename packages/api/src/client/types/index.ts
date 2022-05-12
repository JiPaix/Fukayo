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
  getMirrors: (callback: (m: mirrorInfo[]) => void) => void;
  searchInMirrors: (query:string, id:number, mirrors: string[], langs:string[], callback: (nbOfDonesToExpect:number)=>void) => void;
  stopSearchInMirrors: () => void;
  stopShowManga: () => void;
  stopShowChapter: () => void;
  showManga: (id:number, mirror:string, lang:string, url:string) => void;
  showChapter: (id:number, mirror:string, lang:string, url:string, callback: (nbOfPagesToExpect:number)=>void, retryIndex?:number) => void;
}

export type socketClientInstance = Socket<ServerToClientEvents, ClientToServerEvents>
