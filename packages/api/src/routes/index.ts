import type { Socket } from 'socket.io';
import { Server as ioServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import crypto from 'crypto';
import mirrors from '../mirrors';
import type { SearchResult } from '../mirrors/types/search';
import type { SearchErrorMessage } from '../mirrors/types/errorMessages';
import type { mirrorInfo, TaskDone } from '../mirrors/types/shared';
import type { ExtendedError } from 'socket.io/dist/namespace';
export interface ServerToClientEvents {
  authorized: () => void;
  unauthorized: () => void;
  token: (acessToken: string) => void;
  refreshToken: (acessToken: string) => void;
  searchInMirrors: (id:number, manga:SearchResult|SearchErrorMessage|TaskDone) => void;
}

export interface ClientToServerEvents {
  getMirrors: (callback: (m: {name:string, displayName: string, host:string, enabled:boolean, icon:string, langs:string[]}[]) => void) => void;
  searchInMirrors: (query:string, id:number, mirrors: string[], langs:string[], callback: (nbOfDonesToExpect:number)=>void) => void;
  stopSearchInMirrors: () => void;
}

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>

export default class IOWrapper {

  io: ioServer<ClientToServerEvents, ServerToClientEvents>;
  login:string;
  password:string;
  authorizedTokens:{token: string, expire: number, parent:string}[] = [];
  refreshTokens:{token: string, expire: number}[] = [];

  constructor(runner: HttpServer | HttpsServer, CREDENTIALS: {login: string, password: string}, tokens: {accessToken: string, refreshToken: string}) {
    this.login = CREDENTIALS.login;
    this.password = CREDENTIALS.password;
    this.io = new ioServer(runner, {cors: { origin: '*'}});
    this.refreshTokens.push({token: tokens.refreshToken, expire: Date.now() + (7 * 24 * 60 * 60 * 1000)});
    this.authorizedTokens.push({token: tokens.accessToken, expire: Date.now() + (5 * 60 * 1000), parent: tokens.refreshToken});
    this.use();
    this.io.on('connection', this.routes);
  }

  authorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void, emit?: {event: 'token'|'refreshToken', payload:string}[]}) {
    if(!o.socket.rooms.has('authorized')) {
      o.socket.join('authorized');
      o.socket.emit('authorized');
    }
    if(o.emit) o.emit.forEach(e => o.socket.emit(e.event, e.payload));
    return o.next();
  }

  unauthorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void }) {
    o.socket.emit('unauthorized');
    o.socket.disconnect;
    o.next();
  }
  use() {
    this.io.use((socket, next) => {
      // use token to authenticate
      if(socket.handshake.auth.token) {
        const findAccess = this.authorizedTokens.find(t => t.token === socket.handshake.auth.token);
        // if there's an access token and it's not expired
        if(findAccess) {
          if(findAccess.expire > Date.now()) {
            return this.authorize({socket, next});
          }
        }
        // if there's no refresh token
        if(!socket.handshake.auth.refreshToken) return next(new Error('no_refresh_token'));

        const findRefresh = this.refreshTokens.find(t => t.token === socket.handshake.auth.refreshToken);
        // if there's a refresh token
        if(findRefresh) {
          // and it's not expired
          if(findRefresh.expire > Date.now()) {
            // if an access token exists and it's parent is the same as the refresh token
            if(findAccess && findAccess.token === findRefresh.token) {
              // generate a new access token
              this.authorizedTokens.splice(this.authorizedTokens.indexOf(findAccess), 1);
              const token = crypto.randomBytes(32).toString('hex');
              const in5minutes = Date.now() + (5 * 60 * 1000);
              this.authorizedTokens.push({token, expire: in5minutes, parent: findRefresh.token});
              return this.authorize({
                socket,
                next,
                emit:[ {event:'token', payload:token} ],
              });
            }
          }
          // but if the refresh token is expired
          // remove all authorizedTokens where parent is the refreshToken
          this.authorizedTokens.splice(this.authorizedTokens.findIndex(t => t.parent === findRefresh.token), 1);
        }
        // if there's no refresh token or it is expired, but there's an access token
        if(findAccess) {
          // remove the refresh token matching the access token parent
          this.refreshTokens.splice(this.refreshTokens.findIndex(t => t.token === findAccess.parent), 1);
          // remove all access tokens with the same parent
          this.authorizedTokens.splice(this.authorizedTokens.findIndex(t => t.parent === findAccess.parent), 1);
        }
        return this.unauthorize({socket, next});
      }
      else if(socket.handshake.auth.login && socket.handshake.auth.password) {
        if(socket.handshake.auth.login === this.login && socket.handshake.auth.password === this.password) {
          // generate a token with crypto
          const token = crypto.randomBytes(32).toString('hex');
          const refreshToken = crypto.randomBytes(32).toString('hex');
          const in5minutes = Date.now() + (5 * 60 * 1000);
          const in7days = Date.now() + (7 * 24 * 60 * 60 * 1000);
          this.authorizedTokens.push({token, expire: in5minutes, parent: refreshToken});
          this.refreshTokens.push({token: refreshToken, expire: in7days});
          return this.authorize({
            socket,
            next,
            emit: [ { event: 'token', payload: token}, { event: 'refreshToken', payload: refreshToken} ],
          });

        }
      }
      return this.unauthorize({socket, next});
    });
  }

  getMirrors(callback: (m: mirrorInfo[]) => void) {
    callback(mirrors.map(m => {
      return {
        name: m.name,
        displayName: m.displayName,
        host: m.host,
        enabled: m.enabled,
        icon: m.icon,
        langs: m.langs,
      };
    }));
  }

  routes(socket:socketInstance) {
    /** Default Events */
    socket.on('disconnect', () => socket.removeAllListeners());

    /** Routes */

    /**
     * Get all mirrors (enabled or not)
     */
    socket.on('getMirrors', callback => {
      callback(mirrors.map(m => m.mirrorInfo));
    });

    /**
     * Search mangas in enabled mirrors
     */
    socket.on('searchInMirrors', (query, id, selectedMirrors, selectedLangs, callback) => {
      const filtered = mirrors
      .filter(m =>  m.langs.some(l => selectedLangs.includes(l)))
      .filter(m => selectedMirrors.includes(m.name))
      .filter(m => m.enabled);
      callback(filtered.length);
      filtered.forEach(m => m.search(query, socket, id));
    });
  }
}
