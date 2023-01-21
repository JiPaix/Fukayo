import Scheduler from '@api/server/scheduler';

export function removeAllCacheFiles() {
  const files = Scheduler.getAllCacheFiles();
  files.forEach(file => Scheduler.unlinkSyncNoFail(file.filename));
  Scheduler.getInstance().addCacheLog('cache', files.length, files.reduce((acc, f) => acc + f.size, 0));
}
