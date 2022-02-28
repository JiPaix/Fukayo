import {app, ipcMain, BrowserWindow} from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';



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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
 * Returns the user data path when vuex store plugin is used
 */
ipcMain.handle('userData', () => {
  return app.getPath('userData');
});

ipcMain.handle('quit', (event) => {
  const id = event.sender.id;
  if(id === 1) BrowserWindow.getAllWindows().forEach(w => w.close());
  else BrowserWindow.fromId(id)?.close();
});

ipcMain.handle('minimize', (event) => {
  const id = event.sender.id;
  BrowserWindow.fromId(id)?.minimize();
});

ipcMain.handle('maximize', (event) => {
  const window = BrowserWindow.fromId(event.sender.id);
  if(!window) return;
  if(window.isMaximized()) {
    window.unmaximize();
    return false;
  }
  window.maximize();
  return true;
});
