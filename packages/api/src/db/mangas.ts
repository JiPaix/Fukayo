import { DatabaseIO } from '@api/db';
import { isMangaInDB } from '@api/db/helpers';
import mirrors from '@api/models';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import Scheduler from '@api/server/scheduler';
import type { socketInstance } from '@api/server/types';
import { FileServer } from '@api/utils/fileserv';
import type { mirrorsLangsType } from '@i18n';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import isEqual from 'lodash.isequal';
import { resolve } from 'path';
import { env } from 'process';

type Mangas = {
  mangas: {
    id: string,
    mirror:{ name: string, version: number },
    url: string,
    file: string,
    langs: mirrorsLangsType[],
    lastUpdate: number
    update:boolean
    broken?: boolean
  }[]
}

export default class MangasDatabase extends DatabaseIO<Mangas> {
  static #instance: MangasDatabase;
  path: string;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  #filenamify?: typeof import('filenamify').default;
  constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super('Mangas',resolve(env.USER_DATA, '.mangasdb', 'index.json'), { mangas: [] });
    this.path = resolve(env.USER_DATA, '.mangasdb');
  }

  static async getInstance(): Promise<MangasDatabase> {
    if (!this.#instance) {
      this.#instance = new this();
      await this.#instance.loadExternalLibraries();
    }
    return this.#instance;
  }

  async loadExternalLibraries() {
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const imp = await import('filenamify');
      this.#filenamify = imp.default;
  }

  /** add or update a manga */
  async add(payload: { manga: MangaPage | MangaInDB, settings?: MangaInDB['meta']['options'] }, fromScheduler?: boolean) {
    if(typeof this.#filenamify === 'undefined') throw new Error('call MangasDB.getInstance() first');
    const db = await this.read();
    const alreadyInDB = db.mangas.find(m => m.id === payload.manga.id);
    const filename = this.#filenamify(payload.manga.id);

    // New manga || Manga/lang combo
    if(!isMangaInDB(payload.manga)) {

      // make sure inLibrary is true if the manga is totally new
      payload.manga.inLibrary = true;

      // If manga exists but lang isn't registered we get the reader's settings from the database
      let alreadyInDB_DATA = undefined;
      if(alreadyInDB) alreadyInDB_DATA = await new DatabaseIO(payload.manga.id, resolve(this.path, `${filename}.json`), {} as MangaInDB).read();

      // We define "meta" for this new entry:
      // and past "meta.options" from either the payload, the database (if any), or use default settings
      (payload.manga as MangaInDB).meta = {
        lastUpdate: !alreadyInDB || !fromScheduler ? Date.now() : alreadyInDB.lastUpdate,
        broken: false,
        notify: true,
        update: true,
        options : payload.settings || alreadyInDB_DATA?.meta.options || {
          webtoon: false,
          showPageNumber: true,
          zoomMode: 'auto',
          longStrip: false,
          longStripDirection: 'vertical',
          book: false,
          bookOffset: false,
          overlay: false,
          rtl: false,
        },
      };
    }

    // previous statement made sure "payload.manga" is of type "MangaInDB"
    // this line is only for typescript convenience
    const mangadata = payload.manga as MangaInDB;

    // now only "alreadyInDB" is able to tell us if the manga is actually in the db or not.
    if(alreadyInDB) {
      this.logger('updating manga');
      if(payload.settings) mangadata.meta.options = payload.settings;
      return this.#upsert(mangadata, filename, true, fromScheduler);
    }
    else {
      this.logger('new manga added');
      // save manga data in its own table
      const manga = await this.#upsert(mangadata, filename, false, fromScheduler);
      db.mangas.push({ id: manga.id, url: manga.url, mirror: manga.mirror, langs: manga.langs, file: filename, update: manga.meta.update, lastUpdate: Date.now() });
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
        const mangadb = new DatabaseIO(index.id, resolve(this.path, `${index.file}.json`), manga);
        const data = await mangadb.read();
        data.langs = data.langs.filter(l => l !== lang);
        data.chapters = data.chapters.filter(c => c.lang !== lang);
        await mangadb.write(data);

        if(!data.langs.length && !data.chapters.length) {
          // remove manga database file if there's nothing in.
          unlinkSync(resolve(this.path, `${index.file}.json`));
          data.covers.forEach(c => unlinkSync(resolve(this.path, c.replace(/(.*files\/)?/g, ''))));
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

  async markAsRead(mangaId:string, chaptersUrls:string[], lang:mirrorsLangsType) {
    const db = await this.read();
    const mg = db.mangas.find(m => m.id === mangaId && m.langs.includes(lang));
    if(!mg) return;

    const mangadb = new DatabaseIO(mg.id, resolve(this.path, `${mg.file}.json`), {} as MangaInDB);
    const data = await mangadb.read();
    data.chapters = data.chapters.map(c => {
      if(chaptersUrls.includes(c.url) && c.lang === lang) {
        c.read = !c.read;
      }
      return c;
    });
    mangadb.write(data);
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
    const mangadb = new DatabaseIO(mg.id, resolve(this.path, `${mg.file}.json`), {} as MangaInDB);
    const data = await mangadb.read();
    const covers = this.#getCovers(data.covers);
    return {
      ...data,
      chapters: data.chapters.sort((a, b) => b.number - a.number),
      covers,
    };
  }

  async getIndexes() {
    return (await this.read()).mangas;
  }

  /** @important do not use if you aren't 100% sure the filename points to an existing database */
  async getByFilename(filename:string) {
    const mangadb = new DatabaseIO(filename, resolve(this.path, `${filename}.json`), {} as MangaInDB);
    return mangadb.read();
  }

  async getAll(): Promise<MangaInDB[]>
  async getAll(id:number, socket: socketInstance|Scheduler): Promise<void>
  async getAll(id?:number, socket?:socketInstance|Scheduler): Promise<MangaInDB[]|void> {
    const db = await this.read();
    let cancel = false;
    if(id && socket && !(socket instanceof Scheduler)) {
      socket.once('stopShowLibrary', () => {
        cancel = true;
      });
    }
    const results:MangaInDB[] = [];
    //TODO: Envoyer tout les mangas d'un coup
    for(const manga of db.mangas) {
      if(cancel) break;
      const mg = await this.get({id: manga.id, langs: manga.langs});
      if(mg) results.push(mg);
    }
    if(socket && id) socket.emit('showLibrary', id, results);
    else return results;
  }

  /**
   * add or upsert
   * @param manga Manga to compare with the db
   * @param filename file containing the data
   * @param alreadyInDB if the manga is already in db
   */
  async #upsert(manga:MangaInDB, filename:string, alreadyInDB:boolean, updatedByScheduler?:boolean):Promise<MangaInDB> {
    try {
      this.logger('opening', resolve(this.path, `${filename}.json`));

      const mirror = mirrors.find(m => m.name === manga.mirror.name);
      if(!mirror) throw new Error(`Mirror ${manga.mirror} doesn't exist`);

      // create or get file
      const mangadb = new DatabaseIO(filename, resolve(this.path, `${filename}.json`), manga);
      const db = await this.read();
      let data = await mangadb.read();
      // get the scheduler instance
      const scheduler = Scheduler.getInstance();

      // we check differences between the manga in the db and the manga we want to save
      let hasNewStuff = false;

      // sorting stuff before comparison
      manga.langs = manga.langs.sort();
      data.langs = data.langs.sort();
      manga.covers = [...manga.covers].map(c => c.replace(/^(.*files\/)?/g, '').replaceAll(/^(.*cover_)?/g, '')).sort(); // can include prefix: "http://xx.xx.xx:xx/files/"
      data.covers = [...data.covers].map(c => c.replace(/^(.*files\/)?/g, '').replaceAll(/^(.*cover_)?/g, '')).sort(); // have prefix: "{number}_cover_"
      manga.userCategories = manga.userCategories.sort();
      data.userCategories = data.userCategories.sort();

      if(!alreadyInDB) manga.covers = this.#saveCovers(Array.from(new Set(manga.covers)));
      else {
        if(manga.name !== data.name) hasNewStuff = true;
        if(manga.status !== data.status) hasNewStuff = true;
        if(manga.displayName !== data.displayName) hasNewStuff = true;
        if(!isEqual(manga.userCategories, data.userCategories)) hasNewStuff = true;
        if(!isEqual(manga.meta, data.meta)) hasNewStuff = true;

        if(!isEqual(manga.covers, data.covers)) {
          hasNewStuff = true;
          manga.covers = this.#saveCovers(Array.from(new Set([...manga.covers, ...data.covers])));
          scheduler.addMangaLog({date: Date.now(), id: manga.id, message: 'log_manga_metadata', data: { tag: 'covers' } });
        } else {
          // repopulating because we stripped covers from their prefix
          manga.covers = manga.covers.map((c, i) => `${i}_cover_${c}`);
        }

        if(!isEqual(manga.langs, data.langs)) {
          if(mirror.langs.length === 1 || mirror.mirrorInfo.entryLanguageHasItsOwnURL) {
          // if mirror has one language change its chapter's language
            if(manga.langs[0] !== data.langs[0]) {
              manga.chapters.map(x => {
                return { ...x, lang: manga.langs[0] };
              });
            }
          } else if(manga.langs.some(x => !data.langs.includes(x))) {
          // if manga.langs has some language that data.langs doesn't
            manga.langs = Array.from(new Set([...data.langs, ... manga.langs]));
          }
          hasNewStuff = true;
          scheduler.addMangaLog({date: Date.now(), id: manga.id, message: 'log_manga_metadata', data: { tag: 'langs', oldVal: data.langs, newVal: manga.langs }});
        }

        // checking for new chapters, or new chapter's read status
        for(const chapter of manga.chapters) {
          const chapterInDB = data.chapters.find(c => c.id === chapter.id && c.lang === chapter.lang);
          if(chapterInDB) {
            if(!chapterInDB.read && chapter.read) {
              hasNewStuff = true;
              chapterInDB.read = true;
              scheduler.addMangaLog({ date: Date.now(), id: data.id, message: 'log_chapter_read', data: chapterInDB });
            }
          } else {
            hasNewStuff = true;
            data.chapters.push(chapter); // chapters are stored in data to avoid an additional loop
            scheduler.addMangaLog({ date: Date.now(), id:data.id, message: 'log_chapter_new', data: chapter });
          }
        }
      }

      // chapter are stored in different place depending on alreadyInDB value (see manga.chapters loop)
      data = { ...manga, chapters: alreadyInDB ? data.chapters : manga.chapters, _v: data._v };
      if(updatedByScheduler) data.meta.lastUpdate = Date.now();

      if(updatedByScheduler || hasNewStuff || !alreadyInDB) {
        await mangadb.write(data);
        const find = db.mangas.find(m => m.id === data.id);
        if(!find) return data; // should not happen

        if(find.lastUpdate !== data.meta.lastUpdate || find.update !== data.meta.update || find.broken !== data.meta.broken || !isEqual(find.langs, data.langs)) {
          find.lastUpdate = data.meta.lastUpdate;
          find.update = data.meta.update;
          find.langs = data.langs;
          find.broken = data.meta.broken;
          await this.write(db);
          const indexDB = await MangasDatabase.getInstance();
          const indexes = await indexDB.getIndexes();
          indexDB.write({ mangas: indexes });
        }
      }
      return data;
    } catch(e) {
      this.logger('error', e);
      throw e;
    }
  }

  /** save base64 images to files and returns their filenames */
  #saveCovers(covers:string[]) {
    const path = resolve(this.path);
    const coversAlreadySaved = readdirSync(path, {withFileTypes: true})
      .filter(item => !item.isDirectory() && !item.name.endsWith('.json') && covers.includes(item.name))
      .map(item => item.name);

    covers = covers.map((c, i) => {
      c = c.replace(/^.*\/files\//g, '');
      // if cover is already a filename return as it is
      if(coversAlreadySaved.includes(c)) return c;
      // new cover, save to file
      const coverFileName = `${i}_cover_${c}`;
      const path = resolve(this.path, coverFileName);
      if(!existsSync(path)) {
        const data = FileServer.getInstance('fileserver').get(c);
        if(data) writeFileSync(path, data);
      }
      return coverFileName;
    });
    return Array.from(new Set(covers));
  }

  /** reads files and return their content into an array */
  #getCovers(filenames: string[]) {
    const res:string[] = [];
    filenames.forEach(f => {
      const path = resolve(this.path, f);
      if(existsSync(path)) {
        const serv = FileServer.getInstance('fileserver').serv(readFileSync(path),f);
        res.push(serv);
      }
    });
    return res;
  }
}

