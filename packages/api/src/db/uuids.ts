import { Database } from '@api/db';
import type { mirrorsLangsType } from '@i18n/index';
import { resolve } from 'path';
import { env } from 'process';
import { v5 as uuidv5 } from 'uuid';

export type uuid = {
  mirror: { name: string, version: number };
  langs: mirrorsLangsType[],
  /**
   * chapter url
   *
   * @important if chapters share the same url the same uuid will be generated
   * @workaround append the chapter number/index/some other identifier at the end of the url
   */
  url: string
  id: string
}

type uuids = {
  ids: uuid[];
}

const defaultSettings = {
  ids: [],
};

export class UUID extends Database<uuids> {
  readonly #NAMESPACE = 'af68caec-20c3-495a-90ff-0350710bc7a3';
  #pending: number;
  static #instance: UUID;

  private constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, 'uuid_db.json'), defaultSettings);
    this.#pending = 0;
    setInterval(async () => {
      if(this.#pending > 0) {
        await this.write();
        this.#pending = 0;
      }
    }, 1000 * 60);
  }

  static getInstance(): UUID {
    if (!this.#instance) {
      this.#instance = new this();
    }

    return this.#instance;
  }

  #find(id: Omit<uuid, 'id'>) {
    return this.data.ids.find(i => i.mirror === id.mirror && i.langs.some(l => id.langs.includes(l)) && i.url === id.url);
  }

  #save(id: Omit<uuid, 'id'>) {
    const uuid = uuidv5(id.mirror + id.url, this.#NAMESPACE);
    // update uuid if it already exists
    const search = this.data.ids.findIndex(i => i.id === uuid);
    if(search > -1) this.data.ids[search] = { ...id, id: uuid, langs: Array.from(new Set(this.data.ids[search].langs.concat(id.langs))) };
    else this.data.ids.push({id: uuid, ...id});
    this.#pending++;
    return uuid;
  }

  generate(uuid: Omit<uuid, 'id'>): string
  generate(uuid: uuid, force:true):string
  generate(uuid: Omit<uuid, 'id'> | uuid, force?:boolean):string {
    const find = this.#find(uuid);
    if(find && find.id) return find.id;
    if(force && (uuid as uuid).id) return this.#force(uuid as uuid & { id: string });
    return this.#save(uuid);
  }

  #force(uuid: uuid & { id: string }):string {
    // update uuid if it already exists
    const search = this.data.ids.findIndex(i => i.id === uuid.id);
    if(search > -1) this.data.ids[search] = { ...this.data.ids[search], url: uuid.url,langs: Array.from(new Set(this.data.ids[search].langs.concat(uuid.langs))) };
    else this.data.ids.push(uuid);
    this.#pending++;
    return uuid.id;
  }

  remove(id: string) {
    this.data.ids = this.data.ids.filter(i => i.id !== id);
    this.#pending++;
  }
}
