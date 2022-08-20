import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { env } from 'process';
import type { socketInstance } from '../server/types';
import { DatabaseIO } from './';
import type { MangaInDB, MangaPage } from './../models/types/manga';
import { SchedulerClass } from './../server/helpers/scheduler';

type Mangas = {
  mangas: {
    id: string,
    mirror:string,
    url: string,
    file: string,
    lang: string,
  }[]
}

function isMangaInDB(res: MangaPage | MangaInDB ): res is MangaInDB {
  return (res as MangaInDB).inLibrary === true && (res as MangaInDB).meta !== undefined;
}


export class MangasDB extends DatabaseIO<Mangas> {
  private path: string;
  constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, '.mangasdb', 'index.json'), { mangas: [] });
    this.path = resolve(env.USER_DATA, '.mangasdb');
  }

  /** add or update a manga */
  async add(payload: { manga: MangaPage | MangaInDB, settings?: MangaInDB['meta']['options'] }) {
    const db = await this.read();
    const alreadyInDB = db.mangas.find(m => m.id === payload.manga.id);
    const filename = await this.filenamify(payload.manga.id);
    if(alreadyInDB && isMangaInDB(payload.manga)) return this.upsert(payload.manga, filename, alreadyInDB !== undefined);
    db.mangas.push({ id: payload.manga.id, url: payload.manga.url, mirror: payload.manga.mirror, lang: payload.manga.lang, file: filename });
    this.write(db);
    const meta:MangaInDB['meta'] = {
      lastUpdate: Date.now(),
      notify: true,
      update: true,
      options : isMangaInDB(payload.manga) && !payload.settings ?  payload.manga.meta.options : payload.settings || {
        webtoon: false,
        showPageNumber: true,
        zoomMode: 'auto',
        zoomValue: 100,
        longStrip: false,
      },
    };
    return this.upsert({...payload.manga, inLibrary: true, meta}, filename);
  }

  async remove(manga: MangaInDB) {
    const db = await this.read();
    const data = db.mangas.find(m => m.id === manga.id && m.url === manga.url && m.mirror === manga.mirror && m.lang === manga.lang);
    if(data) {
      try {
        const mangaFile = readFileSync(resolve(this.path, `${data.file}.json`)).toString();
        const mangaData = JSON.parse(mangaFile) as MangaInDB;
        mangaData.covers.forEach(c => unlinkSync(resolve(this.path, c)));
        unlinkSync(resolve(this.path, `${data.file}.json`));
      } catch {
        // => ignore errors
      }
    }
    db.mangas = db.mangas.filter(m => m.id !== manga.id);
    this.write(db);
    const unDbify:MangaPage = {
      id: manga.id,
      url: manga.url,
      mirror: manga.mirror,
      lang: manga.lang,
      displayName: manga.displayName,
      name: manga.name,
      inLibrary: false,
      authors: manga.authors,
      tags: manga.tags,
      covers: manga.covers,
      chapters: manga.chapters.map(c => ({
        id: c.id,
        url: c.url,
        date: c.date,
        number: c.number,
        name: c.name,
        volume: c.volume,
        group: c.group,
        read: c.read,
       })),
    };
    return unDbify;
  }

  async has(mirror:string, lang:string, url:string):Promise<boolean> {
    const db = await this.read();
    return db.mangas.some(m => m.mirror === mirror && m.lang === lang && m.url === url);
  }

  async get(opts: {id:string}): Promise<MangaInDB|undefined>
  async get(opts: {mirror: string, lang: string, url: string}): Promise<MangaInDB|undefined>
  async get(opts: {mirror?:string, lang?:string, url?:string, id?:string}):Promise<MangaInDB|undefined> {
    const { mirror, lang, url, id } = opts;
    const db = await this.read();

    let mg: {id:string, mirror:string, file:string, url:string} | undefined = undefined;
    if(id) {
      mg = db.mangas.find(m => m.id === id);
    }
    else if(url && lang && mirror) {
      mg = db.mangas.find(m => m.mirror === mirror && m.lang === lang && m.url === url);
    } else {
      return;
    }

    if(!mg) return;
    const mangadb = new DatabaseIO(resolve(this.path, `${mg.file}.json`), {} as MangaInDB);
    const data = await mangadb.read();
    return {
      ...data,
      chapters: data.chapters.sort((a, b) => b.number - a.number),
      covers: this.getCovers(data.covers),
    };
  }

  async getAll(): Promise<MangaInDB[]>
  async getAll(id:number, socket: socketInstance|SchedulerClass): Promise<void>
  async getAll(id?:number, socket?:socketInstance|SchedulerClass): Promise<MangaInDB[]|void> {
    const db = await this.read();
    let cancel = false;
    if(id && socket && !(socket instanceof SchedulerClass)) {
      socket.once('stopShowLibrary', () => {
        cancel = true;
      });
    }
    const results = [];
    for(const manga of db.mangas) {
      if(cancel) break;
      const mg = await this.get({id: manga.id});
      if(mg && !id && !socket) results.push(mg);
      if(mg && id && socket) socket.emit('showLibrary', id, mg);
    }
    if(!id && !socket) return results;
  }

  /** add or update */
  private async upsert(manga:MangaInDB, filename:string, alreadyInDB?:boolean):Promise<MangaInDB> {
    manga.covers = this.saveCovers(manga.covers, filename);
    // then we create the file by instanciating a DatabaseIO
    const mangadb = new DatabaseIO(resolve(this.path, `${filename}.json`), manga);

    // if the manga is already in the db we read the file using the DatabaseIO
    if(alreadyInDB) {
      let data = await mangadb.read();
      // we check differences between the manga in the db and the manga we want to save
      let hasNewStuff = false;
      let k: keyof typeof manga.meta.options;
      // check if the manga has new options
      for (k in manga.meta.options) {  // const k: string
        if(data.meta.options[k] !== manga.meta.options[k]) hasNewStuff = true;
      }
      // check if existing chapters have been read
      manga.chapters.forEach(c => {
        const chapter = data.chapters.find(c2 => c2.id === c.id);
        // new read status, no need to update lastUpdate
        if(chapter && chapter.read !== c.read) {
          hasNewStuff = true;
        }
      });

      // check if the displayName has changed
      if(data.displayName !== manga.displayName) hasNewStuff = true;

      // we check if the manga has been updated by previous operations OR by the Scheduler
      const updatedByScheduler = data.meta.lastUpdate < manga.meta.lastUpdate;
      if(updatedByScheduler || hasNewStuff) {
        data = {...manga, covers: data.covers, _v: data._v };
        mangadb.write(data);
        return data;
      }
    }
    return manga;
  }

  /** turn strings in to files and returns their filenames */
  private saveCovers(covers:string[], filename:string) {
    return covers.map((c, i) => {
      const coverFileName = `${i}_cover_${filename}`;
      const path = resolve(this.path, coverFileName);
      if(!existsSync(path)) {
        const data = c;
        writeFileSync(path, data);
      }
      return coverFileName;
    });
  }

  /** reads files and return their content into an array */
  private getCovers(filenames: string[]) {
    const res:string[] = [];
    filenames.forEach(f => {
      const path = resolve(this.path, f);
      if(existsSync(path)) {
        res.push(readFileSync(path).toString());
      }
    });
    return res;
  }

  private async filenamify(string:string) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const imp = await (eval('import("filenamify")') as Promise<typeof import('filenamify')>);
    const filenamify = imp.default;
    return filenamify(string);
  }
}

export const MangaDatabase = new MangasDB();
