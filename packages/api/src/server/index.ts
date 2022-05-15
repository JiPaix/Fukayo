import mirrors from '../models/exports';
import { env } from 'node:process';
import { resolve } from 'node:path';
import { Server as ioServer } from 'socket.io';
import { TokenDatabase } from '../db/tokens';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import type { ExtendedError } from 'socket.io/dist/namespace';
import type { ServerToClientEvents, socketInstance } from './types';
import type { ClientToServerEvents } from '../client/types';

/**
 * Initialize a socket.io server
 */
export default class IOWrapper {

  io: ioServer<ClientToServerEvents, ServerToClientEvents>;
  login:string;
  password:string;
  db:TokenDatabase;
  constructor(runner: HttpServer | HttpsServer, CREDENTIALS: {login: string, password: string}, tokens: {accessToken: string, refreshToken: string}) {
    this.login = CREDENTIALS.login;
    this.password = CREDENTIALS.password;
    this.io = new ioServer(runner, {cors: { origin: '*'}});
    this.db = new TokenDatabase(resolve(env.USER_DATA, 'access_db.json'), { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    this.use();
    this.io.on('connection', this.routes.bind(this));
  }

  authorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void, emit?: {event: 'token'|'refreshToken', payload:string}[]}) {
    if(!o.socket.rooms.has('authorized')) {
      o.socket.join('authorized');
      o.socket.emit('authorized');
    }
    if(o.emit) o.emit.forEach(e => o.socket.emit(e.event, e.payload));
    this.db.write();
    o.next();
  }

  unauthorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void }) {
    o.socket.emit('unauthorized');
    o.socket.disconnect();
    this.db.write();
    o.next();
  }

  use() {
    this.io.use((socket, next) => {
      // use token to authenticate
      if(socket.handshake.auth.token) {
        const findAccess = this.db.findAccessToken(socket.handshake.auth.token);
        // if there's an access token and it's not expired
        if(findAccess) {
          if(!this.db.isExpired(findAccess)) {
            return this.authorize({socket, next});
          }
        }
        // if there's no refresh token
        if(!socket.handshake.auth.refreshToken) return next(new Error('no_refresh_token'));

        const findRefresh = this.db.findRefreshToken(socket.handshake.auth.refreshToken);
        // if there's a refresh token
        if(findRefresh) {
          // and it's not expired
          if(!this.db.isExpired(findRefresh)) {
            // if an access token exists and it's parent is the same as the refresh token
            if(findAccess && this.db.areParent(findRefresh, findAccess)) {
              // remove the old access token
              this.db.spliceAccessToken(this.db.data.authorizedTokens.indexOf(findAccess), 1);
              // generate a new access token
              const authorized = this.db.generateAccess(findRefresh);
              return this.authorize({
                socket,
                next,
                emit:[ {event:'token', payload:authorized.token} ],
              });
            }
          }
          // but if the refresh token is expired
          // remove all authorizedTokens where parent is the refreshToken
          this.db.spliceAccessToken(this.db.data.authorizedTokens.findIndex(t => t.parent === findRefresh.token), 1);
        }
        // if there's no refresh token or it is expired, but there's an access token
        if(findAccess) {
          // remove the refresh token matching the access token parent
          this.db.spliceRefreshToken(this.db.data.refreshTokens.findIndex(t => t.token === findAccess.parent), 1);
          // remove all access tokens with the same parent
          this.db.spliceAccessToken(this.db.data.authorizedTokens.findIndex(t => t.parent === findAccess.parent), 1);
        }
        return this.unauthorize({socket, next});
      }
      else if(socket.handshake.auth.login && socket.handshake.auth.password) {
        if(socket.handshake.auth.login === this.login && socket.handshake.auth.password === this.password) {
          // generate tokens
          const refresh = this.db.generateRefresh();
          const authorized = this.db.generateAccess(refresh);

          return this.authorize({
            socket,
            next,
            emit: [ { event: 'token', payload: authorized.token}, { event: 'refreshToken', payload: refresh.token } ],
          });

        }
      }
      return this.unauthorize({socket, next});
    });
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

    /**
     * Show a manga page
     */
    socket.on('showManga', (id, mirror, lang, url) => {
      // before that we should check if the manga is in database
      // TODO
      mirrors.find(m=> m.name === mirror)?.manga(url, lang, socket, id);
    });

    /**
     * Show chapters pages
     */
    socket.on('showChapter', (id, mirror, lang, url, callback: (nbOfPagesToExpect:number)=>void, retryIndex?:number) => {
      mirrors.find(m=>m.name === mirror)?.chapter(url, lang, socket, id, callback, retryIndex);
    });

    socket.on('showRecommend', (id, mirror) => {
      mirrors.find(m=>m.name === mirror)?.recommend(socket, id);
    });
  }


}
