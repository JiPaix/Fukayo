import { app, ipcMain } from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import type { startPayload } from './forkedAPI';
import { ForkedAPI } from './forkedAPI';

const api = new ForkedAPI();
app.commandLine.appendSwitch('ignore-certificate-errors');

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

/**
 * Returns the user data path
 */
ipcMain.handle('userData', () => {
  return app.getPath('userData');
});

ipcMain.handle('start-server', (ev,  payload: startPayload) => {
  return api.start(payload);
});
