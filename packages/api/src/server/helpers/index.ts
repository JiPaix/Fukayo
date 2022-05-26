import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { env } from 'node:process';

function getAllCacheFiles(dirPath?:string, arrayOfFiles?:string[]): string[] {
  const path = dirPath || resolve(env.USER_DATA, '.cache');
  const files = readdirSync(path);
  let res = arrayOfFiles || [];

  files.forEach(function(file) {
    if(existsSync(join(path, file))) {
      const stat = statSync(path + '/' + file);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        res = getAllCacheFiles(path + '/' + file, res);
      } else if(!stat.isSymbolicLink()) {
        const filePath = join(path, file);
        res.push(filePath);
      }
    }
  });
  return res;
}

function getAllCacheFilesSize(files?:string[]) {
  if(!files) files = getAllCacheFiles(resolve(env.USER_DATA, '.cache'));
  return files.reduce((acc, f) => {
    const stat = statSync(f);
    return acc + stat.size;
  }
  , 0);
}

export function getAllCacheFilesAndSize(dirPath?:string): {files: string[], size: number} {
  const path = dirPath || resolve(env.USER_DATA, '.cache');
  const files = getAllCacheFiles(path);
  const size = getAllCacheFilesSize(files);
  return { files, size };
}


export function removeAllCacheFiles(files?:string[]) {
  if(!files) files = getAllCacheFiles(resolve(env.USER_DATA, '.cache'));
  files.forEach(f => unlinkSyncNoError(f));
}

function unlinkSyncNoError(filePath:string) {
  try {
    unlinkSync(filePath);
  } catch(e) {
    return;
  }
}
