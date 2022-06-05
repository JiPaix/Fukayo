import { resolve } from 'node:path';
import { env } from 'node:process';
import { Database } from '.';

const defaultSettings = {
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

export class SettingsDB extends Database<typeof defaultSettings> {
  constructor() {
    if(typeof env.USER_DATA === 'undefined') throw Error('USER_DATA is not defined');
    super(resolve(env.USER_DATA, 'settings_db.json'), defaultSettings);
  }
}

export const SettingsDatabase = new SettingsDB();
