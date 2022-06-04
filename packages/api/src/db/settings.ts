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
      max: 1024 * 1024 * 1024, // max 1GB
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

class SettingsDB extends Database<typeof defaultSettings> {
  constructor() {
    super(resolve(env.USER_DATA, 'settings_db.json'), defaultSettings);
  }
}

export const SettingsDatabase = new SettingsDB();
