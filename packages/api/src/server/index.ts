import { SettingsDatabase } from './../db/settings';
import { Scheduler } from './helpers/scheduler';
import { SchedulerClass } from './helpers/scheduler';
import mirrors from '../models/exports';
import { Server as ioServer } from 'socket.io';
import { TokenDatabase } from '../db/tokens';
import { MangaDatabase } from '../db/mangas';
import { removeAllCacheFiles } from './helpers';
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
    this.io = new ioServer(runner, {cors: { origin: '*'}, maxHttpBufferSize: 1e+9});
    this.db = new TokenDatabase({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    this.use();
    this.io.on('connection', this.routes.bind(this));
    // the Scheduler needs the ioServer to emit events to all connected clients
    Scheduler.registerIO(this.io);
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

    /** returns all mirror's mirrorInfo */
    socket.on('getMirrors', (showdisabled, callback) => {
      if(showdisabled) return callback(mirrors.map(m => m.mirrorInfo));
      return callback(mirrors.map(m => m.mirrorInfo).filter(m => m.enabled));
    });

    /** deduce the mirror by its url and return its mirrorInfo */
    socket.on('findMirrorByURL', (url, callback) => {
      try  { // try catch in case the url is not valid input
        const URI = new URL(url);
        const mirror = mirrors.find(m => m.host === URI.origin || m.althost?.some(h => h === URI.origin) || (m.options.host && `${m.options.port ? m.options.host+':'+m.options.port : m.options.host}` === URI.host));
        if(!mirror) return callback(undefined, false, false);
        let link = url.replace(URI.origin, '');
        if(mirror.options.host && mirror.options.port) {
          link = link.replace(mirror.options.host as string, '');
          link = link.replace(`:${mirror.options.port}`, '');
        }
        const isChapterPage = mirror.isChapterPage(link);
        const isMangaPage = mirror.isMangaPage(link);
        if(!isChapterPage && !isMangaPage) return callback(undefined, false, false);
        return callback(mirror.mirrorInfo, isMangaPage, isChapterPage);
      } catch {
        return callback(undefined, false, false);
      }
    });

    /**
     * Get all mangas from the MangaDatabase
     *
     * for each mangas MangaDatabase replies with a 'showLibrary' event containing the manga's data
     * including the chapters.
     */
    socket.on('showLibrary', (id) => {
      MangaDatabase.getAll(id, socket);
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
      filtered.forEach(m => m.search(query, socket, id));
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
    socket.on('showManga', (id, mirror, lang, url) => {
      const indb = MangaDatabase.get(mirror, lang, url);
      if(indb) {
        socket.emit('showManga', id, indb);
      } else {
        mirrors.find(m=> m.name === mirror)?.manga(url, lang, socket, id);
      }
    });

    /** same as showManga but deducing the mirror by its url */
    socket.on('getMangaURLfromChapterURL', async (id, url, lang) => {
      try {
        const URI = new URL(url);
        const mirror = mirrors.find(m => m.host === URI.origin || m.althost?.some(h => h === URI.origin) || (m.options.host && `${m.options.port ? m.options.host+':'+m.options.port : m.options.host}` === URI.host));
        if(mirror) {
          const indb = MangaDatabase.get(mirror.name, lang||mirror.langs[0], URI.toString().replace(URI.origin, ''));
          if(indb) return socket.emit('getMangaURLfromChapterURL', id, indb);
          else return mirror.mangaFromChapterURL(socket, id, url, lang);
        }
        socket.emit('getMangaURLfromChapterURL', id, undefined);
      } catch  {
        socket.emit('getMangaURLfromChapterURL', id, undefined);
      }
    });

    /**
     * Get a manga's chapter
     * the mirror will reply with a 'showChapter' event containing the chapter's data
     */
    socket.on('showChapter', (id, mirror, lang, url, callback: (nbOfPagesToExpect:number)=>void, retryIndex?:number) => {
      mirrors.find(m=>m.name === mirror)?.chapter(url, lang, socket, id, callback, retryIndex);
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
      const mg = await MangaDatabase.add(payload);
      callback(mg);
    });

    /**
     * Remove manga from db
     * callback returns the manga-in-db's data (as a mirror would send it)
     */
    socket.on('removeManga', (manga, callback) => {
      const notInDB = MangaDatabase.remove(manga);
      callback(notInDB);
    });

    /** Mark manga as read on external sources (if available) */
    socket.on('markAsRead', payload => {
      const mirror = mirrors.find(m => m.name === payload.mirror);
      if(mirror && mirror.markAsRead) {
        mirror.markAsRead(payload.url, payload.lang, payload.chapterUrl, payload.read);
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
      const b = SchedulerClass.getAllCacheFiles();
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
     * Force an update of all mangas chapters in the MangaDatabase
     * Scheduler will broadcast a 'startMangasUpdate' then 'finishedMangasUpdate' event to all clients during the update
     */
    socket.on('forceUpdates', () => {
      Scheduler.update(true);
    });

    /**
     * Get the mangas update status
     * callback returns the status (true if the update is running, false otherwise)
     */
    socket.on('isUpdating', (cb) => {
      cb(Scheduler.isUpdatingMangas);
    });

    socket.on('schedulerLogs', (cb) => {
      cb(Scheduler.logs);
    });

    socket.on('getSettings', (cb) => {
      cb(SettingsDatabase.data);
    });

    socket.on('changeSettings', (settings, cb) => {
      // watch if we need to restart cache/update timers
      let restartCache = false;
      let restartUpdates = false;
      // if waitBetweenUpdates is changed, we need to restart the update timer
      if(settings.library.waitBetweenUpdates !== SettingsDatabase.data.library.waitBetweenUpdates) {
        restartUpdates = true;
      }
      // if any of this cache settings is changed, we need to restart the cache timer
      if(settings.cache.age.enabled !== SettingsDatabase.data.cache.age.enabled
        || settings.cache.size.enabled == SettingsDatabase.data.cache.size.enabled
        || settings.cache.age.max !== SettingsDatabase.data.cache.age.max
        || settings.cache.size.max !== SettingsDatabase.data.cache.size.max)
      {
        restartCache = true;
      }
      // we need to write the new settings to the database before restarting the cache/update timers
      SettingsDatabase.data = settings;
      SettingsDatabase.write();
      if(restartUpdates) Scheduler.restartUpdate();
      if(restartCache) Scheduler.restartCache();
      cb(SettingsDatabase.data);
    });
  }
}

