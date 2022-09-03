import { DatabaseIO } from '@api/db';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { env } from 'process';

type Mangas = {
  mangas: {
    id: string,
    mirror:string,
    url: string,
    file: string,
    langs: mirrorsLangsType[],
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

    // if manga is already in DB update its data
    if(alreadyInDB && isMangaInDB(payload.manga)) return this.upsert(payload.manga, filename, alreadyInDB !== undefined);

    // save manga in the manga index table
    db.mangas.push({ id: payload.manga.id, url: payload.manga.url, mirror: payload.manga.mirror, langs: payload.manga.langs, file: filename });
    this.write(db);

    // define manga's options and metadatas
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
        overlay: false,
      },
    };

    // save manga data in its own table
    return this.upsert({...payload.manga, inLibrary: true, meta}, filename);
  }

  async remove(manga: MangaInDB, lang:mirrorsLangsType):Promise<MangaPage> {
    const db = await this.read();

    // we "un-db-ify" the manga so we can return results to user later
    const unDBify:MangaPage = {...manga, inLibrary: false };

    const linkToFile = db.mangas.find(m => m.id === manga.id && m.url === manga.url && m.mirror === manga.mirror);
    if(linkToFile) {
      try {
        const mangadb = new DatabaseIO(resolve(this.path, `${linkToFile.file}.json`), manga);
        const data = await mangadb.read();

        // removing data related to the language
        data.langs = data.langs.filter(l => l !== lang);
        data.chapters = data.chapters.filter(c => c.lang !== lang);

        // if there's still data related to other language: update the file
        if(data.langs.length && data.chapters.length) {
          mangadb.write(data);
          return data;
        }

        // else remove covers and the database file
        data.covers.forEach(c => unlinkSync(resolve(this.path, c)));
        unlinkSync(resolve(this.path, `${linkToFile.file}.json`));
      } catch {
        // => ignore errors
      }
    }
    db.mangas = db.mangas.filter(m => m.id !== manga.id);
    this.write(db);
    return unDBify;
  }

  async has(mirror:string, langs:mirrorsLangsType[], url:string):Promise<boolean> {
    const db = await this.read();
    return db.mangas.some(m => m.mirror === mirror && m.langs.some(l => langs.includes(l)) && m.url === url);
  }

  async get(opts: {id:string}): Promise<MangaInDB|undefined>
  async get(opts: {mirror: string, langs: mirrorsLangsType[], url: string}): Promise<MangaInDB|undefined>
  async get(opts: {mirror?:string, langs?:mirrorsLangsType[], url?:string, id?:string}):Promise<MangaInDB|undefined> {
    const { mirror, langs, url, id } = opts;
    const db = await this.read();
    let mg: {id:string, mirror:string, file:string, url:string} | undefined = undefined;

    // check if we have a matching manga in the database
    if(id) mg = db.mangas.find(m => m.id === id);
    else if(url && langs && mirror) mg = db.mangas.find(m => m.mirror === mirror && m.langs.some(l => langs.includes(l)) && m.url === url);
    else return;
    if(!mg) return;

    // return the manga
    const mangadb = new DatabaseIO(resolve(this.path, `${mg.file}.json`), {} as MangaInDB);
    const data = await mangadb.read();
    const covers = this.getCovers(data.covers);
    this.logger('GOT', covers.length, 'covers');
    return {
      ...data,
      chapters: data.chapters.sort((a, b) => b.number - a.number),
      covers,
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
      if(mg) console.log('COVERS:', mg.covers.length);
      if(mg && !id && !socket) results.push(mg);
      if(mg && id && socket) socket.emit('showLibrary', id, mg);
    }
    if(!id && !socket) return results;
  }

  /**
   * add or upsert
   * @param manga Manga to compare with the db
   * @param filename file containing the data
   * @param alreadyInDB if the manga is already in db
   */
  private async upsert(manga:MangaInDB, filename:string, alreadyInDB?:boolean):Promise<MangaInDB> {
    // create or get file
    const mangadb = new DatabaseIO(resolve(this.path, `${filename}.json`), manga);

    if(!alreadyInDB) {
      manga.covers = this.saveCovers(manga.covers, filename);
      mangadb.write(manga);
      return manga;
    }

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
      const chapter = data.chapters.find(c2 => c2.id === c.id && c2.lang === c.lang);
      if(chapter && chapter.read !== c.read) {
        hasNewStuff = true;
      }
    });

    // check if the displayName has changed
    if(data.displayName !== manga.displayName) hasNewStuff = true;

    // save base64 covers in to files
    manga.covers = this.saveCovers(manga.covers, filename);

    // we check if the manga has been updated by previous operations OR by the Scheduler
    const updatedByScheduler = data.meta.lastUpdate < manga.meta.lastUpdate;
    if(updatedByScheduler || hasNewStuff) {
      data = {...manga, covers: [...data.covers, ...manga.covers], _v: data._v };
      mangadb.write(data);
    }

    return data;
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
    this.logger('FILENAMES:', filenames);
    this.logger('FETCHED', res.length, 'COVERS');
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
