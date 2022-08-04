import { env } from 'node:process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function setupFileServFolder() {
  if(!env.USER_DATA) throw new Error('USER_DATA should be defined');
  const filePath = resolve(env.USER_DATA, '.fileserving');
  if(!existsSync(filePath)) mkdirSync(filePath, { recursive: true });
  return filePath;
}

export function emptyFileServFolder() {
  if(!env.USER_DATA) throw new Error('USER_DATA should be defined');
  const filePath = resolve(env.USER_DATA, '.fileserving');
  if(!existsSync(filePath)) throw new Error('USER_DATA/.fileserving folder does not exist');
  // empty the file-serving directory
  const files = readdirSync(filePath);
  for(const file of files) {
    const path2file = join(filePath, file);
    if(existsSync(path2file)) {
      const stat = statSync(path2file);
      if(!stat.isSymbolicLink()) {
        try {
          unlinkSync(path2file);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * serve a file from the file-serving directory
 * @param data - data to write
 * @param filename - filename to write to
 * @param lifetime - lifetime of the file in seconds
 */
export function serv(data:Buffer, filename:string, lifetime = 600) {
  if(!env.USER_DATA) throw new Error('USER_DATA should be defined');
  const filePath = resolve(env.USER_DATA, '.fileserving', filename);
  writeFileSync(filePath, data);
  setTimeout(() => unserv(filename), lifetime*1000);
  return '/files/'+filename;
}

/**
 * delete a file from the file-serving directory
 * @param filename - filename to delete
 * @returns
 */
export function unserv(filename:string) {
  if(!env.USER_DATA) throw new Error('USER_DATA should be defined');
  const filePath = resolve(env.USER_DATA, '.fileserving', filename);
  try {
    unlinkSync(filePath);
    return true;
  } catch(e) {
    return false;
  }
}
