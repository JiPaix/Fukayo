import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { env } from 'node:process';
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
    if(existsSync(this.file)) this.data = this.readNoAssign();
    else {
      this.data = { ...defaultData, _v: packageJson.version };
      this.write();
    }
  }

  protected logger(...args: unknown[]) {
    if(env.MODE === 'development') console.log('[api]', `(\x1b[31m${this.constructor.name}\x1b[0m)` ,...args);
  }

  /**
   * Apply patches to a database depending on the version
   * @param targets version the database should be upgraded to
   * @param fN function to upgrade the database to the next version
   */
  patch(targets:string[], fN: (data: databaseGeneric<T>|undefined) => void) {
    if(targets.includes(this.data._v)) {
      return fN(this.data);
    }
    return fN(undefined);
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
   * Apply patches to a database depending on the version
   * @param targets version the database should be upgraded to
   * @param fN function to upgrade the database to the next version
   */
   patch(targets:string[], fN: (data: databaseGeneric<T>) => databaseGeneric<T>|Promise<databaseGeneric<T>>) {
    const oldData = this.read();
    isPromise;
    if(targets.includes(oldData._v)) {
      const fun = fN;
      if(isPromise(fun)) {
        fun(oldData).then(data => this.write(data));
        fun(oldData).then(data => this.write(data));
      } else {
        fun(oldData);
      }
    }
  }
}
