import type { ClientToServerEvents } from '@api/client/types';
import MangasDB from '@api/db/mangas';
import SettingsDB from '@api/db/settings';
import TokenDatabase from '@api/db/tokens';
import UUID from '@api/db/uuids';
import mirrors from '@api/models';
import type Importer from '@api/models/imports/interfaces';
import type { MangaInDB } from '@api/models/types/manga';
import { removeAllCacheFiles } from '@api/server/helpers';
import Scheduler from '@api/server/scheduler';
import type { ServerToClientEvents, socketInstance } from '@api/server/types';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { env } from 'process';
import { Server as ioServer } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';

/**
 * Initialize a socket.io server
 */
export default class IOWrapper {
  static #instance: IOWrapper;
  io: ioServer<ClientToServerEvents, ServerToClientEvents>;
  login:string;
  password:string;
  db:TokenDatabase;
  #isReady = false;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  #importer: Importer[] = [];
  constructor(runner: HttpServer | HttpsServer, CREDENTIALS: {login: string, password: string}, tokens: {accessToken: string, refreshToken: string}) {
    this.login = CREDENTIALS.login;
    this.password = CREDENTIALS.password;
    this.io = new ioServer(runner, {cors: { origin: '*'}, maxHttpBufferSize: 1e+9});
    this.db = TokenDatabase.getInstance({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    this.use();
    this.io.on('connection', this.routes.bind(this));
    // async hell
    // in memory database need to perform async operation
    this.db.init().then(() => {
      this.logger('token database loaded');
      this.#initMirrors().then(() => {
        this.logger('mirrors databases loaded');
        // the Scheduler needs io to broadcast events
        Scheduler.getInstance().registerIO(this.io).then(() => {
          this.#isReady = true; // this makes the server available only after the Scheduler is done
          this.logger('scheduler is ready');
          // loading mirror import modules
          import('../models/imports').then(l => {
            this.#importer = l.default;
          });
        });
      });
    });

  }

