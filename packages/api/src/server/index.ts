import mirrors from '../models/exports';
import { Server as ioServer } from 'socket.io';
import { TokenDatabase } from '../db/tokens';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import type { ExtendedError } from 'socket.io/dist/namespace';
import type { ServerToClientEvents, socketInstance } from './types';
import type { ClientToServerEvents } from '../client/types';
import { getAllCacheFilesAndSize, removeAllCacheFiles } from './helpers';

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
    this.db = new TokenDatabase({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
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

        // connect if the token is valid
        const findAccess = this.db.findAccessToken(socket.handshake.auth.token);
        if(!findAccess) return this.unauthorize({socket, next});
        if(!this.db.isExpired(findAccess)) return this.authorize({socket, next});

        // if not, check refresh token validity
        if(!socket.handshake.auth.refreshToken) return this.unauthorize({socket, next});
        const findRefresh = this.db.findRefreshToken(socket.handshake.auth.refreshToken);
        if(!findRefresh) {
          this.db.removeAccessToken(findAccess);
          return this.unauthorize({socket, next});
        }
        if(this.db.isExpired(findRefresh)) {
          this.db.removeRefreshToken(findRefresh);
          return this.unauthorize({socket, next});
        }
        if(!this.db.areParent(findRefresh, findAccess)) {
          this.db.removeAccessToken(findAccess);
          this.db.removeRefreshToken(findRefresh);
          return this.unauthorize({socket, next});
        }

        // if the refresh token is valid, we can update the access token
        this.db.removeAccessToken(findAccess);
        const authorized = this.db.generateAccess(findRefresh);
        return this.authorize({
          socket,
          next,
          emit:[ {event:'token', payload:authorized.token} ],
        });
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
    socket.on('getMirrors', (showdisabled, callback) => {
      if(showdisabled) return callback(mirrors.map(m => m.mirrorInfo));
      return callback(mirrors.map(m => m.mirrorInfo).filter(m => m.enabled));
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

    socket.on('changeSettings', (mirror, opts, callback) => {
      mirrors.find(m=>m.name === mirror)?.changeSettings(opts);
      callback(mirrors.map(m => m.mirrorInfo));
    });

    socket.on('getCacheSize', callback => {
      const { size, files } = getAllCacheFilesAndSize();
      callback(size, files);
    });

    socket.on('emptyCache', files => removeAllCacheFiles(files));

  }
}

