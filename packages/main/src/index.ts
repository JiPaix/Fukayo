import { restoreOrCreateWindow } from '@main/mainWindow';
import { app } from 'electron';
import Ready from './appReady';
import './security-restrictions';

if(app.commandLine.hasSwitch('server')) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('headless');
}

/**
 * Prevent multiple instances
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  // for macOS
  if (process.platform == 'darwin') app.dock.hide();
});

/**
 * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
 */
app.on('activate', restoreOrCreateWindow);

/** Ignore SSL errors */
app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady().then(() => new Ready());
