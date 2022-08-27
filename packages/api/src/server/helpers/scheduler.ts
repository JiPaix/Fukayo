import type { ClientToServerEvents } from '@api/client/types';
import { MangaDatabase } from '@api/db/mangas';
import { SettingsDatabase } from '@api/db/settings';
import mirrors from '@api/models/exports';
import type MirrorInterface from '@api/models/interfaces';
import type { MangaErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { arraysEqual } from '@api/server/helpers/arrayEquals';
import type { ServerToClientEvents } from '@api/server/types/index';
import EventEmitter from 'events';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { env } from 'process';
import type { Server as ioServer } from 'socket.io';
import type TypedEmitter from 'typed-emitter';

export class SchedulerClass extends (EventEmitter as new () => TypedEmitter<ServerToClientEvents>) {
  private intervals: {
    updates: NodeJS.Timer;
    nextupdate: number;
    cache: NodeJS.Timer;
    nextcache: number;
  };
  private ongoing = {
    updates: false,
    cache: false,
  };

  mangaLogs:{date: number, message:'chapter'|'chapter_read'|'chapter_error'|'manga_metadata', mirror:string, id: string, nbOfUpdates:number }[] = [];
  cacheLogs: { date: number, message: 'cache'|'cache_error', files:number, size:number }[] = [];
  io?: ioServer<ClientToServerEvents, ServerToClientEvents>;
  constructor() {
    super();
    this.intervals = {
      // we should perform checks every minute
      nextcache: Date.now() + 60000,
      cache: setTimeout(this.update.bind(this), 60000),
      nextupdate: Date.now() + (this.settings.library.waitBetweenUpdates),
      updates: setTimeout(this.clearcache.bind(this), this.settings.library.waitBetweenUpdates),
    };

    // wait 30s on startup to make sure async operations are done
    setTimeout(() => {
      this.clearcache();
      this.update();
    }, 30*1000);

  }

  get logs() {
    return { manga: this.mangaLogs, cache: this.cacheLogs };
  }

  get settings() {
    return SettingsDatabase.data;
  }

  get cache() {
    return SettingsDatabase.data.cache;
  }

  get cacheEnabled() {
    return SettingsDatabase.data.cache.age.enabled || SettingsDatabase.data.cache.size.enabled;
  }

  get isUpdatingMangas() {
    return this.ongoing.updates;
  }

  registerIO(io:ioServer) {
    this.io = io;
  }

  private addMangaLog(message:'chapter'|'chapter_error'|'chapter_read'|'manga_metadata', mirror:string, id: string, nbOfUpdates:number):void {
    if(!this.settings.library.logs.enabled) return;
    this.mangaLogs.push({date: Date.now(), message, mirror, id, nbOfUpdates});
    if(this.mangaLogs.length > this.settings.library.logs.max) {
      this.mangaLogs.shift();
    }
  }

  addCacheLog(message:'cache', files:number, size:number) {
    if(!this.settings.library.logs.enabled) return;
    this.cacheLogs.push({date: Date.now(), message, files, size});
    if(this.cacheLogs.length > this.settings.library.logs.max) {
      this.cacheLogs.shift();
    }
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[35m${this.constructor.name}\x1b[0m)` ,...args);
  }

  private clearcache() {
    if(this.cacheEnabled) {
      const { age, size } = this.cache;
      let cacheFiles = SchedulerClass.getAllCacheFiles();
      const total = { files: 0, size:0 };
      if(age.enabled) {
        // delete files older than max, and remove them from the array
        cacheFiles = cacheFiles.filter(file => {
          if(file.age > age.max) {
            total.files++;
            total.size += file.size;
            SchedulerClass.unlinkSyncNoFail(file.filename);
            return true;
          }
          return false;
        });
      }
      if(size.enabled) {
        const totalsize = cacheFiles.reduce((acc, file) => acc + file.size, 0);
        if (totalsize > size.max) {
          // delete files until the size is under the max starting from the oldest
          cacheFiles.sort((a, b) => a.age - b.age);
          cacheFiles.forEach(file => {
            total.files++;
            total.size += file.size;
            SchedulerClass.unlinkSyncNoFail(file.filename);
            if(total.size < size.max) return false;
          });
        }
      }
      if(total.files > 0 && total.size > 0) this.addCacheLog('cache', total.files, total.size);
      this.restartCache();
    }
  }

  static getAllCacheFiles(dirPath?:string, arrayOfFiles?:{ filename: string, size:number, age:number }[]): { filename: string, size:number, age:number }[] {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    const path = dirPath || resolve(env.USER_DATA, '.cache');
    const files = readdirSync(path);
    let res = arrayOfFiles || [];
    files.forEach(function(file) {
      if(existsSync(join(path, file))) {
        const stat = statSync(path + '/' + file);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          res = SchedulerClass.getAllCacheFiles(path + '/' + file, res);
        } else if(!stat.isSymbolicLink()) {
          const filePath = join(path, file);
          res.push({filename: filePath, size: stat.size, age: Date.now() - stat.mtime.getTime()});
        }
      }
    });
    return res;
  }

  static unlinkSyncNoFail(file:string) {
    try {
      unlinkSync(file);
    } catch(e) {
      // do nothing
    }
  }

  restart() {
    clearTimeout(this.intervals.cache);
    clearTimeout(this.intervals.updates);
    if(this.cacheEnabled) {
      this.intervals.cache = setTimeout(this.update.bind(this), 300000);
      this.intervals.nextcache = Date.now() + 300000;
    }
    this.intervals.nextupdate = Date.now() + (this.settings.library.waitBetweenUpdates);
    this.intervals.updates = setTimeout(this.clearcache.bind(this), this.settings.library.waitBetweenUpdates);
  }

  restartUpdate() {
    clearTimeout(this.intervals.updates);
    this.intervals.updates = setTimeout(this.clearcache.bind(this), this.settings.library.waitBetweenUpdates);
    this.intervals.nextupdate = Date.now() + (this.settings.library.waitBetweenUpdates);
  }

  restartCache() {
    clearTimeout(this.intervals.cache);
    if(this.cacheEnabled) {
      this.intervals.cache = setTimeout(this.update.bind(this), 300000);
      this.intervals.nextcache = Date.now() + 300000;
    }
  }

  /**
   *
   * @param force if true, will force the update of all the mangas
   */
  async update(force?:boolean) {
    this.logger('updating');
    // if we are already updating, return
    if(this.ongoing.updates) return;
    // emit to all the clients that we are updating
    this.ongoing.updates = true;
    if(this.io) this.io.emit('startMangasUpdate');
    // get the list of mangas
    const mangaByMirror = await this.getMangasToUpdate(force);
    // setMaxListeners according to the number of manga to update
    const nbMangas = Object.keys(mangaByMirror).reduce((acc, key) => acc + mangaByMirror[key].length, 0);
    this.setMaxListeners(nbMangas + 1);
    // update the mangas
    for(const mirrorName of Object.keys(mangaByMirror)) {
      const mirror = mirrors.find(m => m.name === mirrorName);
      if(mirror) await this.updateMangas(mirror, mangaByMirror[mirrorName]);
    }
    // emit to all the clients that we are done updating
    this.ongoing.updates = false;
    if(this.io) this.io.emit('finishedMangasUpdate');
    this.logger('done updating');
    // restart update intervals/timeouts
    this.restartUpdate();
  }

  private async getMangasToUpdate(force?:boolean) {
    // filter mangas were lastUpdate + waitBetweenUpdates is less than now
    const mangas = (await MangaDatabase.getAll())
      .filter(manga => {
        if(force) return true;
        else if((manga.meta.lastUpdate + this.settings.library.waitBetweenUpdates) < Date.now()) return true;
        else return false;
      });
    // groups mangas by mirror
    const mangasByMirror: sortedMangas<typeof mangas[0]> = {};
    mangas.forEach(manga => {
      if(!mangasByMirror[manga.mirror]) mangasByMirror[manga.mirror] = [];
      mangasByMirror[manga.mirror].push(manga);
    });
    return mangasByMirror;
  }


  private async updateMangas(mirror:MirrorInterface, mangas: MangaInDB[]) {
    const res:MangaInDB[] = [];
    const now = Date.now();
    if(mirror.mangas) {
      try {
        const fetched = await this.updateManyMangas(mirror, mangas);
        for(const mangaPage of fetched) {
          let countNewChaps = 0;
          let countNewReadStatus = 0;
          let countNewMetadata = 0;

          const manga = mangas.find(m => m.id === mangaPage.id);
          if(!manga) {
            this.addMangaLog('chapter_error', mirror.name, mangaPage.id, countNewChaps);
            continue;
          }
          // check if some keys changed
          if(manga.name !== mangaPage.name) {
            manga.name = mangaPage.name;
            countNewMetadata++;
          }
          if(manga.lang !== mangaPage.lang) {
            manga.lang = mangaPage.lang;
            countNewMetadata++;
          }
          if(manga.synopsis !== mangaPage.synopsis) {
            manga.synopsis = mangaPage.synopsis;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.authors, mangaPage.authors)) {
            manga.authors = mangaPage.authors;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.covers, mangaPage.covers)) {
            manga.covers = mangaPage.covers;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.tags, mangaPage.tags)) {
            manga.tags = mangaPage.tags;
            countNewMetadata++;
          }
          mangaPage.chapters.forEach(chapter => {
            const chapterInDB = manga.chapters.find(c => c.id === chapter.id);
            if(chapterInDB) {
              if(!chapterInDB.read && chapter.read) {
                chapterInDB.read = false;
                countNewReadStatus++;
              }
            } else {
              manga.chapters.push(chapter);
              countNewChaps++;
            }
          });
          if(countNewChaps > 0) this.addMangaLog('chapter', mirror.name, manga.id, countNewChaps);
          if(countNewReadStatus > 0) this.addMangaLog('chapter_read', mirror.name, manga.id, countNewReadStatus);
          if(countNewReadStatus > 0) this.addMangaLog('manga_metadata', mirror.name, manga.id, countNewMetadata);
        }
      } catch {
        // do nothing
      }

    } else {
      for(const manga of mangas) {
        this.logger('updating', manga.name, '@', manga.mirror);
        try {
          const fetched = await this.updateSingleManga(mirror, manga);
          let countNewChaps = 0;
          let countNewReadStatus = 0;
          let countNewMetadata = 0;

          // check if some keys changed
          if(manga.name !== fetched.name) {
            manga.name = fetched.name;
            countNewMetadata++;
          }
          if(manga.lang !== fetched.lang) {
            manga.lang = fetched.lang;
            countNewMetadata++;
          }
          if(manga.synopsis !== fetched.synopsis) {
            manga.synopsis = fetched.synopsis;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.authors, fetched.authors)) {
            manga.authors = fetched.authors;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.covers, fetched.covers)) {
            manga.covers = fetched.covers;
            countNewMetadata++;
          }
          if(!arraysEqual(manga.tags, fetched.tags)) {
            manga.tags = fetched.tags;
            countNewMetadata++;
          }

          // if fetched has chapters not in manga add them if they don't already exist
          fetched.chapters.forEach(chapter => {
            const chapterInDB = manga.chapters.find(c => c.id === chapter.id);
            if(chapterInDB) {
              if(!chapterInDB.read && chapter.read) {
                chapterInDB.read = true;
                countNewReadStatus++;
              }
            } else {
              manga.chapters.push(chapter);
              countNewChaps++;
            }
          });
          if(countNewChaps > 0) this.addMangaLog('chapter', mirror.name, manga.id, countNewChaps);
          if(countNewReadStatus > 0) this.addMangaLog('chapter_read', mirror.name, manga.id, countNewReadStatus);
          if(countNewReadStatus > 0) this.addMangaLog('manga_metadata', mirror.name, manga.id, countNewMetadata);
        } catch(e) {
          this.addMangaLog('chapter_error', mirror.name, manga.id, 0);
        }
        res.push({...manga, meta: {...manga.meta, lastUpdate: now}});
      }
      res.forEach(async (m) => {
        await MangaDatabase.add({ manga: m });
      });
    }

  }

  private async updateSingleManga(mirror:MirrorInterface, manga: MangaInDB):Promise<MangaPage> {
    return new Promise((resolve, reject) => {
      const reqId = Date.now();
      // setting up our listener
      const listener = (id:number, mangaFromMirror:MangaInDB | MangaPage | MangaErrorMessage ) => {
        if(id !== reqId) return;
        if(isMangaPage(mangaFromMirror)) {
          this.removeListener('showManga', listener);
          resolve(mangaFromMirror);
        } else {
          this.removeListener('showManga', listener);
          reject(manga);
        }
      };

      this.on('showManga', listener.bind(this));
      mirror.manga(manga.url, manga.lang, this, reqId);
    });
  }

  private async updateManyMangas(mirror:MirrorInterface, mangas: MangaInDB[]):Promise<MangaPage[]> {
    return new Promise((resolve, reject) => {
      const reqId = Date.now();
      const listener = (id:number, mangasFromMirrors:(MangaInDB | MangaPage | MangaErrorMessage)[]) => {
        if(id !== reqId) return;
        const res = mangasFromMirrors.filter(isMangaPage);
        if(res.length) resolve(res);
        else reject(mangasFromMirrors);
      };
      this.on('showMangas', listener.bind(this));
      const meta = mangas.map(m => { return { url: m.url, lang: m.lang }; });
      if(mirror.mangas) mirror.mangas(meta, this, reqId);
      else throw new Error('mirror does not have mangas() function');
    });

  }
}



export const Scheduler = new SchedulerClass();

type sortedMangas<T> = {
  [key: string]: T[];
}

function isMangaPage(manga: MangaInDB|MangaPage|MangaErrorMessage): manga is MangaPage {
  return (manga as MangaPage).inLibrary === false && typeof (manga as MangaInDB).meta === 'undefined';
}

