import './security-restrictions';
import { app, ipcMain, nativeImage, clipboard } from 'electron';
import { restoreOrCreateWindow } from '/@/mainWindow';
import { forkAPI } from './forkAPI';
import type { Paths } from './../../preload/src/config';
import type { startPayload } from '../../api/src/app/types';

/** API instance */
let api: forkAPI|undefined;

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
 * Disable Hardware Acceleration for more power-save
 */
app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async() => {
  if(!api) return;
  const stop = await api.stop();
  if(stop.success) console.log('api stopped');
  else console.error('api stop failed');
});
/**
 * @see https://www.electronjs.org/docs/v14-x-y/api/app#event-activate-macos Event: 'activate'
 */
app.on('activate', restoreOrCreateWindow);


/**
 * Create app window when background process will be ready
 */
app.whenReady()
  .then(restoreOrCreateWindow)
  .catch((e) => console.error('Failed create window:', e));


/**
 * Install Vue.js or some other devtools in development mode only
 */
if (import.meta.env.DEV) {
  app.whenReady()
    .then(() => import('electron-devtools-installer'))
    .then(({default: installExtension, VUEJS3_DEVTOOLS}) => installExtension(VUEJS3_DEVTOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true,
      },
    }))
    .catch(e => console.error('Failed install extension:', e));
}

/**
 * Check new app version in production mode only
 */
if (import.meta.env.PROD) {
  app.whenReady()
    .then(() => import('electron-updater'))
    .then(({autoUpdater}) => autoUpdater.checkForUpdatesAndNotify())
    .catch((e) => console.error('Failed check updates:', e));
}

/** Ignore SSL errors */
app.commandLine.appendSwitch('ignore-certificate-errors');

/** exposed to main world funtions */

// returns user data path
ipcMain.handle('get-path', (ev, path:Paths) => {
  return app.getPath(path);
});

// start the API
ipcMain.handle('start-server', (ev,  payload: startPayload) => {
  api = new forkAPI(payload);
  return api.start();
});

// image to clipboard
ipcMain.handle('copy-image-to-clipboard', (ev, string: string) => {
  const img = nativeImage.createFromDataURL(string);
  return clipboard.writeImage(img);
});
