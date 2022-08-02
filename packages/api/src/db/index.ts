import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { env } from 'node:process';
import semver from 'semver';
import { dirname, resolve } from 'node:path';
import packageJson from '../../../../package.json';

type databaseGeneric<T> = T & { _v: string }

export function isPromise<T>(fN: (data: databaseGeneric<T>) => databaseGeneric<T> | Promise<databaseGeneric<T>>): fN is (data: databaseGeneric<T>) => Promise<databaseGeneric<T>> {
  if (fN instanceof Promise) return true;
  return false;
}

/**
 * In memory database which can be saved to disk
 */
export class Database<T> {
  data: databaseGeneric<T>;
  private file:string;
  constructor(filePath: string, defaultData: T) {
    // Get the directory and filename
    const path = dirname(resolve(filePath));
    this.file = resolve(filePath);

    // Create the directory if it doesn't exist
    if(!existsSync(path)) mkdirSync(path, { recursive: true });

    // Read or create the database
    if(existsSync(this.file)) {
      this.data = this.readNoAssign();
      this.autopatch(defaultData);
    }
    else {
      this.data = { ...defaultData, _v: packageJson.version };
      this.write();
    }
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[31m${this.constructor.name}\x1b[0m)` ,...args);
  }

  /**
   * checks if the database is outdated and if so, it will automatically update it
   * @param defaultData the default data to use if the database is not up to date
   */
  private autopatch(defaultData: T) {
    if(semver.gt(packageJson.version, this.data._v)) {
      const newData = Object.keys(defaultData).reduce((acc, key) => {
        if(this.data[key as keyof T] === undefined) {
          acc[key as keyof T] = defaultData[key as keyof T];
        }
        return acc;
      }
      , {} as Partial<T>);
      // write the data anyway so we update _v and don't trigger the autopatch again
      this.data = { ...this.data, ...newData, _v: packageJson.version };
      this.write();
    }
  }
  /**
   * Read the database from disk and load it into memory
   * @important any data that hasn't been saved to disk will be lost
   * @returns the database data
   */
  read() {
    this.data = JSON.parse(readFileSync(this.file, 'utf8'));
    return this.data;
  }

  /** read the database from disk without updating in memory data */
  private readNoAssign() {
    return JSON.parse(readFileSync(this.file, 'utf8'));
  }
  /**
   * Write the database to disk
   * @param data if provided the database will be overwritten with this data
   */
  write() {
    writeFileSync(this.file, JSON.stringify(this.data));
    return this.data;
  }
}

/**
 * File system only database
 */
export class DatabaseIO<T> {
  private file:string;
  constructor(filePath: string, defaultData: T) {
    // check if path exists
    const path = dirname(resolve(filePath));
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
    // check if file exists
    const pathToFile = resolve(filePath);
    this.file = pathToFile;
    if (!existsSync(pathToFile)) {
      this.write({ ...defaultData, _v: packageJson.version });
    } else {
      this.autopatch(defaultData);
    }
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[31m${this.constructor.name}\x1b[0m)` ,...args);
  }

  read():databaseGeneric<T> {
    return JSON.parse(readFileSync(this.file, 'utf8'));
  }

  write(data: T) {
    if((data as databaseGeneric<T>)._v == undefined) (data as databaseGeneric<T> )._v = packageJson.version;
    writeFileSync(this.file, JSON.stringify(data));
    return data as databaseGeneric<T>;
  }

  /**
   * checks if the database is outdated and if so, it will automatically update it
   * @param defaultData the default data to use if the database is not up to date
   */
  autopatch(defaultData: T) {
    const oldData = this.read();
    if(semver.gt(packageJson.version, oldData._v)) {
      this.logger('Updating database version');
      const newData = Object.keys(defaultData).reduce((acc, key) => {
        if(oldData[key as keyof T] === undefined || typeof oldData[key as keyof T] !== typeof defaultData[key as keyof T]) {
          acc[key as keyof T] = defaultData[key as keyof T];
        }
        return acc;
      }
      , {} as Partial<T>);
      // write the data anyway so we update _v and don't trigger the autopatch again
      this.write({ ...oldData, ...newData, _v: packageJson.version });
    }
  }
}
