import { DatabaseIO } from '@api/db';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { arraysEqual } from '@api/server/helpers/arrayEquals';
import { SchedulerClass } from '@api/server/helpers/scheduler';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/index';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { env } from 'process';

type Mangas = {
  mangas: {
    id: string,
    mirror:{ name: string, version: number },
    url: string,
    file: string,
    langs: mirrorsLangsType[],
  }[]
}

function isMangaInDB(res: MangaPage | MangaInDB ): res is MangaInDB {
  return (res as MangaInDB).inLibrary === true && (res as MangaInDB).meta !== undefined;
}

export class MangasDB extends DatabaseIO<Mangas> {
  #path: string;
  constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, '.mangasdb', 'index.json'), { mangas: [] });
    this.#path = resolve(env.USER_DATA, '.mangasdb');
  }

  /** add or update a manga */
  async add(payload: { manga: MangaPage | MangaInDB, settings?: MangaInDB['meta']['options'] }) {
    const db = await this.read();
    const alreadyInDB = db.mangas.find(m => m.id === payload.manga.id);
    const filename = await this.#filenamify(payload.manga.id);

    // New manga || Manga/lang combo
    if(!isMangaInDB(payload.manga)) {

      // make sure inLibrary is true if the manga is totally new
      payload.manga.inLibrary = true;

      // If manga exists but lang isn't registered we get the reader's settings from the database
      let alreadyInDB_DATA = undefined;
      if(alreadyInDB) alreadyInDB_DATA = await new DatabaseIO(resolve(this.#path, `${filename}.json`), {} as MangaInDB).read();

      // We define "meta" for this new entry:
      // and past "meta.options" from either the payload, the database (if any), or use default settings
      (payload.manga as MangaInDB).meta = {
        lastUpdate: Date.now(),
        notify: true,
        update: true,
        options : payload.settings || alreadyInDB_DATA?.meta.options || {
          webtoon: false,
          showPageNumber: true,
          zoomMode: 'auto',
          zoomValue: 100,
          longStrip: false,
          overlay: false,
        },
      };
    }

    // previous statement made sure "payload.manga" is of type "MangaInDB"
    // this line is only for typescript convenience
    const mangadata = payload.manga as MangaInDB;

    // now only "alreadyInDB" is able to tell us if the manga is actually in the db or not.
    if(alreadyInDB) {
      this.logger('updating manga');
      return this.#upsert(mangadata, filename, true);
    }
    else {
      this.logger('new manga added');
      // save manga data in its own table
      const manga = await this.#upsert(mangadata, filename, false);
      db.mangas.push({ id: manga.id, url: manga.url, mirror: manga.mirror, langs: manga.langs, file: filename });
      await this.write(db);
      return manga;
    }
  }

  async remove(manga: MangaInDB, lang:mirrorsLangsType):Promise<MangaPage> {
    const db = await this.read();
    const index = db.mangas.find(x => x.id === manga.id);
    // we "un-db-ify" the manga so we can return results to user later
    const unDBify:MangaPage = {...manga, inLibrary: true };
    if(index) {
      try {
        // update the database index
        index.langs = index.langs.filter(l => l !== lang);
        if(index.langs.length === 0) db.mangas = db.mangas.filter(m => m.id !== index.id);
        await this.write(db);

        // update the manga database
        const mangadb = new DatabaseIO(resolve(this.#path, `${index.file}.json`), manga);
        const data = await mangadb.read();
        data.langs = data.langs.filter(l => l !== lang);
        data.chapters = data.chapters.filter(c => c.lang !== lang);
        await mangadb.write(data);

        if(!data.langs.length && !data.chapters.length) {
          // remove manga database file if there's nothing in.
          unlinkSync(resolve(this.#path, `${index.file}.json`));
          unDBify.covers = data.covers.map(c => readFileSync(resolve(this.#path, c)).toString());
          data.covers.forEach(c => unlinkSync(resolve(this.#path, c)));
          unDBify.inLibrary = false;
          return unDBify;
        }
        return {...data, covers: manga.covers, inLibrary: unDBify.inLibrary };
      } catch {
        // ignore
      }
    }
    return unDBify;
  }

  async has(mirror:string, langs:mirrorsLangsType[], url:string):Promise<boolean> {
    const db = await this.read();
    return db.mangas.some(m => m.mirror.name === mirror && m.langs.some(l => langs.includes(l)) && m.url === url);
  }

  async get(opts: {id:string,  langs: mirrorsLangsType[] }): Promise<MangaInDB|undefined>
  async get(opts: {mirror: string, langs: mirrorsLangsType[], url: string}): Promise<MangaInDB|undefined>
  async get(opts: {mirror?:string, langs:mirrorsLangsType[], url?:string, id?:string}):Promise<MangaInDB|undefined> {
    const { mirror, langs, url, id } = opts;
    const db = await this.read();
    let mg: typeof db.mangas[0] | undefined = undefined;

    // check if we have a matching manga in the database

    if(url && langs && mirror) mg = db.mangas.find(m => m.mirror.name === mirror && m.langs.some(l => langs.includes(l)) && m.url === url);
    else if(id && langs) mg = db.mangas.find(m => m.id === id && m.langs.some(l => langs.includes(l)));
    else return;
    if(!mg) return;

    // return the manga
    const mangadb = new DatabaseIO(resolve(this.#path, `${mg.file}.json`), {} as MangaInDB);
    const data = await mangadb.read();
    const covers = this.#getCovers(data.covers);
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
      const mg = await this.get({id: manga.id, langs: manga.langs});
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
  async #upsert(manga:MangaInDB, filename:string, alreadyInDB?:boolean):Promise<MangaInDB> {
    // create or get file
    const mangadb = new DatabaseIO(resolve(this.#path, `${filename}.json`), manga);
    const db = await this.read();

    let data = await mangadb.read();

    // we check differences between the manga in the db and the manga we want to save
    let hasNewStuff = false;
    let k: keyof typeof manga.meta.options;

    // if manga is already in db we will check if we added new languages
    if(alreadyInDB) {
      if(!data.langs.every(l => manga.langs.includes(l))) {
        // new languages must also be saved in the index db
        manga.langs = Array.from(new Set(data.langs.concat(manga.langs)));
        const find = db.mangas.find(m => m.id === manga.id);
        if(find) {
          find.langs = manga.langs;
          await this.write(db);
        }
        // retrieve languages of chapters in the database
        const chapterLanguagesInDB = Array.from(new Set(data.chapters.map(x => x.lang)));
        // we only keep chapters with languages NOT in the database
        const chapter2add = manga.chapters.filter(c => !chapterLanguagesInDB.includes(c.lang));
        // concat
        manga.chapters = data.chapters.concat(chapter2add);
        hasNewStuff = true;
      }
    }

    // check if categories changed
    if(!arraysEqual(data.categories.sort(), manga.categories.sort())) {
      hasNewStuff = true;
    }

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
    manga.covers = this.#saveCovers(Array.from(new Set([...manga.covers, ...data.covers])), filename);
    // we check if the manga has been updated by previous operations OR by the Scheduler
    const updatedByScheduler = data.meta.lastUpdate < manga.meta.lastUpdate;
    if(updatedByScheduler || hasNewStuff || !alreadyInDB) {
      data = {...manga, covers: manga.covers, _v: data._v };
      mangadb.write(data);
    }

    return data;
  }

  /** save base64 images to files and returns their filenames */
  #saveCovers(covers:string[], filename:string) {
    const coversAlreadySaved:{filename: string, data: string}[] = [];

    const path = resolve(this.#path);
    const files = readdirSync(path, {withFileTypes: true})
      .filter(item => !item.isDirectory() && !item.name.endsWith('.json'))
      .map(item => item.name);

    files.forEach(f => {
      coversAlreadySaved.push({filename: f, data: readFileSync(resolve(path, f)).toString() });
    });

    covers = covers.map((c, i) => {
      // if cover is already a filename return as it is
      if(c.includes(`_cover_${filename}`)) return c;
      // if base64 data is already saved in another file, return its filename
      const find = coversAlreadySaved.find(s=> s.data === c);
      if(find) return find.filename.replace('.json', '');

      // new cover, save to file
      const coverFileName = `${i}_cover_${filename}`;
      const path = resolve(this.#path, coverFileName);
      if(!existsSync(path)) {
        const data = c;
        writeFileSync(path, data);
      }
      return coverFileName;
    });
    return Array.from(new Set(covers));
  }

  /** reads files and return their content into an array */
  #getCovers(filenames: string[]) {
    const res:string[] = [];
    filenames.forEach(f => {
      const path = resolve(this.#path, f);
      if(existsSync(path)) {
        res.push(readFileSync(path).toString());
      }
    });
    return res;
  }

  async #filenamify(string:string) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const imp = await (eval('import("filenamify")') as Promise<typeof import('filenamify')>);
    const filenamify = imp.default;
    return filenamify(string);
  }
}

export const MangaDatabase = new MangasDB();
