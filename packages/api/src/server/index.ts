import crypto from 'node:crypto';
import mirrors from '../models/exports';
import { env } from 'node:process';
import { resolve } from 'node:path';
import { Server as ioServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import type { ExtendedError } from 'socket.io/dist/namespace';
import type { ServerToClientEvents, socketInstance } from './types';
import type { ClientToServerEvents } from '../client/types';


type RefreshToken = {
  token: string,
  expire: number
  master?: boolean
}

type AuthorizedToken = {
  token: string,
  expire: number
  parent: string
  master?: boolean
}

type Tokens = {
  refreshTokens: RefreshToken[],
  authorizedTokens: AuthorizedToken[]
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type LowSync = import('lowdb').LowSync<Tokens>

function isAuthorizedToken(token: RefreshToken | AuthorizedToken): token is AuthorizedToken {
  return (token as AuthorizedToken).parent !== undefined;
}

/**
 * Initialize a socket.io server
 */
export default class IOWrapper {

  io: ioServer<ClientToServerEvents, ServerToClientEvents>;
  login:string;
  password:string;
  db?:LowSync;
  constructor(runner: HttpServer | HttpsServer, CREDENTIALS: {login: string, password: string}, tokens: {accessToken: string, refreshToken: string}) {
    this.login = CREDENTIALS.login;
    this.password = CREDENTIALS.password;
    this.io = new ioServer(runner, {cors: { origin: '*'}});
    const refresh = { token: tokens.refreshToken, expire: Date.now() + 1000 * 60 * 60 * 24 * 7, master: true };
    const authorized = { token: tokens.accessToken, expire: Date.now() + 1000 * 60 * 60 * 24 * 7, parent: refresh.token, master: true };
    this.importdb().then(() => {
      this.initdb(refresh, authorized);
      this.use();
      this.io.on('connection', this.routes.bind(this));
    });
  }

  async importdb() {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const { LowSync, JSONFileSync } = await (eval('import("lowdb")') as Promise<typeof import('lowdb')>);
    const adapter = new JSONFileSync<Tokens>(resolve(env.USER_DATA, 'access_db.json'));
    this.db = new LowSync(adapter);
  }

  initdb(refresh: RefreshToken & { master: boolean }, authorized: AuthorizedToken & { master: boolean }) {
    if(this.db) {
      this.db.read();
      if(this.db.data) {
        // remove expired or master tokens
        this.db.data.authorizedTokens = this.db.data.authorizedTokens.filter(t => t.expire > Date.now() && !t.master);
        this.db.data.refreshTokens = this.db.data.refreshTokens.filter(t => t.expire > Date.now() && !t.master);
        // add new tokens
        this.db.data.authorizedTokens.push(authorized);
        this.db.data.refreshTokens.push(refresh);
      } else {
        this.db.data = { refreshTokens: [refresh], authorizedTokens: [authorized] };
      }
      this.db.write();
    }
  }

  async write(token: RefreshToken | AuthorizedToken, remove?: boolean) {
    if(!this.db) await this.importdb();
    if(this.db) {
      if(!this.db.data) return;
      if(isAuthorizedToken(token)) {
        if(remove) this.db.data.authorizedTokens = this.db.data.authorizedTokens.filter(t => t.token !== token.token);
        else this.db.data.authorizedTokens.push(token);
      } else {
        if(remove) this.db.data.refreshTokens = this.db.data.refreshTokens.filter(t => t.token !== token.token);
        else this.db.data.refreshTokens.push(token);
      }
      return this.db.write();
    }
  }

  authorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void, emit?: {event: 'token'|'refreshToken', payload:string}[]}) {
    if(!o.socket.rooms.has('authorized')) {
      o.socket.join('authorized');
      o.socket.emit('authorized');
    }
    if(o.emit) o.emit.forEach(e => o.socket.emit(e.event, e.payload));
    this.db?.write();
    o.next();
  }

  unauthorize(o: {socket: socketInstance, next: (err?:ExtendedError | undefined) => void }) {
    o.socket.emit('unauthorized');
    o.socket.disconnect();
    this.db?.write();
    o.next();
  }

  use() {
    this.io.use((socket, next) => {
      // use token to authenticate
      if(socket.handshake.auth.token) {
        const findAccess = this.db?.data?.authorizedTokens.find(t => t.token === socket.handshake.auth.token);
        // if there's an access token and it's not expired
        if(findAccess) {
          if(findAccess.expire > Date.now()) {
            return this.authorize({socket, next});
          }
        }
        // if there's no refresh token
        if(!socket.handshake.auth.refreshToken) return next(new Error('no_refresh_token'));

        const findRefresh = this.db?.data?.refreshTokens.find(t => t.token === socket.handshake.auth.refreshToken);
        // if there's a refresh token
        if(findRefresh) {
          // and it's not expired
          if(findRefresh.expire > Date.now()) {
            // if an access token exists and it's parent is the same as the refresh token
            if(findAccess && findAccess.parent === findRefresh.token) {
              // generate a new access token
              this.db?.data?.authorizedTokens.splice(this.db.data.authorizedTokens.indexOf(findAccess), 1);
              const token = crypto.randomBytes(32).toString('hex');
              const in5minutes = Date.now() + (5 * 60 * 1000);
              const authorized = { token, expire: in5minutes, parent: findRefresh.token, master: false };
              this.db?.data?.authorizedTokens.push(authorized);
              return this.authorize({
                socket,
                next,
                emit:[ {event:'token', payload:token} ],
              });
            }
          }
          // but if the refresh token is expired
          // remove all authorizedTokens where parent is the refreshToken
          this.db?.data?.authorizedTokens.splice(this.db.data.authorizedTokens.findIndex(t => t.parent === findRefresh.token), 1);
        }
        // if there's no refresh token or it is expired, but there's an access token
        if(findAccess) {
          // remove the refresh token matching the access token parent
          this.db?.data?.refreshTokens.splice(this.db.data.refreshTokens.findIndex(t => t.token === findAccess.parent), 1);
          // remove all access tokens with the same parent
          this.db?.data?.authorizedTokens.splice(this.db.data.authorizedTokens.findIndex(t => t.parent === findAccess.parent), 1);
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
          const authorized = { token, expire: in5minutes, parent: refreshToken };
          const refresh = { token: refreshToken, expire: in7days, master: true };
          this.db?.data?.authorizedTokens.push(authorized);
          this.db?.data?.refreshTokens.push(refresh);
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
  }


}