  static getInstance(runner: HttpServer | HttpsServer, CREDENTIALS: {login: string, password: string}, tokens: {accessToken: string, refreshToken: string}): IOWrapper {
    if (!this.#instance) {
      this.#instance = new this(runner, CREDENTIALS, tokens);
    }
    return this.#instance;
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[33m${this.constructor.name}\x1b[0m)` ,...args);
  }

  async #initMirrors() {
    for(const mirror of mirrors) {
        await mirror.init();
    }
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

  #waitUntilReady():Promise<true> {
    return new Promise((resolve) => {
      const loop:() => void = () => this.#isReady ? resolve(true) : setTimeout(loop, 1000);
      loop();
    });
  }

  use() {
    this.io.use(async (socket, next) => {

      // delay all responses until databases and the scheduler are ready
      if(!this.#isReady) {
        await this.#waitUntilReady();
      }
      this.logger('server is ready');

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
        const authorized = await this.db.generateAccess(findRefresh);
        return this.authorize({
          socket,
          next,
          emit:[ {event:'token', payload:authorized.token} ],
        });
      }
      else if(socket.handshake.auth.login && socket.handshake.auth.password) {
        if(socket.handshake.auth.login === this.login && socket.handshake.auth.password === this.password) {
          // generate tokens
          const refresh = await this.db.generateRefresh();
          const authorized = await this.db.generateAccess(refresh);

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

    /** returns all mirror's mirrorInfo */
    socket.on('getMirrors', (showdisabled, callback) => {
      if(showdisabled) return callback(mirrors.map(m => m.mirrorInfo));
      return callback(mirrors.map(m => m.mirrorInfo).filter(m => m.enabled));
    });

    /**
     * Get all mangas from the MangasDB.getInstance()
     *
     * for each mangas MangasDB.getInstance() replies with a 'showLibrary' event containing the manga's data
     * including the chapters.
     */
    socket.on('showLibrary', async (id) => {
      (await MangasDB.getInstance()).getAll(id, socket);
    });

    /**
     * Search mangas in selected mirrors and languages
     *
     * the callback returns the number of mirrors that are expected to reply
     * each mirror will reply for each mangas with a 'searchInMirrors' event containing the manga's data
     * this does not include the chapters.
     */
    socket.on('searchInMirrors', (query, id, selectedMirrors, selectedLangs, callback) => {
      const filtered = mirrors
      .filter(m =>  m.langs.some(l => selectedLangs.includes(l)))
      .filter(m => selectedMirrors.includes(m.name))
      .filter(m => m.enabled);
      callback(filtered.length);
      filtered.forEach(m => m.search(query, selectedLangs, socket, id));
    });

    /**
     * Show a manga page
     *
     * we look if first if the manga is in the database.
     * if it does, we directly reply with a 'showManga' event containing the manga-in-db's data
     *
     * if not, we get the manga in the selected mirrors and languages
     * the mirror will reply with a 'showManga' event containing the manga's data
     */
    socket.on('showManga', async (id, opts) => {
      let indb: MangaInDB | undefined;
      if(opts.id && opts.langs) indb = await (await MangasDB.getInstance()).get({id: opts.id, langs: opts.langs});
      else if(opts.mirror && opts.langs && opts.url) indb = await (await MangasDB.getInstance()).get({mirror: opts.mirror, langs: opts.langs, url: opts.url});

      if(indb) return socket.emit('showManga', id, indb);

      if(opts.mirror && opts.langs && opts.url) {
        const mirror = mirrors.find(m => m.name === opts.mirror);
        if(!mirror) return socket.emit('showManga', id, {error: 'manga_error_mirror_not_found'});
        else return mirror.manga(opts.url, opts.langs, socket, id);
      }

      if(opts.id) {
        const search = UUID.getInstance().data.ids.find(u => u.id === opts.id);
        if(search) {
          const mirror = mirrors.find(m => m.name === search.mirror.name);
          if(mirror) return mirror.manga(search.url, opts.langs||search.langs, socket, id);
          else return socket.emit('showManga', id, {error: 'manga_error_mirror_not_found'});
        }
      }

      return socket.emit('showManga', id, {error: 'manga_error_unknown'});
    });

    /**
     * Get a manga's chapter
     * the mirror will reply with a 'showChapter' event containing the chapter's data
     */
    socket.on('showChapter', async (id, opts, callback) => {
      const mirror = mirrors.find(m => m.name === opts.mirror);
      if(!mirror) return socket.emit('showChapter', id, { error: 'chapter_error_mirror_not_found', index: 0, lastpage: true });

      // don't bother searching if we already have the url
      if(opts.url) return mirror.chapter(opts.url, opts.lang, socket, id, callback);

      // if manga is in db search the chapter url
      const mg = await (await MangasDB.getInstance()).get({id: opts.mangaId, langs: [opts.lang] });
      if(mg) {
        const chap = mg.chapters.find(c => c.id === opts.chapterId && c.lang === opts.lang);
        if(!chap) return socket.emit('showChapter', id, {error:'chapter_error', trace: 'cannot find chapter in db'});
        return mirror.chapter(chap.url, chap.lang, socket, id, callback);
      }
      // last resort: search in the uuid database
      else {
        const search = UUID.getInstance().data.ids.find(u => u.id === opts.chapterId && u.langs.some(l => l === opts.lang));
        if(!search) return socket.emit('showChapter', id, { error: 'chapter_error_invalid_link' });
        return mirror.chapter(search.url, opts.lang, socket, id, callback);
      }
    });

    /**
     * Show recommendations for a given mirror
     * the mirror will reply for each mangas with a 'showRecommend'event containing the manga's data
     */
    socket.on('showRecommend', (id, mirror) => {
      mirrors.find(m=>m.name === mirror)?.recommend(socket, id);
    });

    /**
     * Add manga to db
     * callback returns the manga's data (which is different from the one sent by the mirror)
     */
    socket.on('addManga', async (payload, callback) => {
      const mg = await (await MangasDB.getInstance()).add(payload);
      mg.chapters.forEach(c => UUID.getInstance().remove(c.id));
      callback(mg);
    });

    /**
     * Remove manga from db
     * callback returns the manga-in-db's data (as a mirror would send it)
     */
    socket.on('removeManga', async (manga, lang, callback) => {
      const notInDB = await (await MangasDB.getInstance()).remove(manga, lang);
      callback(notInDB);
    });

    /** Mark manga as read on external sources (if available) */
    socket.on('markAsRead', async payload => {
      await (await MangasDB.getInstance()).markAsRead(payload.mangaId, payload.chapterUrls, payload.lang);
      const mirror = mirrors.find(m => m.name === payload.mirror);
      if(mirror && mirror.markAsRead) {
        mirror.markAsRead(payload.url, payload.lang, payload.chapterUrls, payload.read);
      }

    });
    /**
     * Change settings for a mirror
     * callback returns all mirrors' mirrorInfo
     */
    socket.on('changeMirrorSettings', (mirror, opts, callback) => {
      mirrors.find(m=>m.name === mirror)?.changeSettings(opts);
      callback(mirrors.map(m => m.mirrorInfo));
    });

    /**
     * Get the size and number of files in the cache
     * callback returns the size and number of files
     */
    socket.on('getCacheSize', callback => {
      const b = Scheduler.getAllCacheFiles();
      const files = b.length;
      const size = b.reduce((acc, cur) => acc + cur.size, 0);
      callback(size, files);
    });

    /**
     * Remove all files in the cache
     * will force the removal of all files in the cache regardless of what Scheduler is doing
     */
    socket.on('emptyCache', () => removeAllCacheFiles());

    /**
     * Force an update of all mangas chapters in the MangasDB.getInstance()
     * Scheduler will broadcast a 'startMangasUpdate' then 'finishedMangasUpdate' event to all clients during the update
     */
    socket.on('forceUpdates', () => {
      Scheduler.getInstance().update(true);
    });

    /**
     * Get the mangas update status
     * callback returns the status (true if the update is running, false otherwise)
     */
    socket.on('isUpdating', (cb) => {
      cb(Scheduler.getInstance().isUpdatingMangas);
    });

    socket.on('schedulerLogs', (cb) => {
      cb(Scheduler.getInstance().logs);
    });

    socket.on('getSettings', (cb) => {
      cb(SettingsDB.getInstance().data);
    });

    socket.on('changeSettings', (settings, cb) => {
      // watch if we need to restart cache/update timers
      let restartCache = false;
      let restartUpdates = false;
      // if waitBetweenUpdates is changed, we need to restart the update timer
      if(settings.library.waitBetweenUpdates !== SettingsDB.getInstance().data.library.waitBetweenUpdates) {
        restartUpdates = true;
      }
      // if any of this cache settings is changed, we need to restart the cache timer
      if(settings.cache.age.enabled !== SettingsDB.getInstance().data.cache.age.enabled
        || settings.cache.size.enabled == SettingsDB.getInstance().data.cache.size.enabled
        || settings.cache.age.max !== SettingsDB.getInstance().data.cache.age.max
        || settings.cache.size.max !== SettingsDB.getInstance().data.cache.size.max)
      {
        restartCache = true;
      }
      // we need to write the new settings to the database before restarting the cache/update timers
      SettingsDB.getInstance().data = settings;
      SettingsDB.getInstance().write();
      if(restartUpdates) Scheduler.getInstance().restartUpdate();
      if(restartCache) Scheduler.getInstance().restartCache();
      cb(SettingsDB.getInstance().data);
    });

    socket.on('getImports', (showall, cb) => {
      const infos = this.#importer.map(imp=>imp.showInfo);
      if(showall) cb(infos);
      else cb(infos.filter(imp=>imp.enabled));
    });

    socket.on('showImports', (id, mirrorName, langs) => {
      const importer = this.#importer.find(m=>m.name === mirrorName);
      if(!importer) return socket.emit('showImports', id, { error:'import_error', trace: 'importer_not_found' });
      importer.getMangas(socket, id, langs);
    });
  }
}

