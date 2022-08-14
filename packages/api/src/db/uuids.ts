import { Database } from './';
import { env } from 'node:process';
import { resolve } from 'node:path';
import { v5 as uuidv5 } from 'uuid';

export type uuid = {
  id: string;
  mirror: string;
  lang: string;
  url: string;
}

type uuids = {
  ids: uuid[];
}

const defaultSettings = {
  ids: [],
};

export class UUID extends Database<uuids> {
  private readonly NAMESPACE = 'af68caec-20c3-495a-90ff-0350710bc7a3';
  private pending: number;
  private static instance: UUID;

  private constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, 'uuid_db.json'), defaultSettings);
    this.pending = 0;
    setInterval(async () => {
      if(this.pending > 0) {
        await this.write();
        this.pending = 0;
      }
    }, 1000 * 60);
  }

  static getInstance(): UUID {
    if (!this.instance) {
      this.instance = new this();
    }

    return this.instance;
  }

  private find(id: Omit<uuid, 'id'>) {
    return this.data.ids.find(i => i.mirror === id.mirror && i.lang === id.lang && i.url === id.url);
  }

  private save(id: Omit<uuid, 'id'>) {
    const uuid = uuidv5(id.mirror + id.lang + id.url, this.NAMESPACE);
    this.data.ids.push({id: uuid, ...id});
    this.pending++;
    return uuid;
  }

  generate(id: Omit<uuid, 'id'>) {
    const find = this.find(id);
    if(find) return find.id;
    return this.save(id);
  }
}
