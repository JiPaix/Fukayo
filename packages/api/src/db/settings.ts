import { Database } from '@api/db';
import { resolve } from 'path';
import { env } from 'process';
import type { mirrorsLangsType } from '@i18n';

const defaultSettings = {
  langs: ['en', 'fr', 'de', 'pt', 'pt-br', 'es', 'es-la', 'ru', 'tr', 'ja', 'id', 'zh', 'zh-hk'] as mirrorsLangsType[],
  cache: {
    age : {
      max: 1000 * 60 * 60 * 24 * 7, // 1 week
      enabled: true,
    },
    size: {
      max: 3500000000, // 3.5 GB in bytes
      enabled: true,
    },
    logs: {
      enabled: true,
      max: 30,
    },
  },
  library: {
    waitBetweenUpdates: 1000 * 60 * 60 * 6, // 6 hours
    logs: {
      enabled: true,
      max: 100,
    },
  },
};

export default class SettingsDatabase extends Database<typeof defaultSettings> {
  static #instance:SettingsDatabase;
  constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, 'settings_db.json'), defaultSettings);
  }
  static getInstance(): SettingsDatabase {
    if (!this.#instance) {
      this.#instance = new this();
    }
    return this.#instance;
  }
}
