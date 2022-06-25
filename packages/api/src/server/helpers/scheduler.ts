import type { MangaInDB, MangaPage } from '../../models/types/manga';
import EventEmitter from 'node:events';
import { resolve, join } from 'node:path';
import { env } from 'node:process';
import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import mirrors from '../../models/exports';
import { MangaDatabase } from '../../db/mangas';
import { SettingsDatabase } from '../../db/settings';
import type TypedEmitter from 'typed-emitter';
import type { ServerToClientEvents } from './../types/index';
import type MirrorInterface from '../../models/interfaces';
import type { MangaErrorMessage } from '../../models/types/errors';
import type { Server as ioServer } from 'socket.io';
import type { ClientToServerEvents } from '../../client/types';

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

  mangaLogs:{date: number, message:'chapter'|'chapter_error', mirror:string, id: string, chapter:number }[] = [];
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
    this.clearcache();
    this.update();
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

  private addMangaLog(message:'chapter'|'chapter_error', mirror:string, id: string, chapter:number):void {
    if(!this.settings.library.logs.enabled) return;
    this.mangaLogs.push({date: Date.now(), message, mirror, id, chapter});
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
    if(this.ongoing.updates) return;
    this.ongoing.updates = true;
    if(this.io) this.io.emit('startMangasUpdate');
    const mangaByMirror = this.getMangasToUpdate(force);
    for(const mirrorName of Object.keys(mangaByMirror)) {
      const mirror = mirrors.find(m => m.name === mirrorName);
      if(mirror) await this.updateMangas(mirror, mangaByMirror[mirrorName]);
    }
    this.ongoing.updates = false;
    if(this.io) this.io.emit('finishedMangasUpdate');
    this.logger('done updating');
    this.restartUpdate();
  }

  private getMangasToUpdate(force?:boolean) {
    // filter mangas were lastUpdate + waitBetweenUpdates is less than now
    const mangas = MangaDatabase.getAllSync()
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
          let count = 0;
          const manga = mangas.find(m => m.id === mangaPage.id);
          if(!manga) {
            this.addMangaLog('chapter_error', mirror.name, mangaPage.id, count);
            continue;
          }
          mangaPage.chapters.forEach(chapter => {
            if(!manga.chapters.find(c=> c.id === chapter.id)) {
              manga.chapters.push({...chapter, read: false});
              count++;
            }
          });
          if(count > 0) this.addMangaLog('chapter', mirror.name, manga.id, count);
        }
      } catch {
        // do nothing
      }

    } else {
      for(const manga of mangas) {
        this.logger('updating', manga.name, '@', manga.mirror);
        try {
          const fetched = await this.updateSingleManga(mirror, manga);
          let count = 0;
          // if fetched has chapters not in manga add them if they don't already exist
          fetched.chapters.forEach(chapter => {
            if(!manga.chapters.find(c => c.id === chapter.id)) {
              manga.chapters.push({...chapter, read: false });
              count++;
            }
          });
          if(count > 0) this.addMangaLog('chapter', mirror.name, manga.id, count);
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
