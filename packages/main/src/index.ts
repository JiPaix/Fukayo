import type { startPayload } from '@api/app/types';
import icon from '@buildResources/icon_32.png';
import { forkAPI } from '@main/forkAPI';
import { restoreOrCreateWindow, showWindow } from '@main/mainWindow';
import type { Paths } from '@preload/config';
import { findLocale } from '@renderer/locales/lib/findLocale';
import { app, clipboard, ipcMain, Menu, nativeImage, Tray } from 'electron';
import './security-restrictions';


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
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  // for macOS
  if (process.platform == 'darwin') app.dock.hide();
});

/**
 * Stop the api before quitting
 */
let isAppQuitting = false;
app.on('before-quit', async() => {
  isAppQuitting = true;
  if(!api) return;
  const stop = await api.stop();
  if(import.meta.env.DEV) {
    if(stop.success) console.log('api stopped');
    else console.error('api stop failed');
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
  .then(win => {
    win.on('close', function (evt) {
      if (!isAppQuitting) {
        evt.preventDefault(); // Prevent window from closing
        win.hide();
      }
  });
  })
  .catch((e) => console.error('Failed create window:', e));

/**
 * Install Vue.js or some other devtools in development mode only
 */
if (import.meta.env.DEV) {
  app.whenReady()
    .then(() => import('electron-devtools-installer'))
    .then(({default: installExtension}) => installExtension(
      {
        id: 'nhdogjmejiglipccpnnnanhbledajbpd',
        electron: '>=18.0.2',
      }
      ,{
        loadExtensionOptions: {
          allowFileAccess: true,
        },
      },
    ))
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
 * System tray icon
 */
let tray = null;
app.whenReady()
  .then(() => {
    const lang = findLocale(app.getLocale());
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    return import(`../../renderer/src/locales/${lang}.json`) as Promise<{ default: typeof import('../../renderer/src/locales/en.json') }>;
  })
  .then((l) => {
    tray = new Tray(nativeImage.createFromDataURL(icon));
    const contextMenu = Menu.buildFromTemplate([
      { label: l.default.electron.systemtray.show, click: showWindow, type: 'normal'},
      { type: 'separator'},
      { label: l.default.electron.systemtray.quit, role: 'quit', type: 'normal' },
    ]);
    tray.setToolTip('Fukayo');
    tray.setContextMenu(contextMenu);
});

/** Ignore SSL errors */
app.commandLine.appendSwitch('ignore-certificate-errors');

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
