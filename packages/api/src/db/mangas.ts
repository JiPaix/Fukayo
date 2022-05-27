import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { DatabaseIO } from './index';
import type { MangaInDB } from './../models/types/manga';
import type { socketInstance } from '../server/types';

type Mangas = {
  mangas: {
    id: string,
    mirror:string,
    url: string,
    file: string,
    lang: string,
  }[]
}

export class MangasDB extends DatabaseIO<Mangas> {
  private path: string;
  constructor() {
    super(resolve(env.USER_DATA, '.mangasdb', 'index.json'), { mangas: [] });
    this.path = resolve(env.USER_DATA, '.mangasdb');
  }

  async add(manga: MangaInDB) {
    const db = this.read();
    const alreadyInDB = db.mangas.find(m => m.id === manga.id);
    const filename = await this.filenamify(manga.id);
    if(alreadyInDB) return this.patch(manga, filename);
    db.mangas.push({ id: manga.id, url: manga.url, mirror: manga.mirror, lang: manga.lang, file: filename });
    this.write(db);
    this.patch(manga, filename);
  }

  remove(manga: MangaInDB) {
    const db = this.read();
    const data = db.mangas.find(m => m.id === manga.id && m.url === manga.url && m.mirror === manga.mirror && m.lang === manga.lang);
    if(data) {
      try {
        unlinkSync(data.file);
      } catch {
        // => ignore errors
      }
    }
    db.mangas = db.mangas.filter(m => m.id !== manga.id);
    this.write(db);
  }

  has(mirror:string, lang:string, url:string): boolean {
    const db = this.read();
    return db.mangas.find(m => m.mirror === mirror && m.lang === lang && m.url === url) !== undefined;
  }

  get(mirror:string, lang:string, url:string):MangaInDB|undefined {
    const db = this.read();
    const manga = db.mangas.find(m => m.mirror === mirror && m.lang === lang && m.url === url);
    if(!manga) return;
    const mangadb = new DatabaseIO(resolve(this.path, `${manga.file}.json`), {} as MangaInDB);
    const data = mangadb.read();
    return {
      ...data,
      covers: this.getCovers(data.covers),
    };
  }

  getAll(id:number, socket:socketInstance) {
    const db = this.read();
    let cancel = false;
    socket.once('stopShowLibrary', () => {
      cancel = true;
    });
    for(const manga of db.mangas) {
      if(cancel) break;
      const mg = this.get(manga.mirror, manga.lang, manga.url);
      if(mg) socket.emit('showLibrary', id, mg);
    }
  }

  private patch(manga:MangaInDB, filename:string) {
    const mangadb = new DatabaseIO(resolve(this.path, `${filename}.json`), manga);
    let data = mangadb.read();
    data = {...manga, covers: this.saveCovers(manga.covers, filename), _v: data._v };
    mangadb.write(data);
  }

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
