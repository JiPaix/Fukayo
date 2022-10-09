import { Scheduler, SchedulerClass } from '@api/server/scheduler';

export function removeAllCacheFiles() {
  const files = SchedulerClass.getAllCacheFiles();
  files.forEach(file => SchedulerClass.unlinkSyncNoFail(file.filename));
  Scheduler.addCacheLog('cache', files.length, files.reduce((acc, f) => acc + f.size, 0));
  Scheduler.restartCache();
}
