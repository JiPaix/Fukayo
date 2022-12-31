import type { startPayload } from '@api/app/types';
import icon from '@buildResources/icon_32.png';
import { findAppLocale, loadLocale } from '@i18n';
import type { Paths } from '@preload/config';
import { app, clipboard, ipcMain, Menu, nativeImage, Tray } from 'electron';
import type { ForkResponse } from './../../api/src/app/types/index';
import { forkAPI } from './forkAPI';
import { restoreOrCreateWindow, showWindow } from './mainWindow';

export default class Ready {
  #isAppQuitting: boolean;
  #api: forkAPI | undefined;
  #tray: Tray|undefined;
  #headless: boolean;

  constructor() {
    this.#isAppQuitting = false;
    this.#api = undefined;
    this.#headless = app.commandLine.hasSwitch('server');
    /** close the API before quitting */
    const setup = import.meta.env.DEV ? this.devSetup : this.prodSetup;
    setup().then(() => this.#headless ? this.serverSetup() : this.desktopSetup());
    app.on('before-quit', this.quit.bind(this));
  }

  #logger(err: boolean, ...args: unknown[]) {
    if(import.meta.env.DEV) {
      if(!err) return console.log(...args);
      return console.error(...args);
    }
  }

  async quit() {
    this.#logger(false, '\x1b[1mSHUTTING DOWN...\x1b[0m');
    this.#isAppQuitting = true;
    if(this.#api) {
      const stop = await this.#api.stop();
      if(import.meta.env.DEV) {
        if(stop.success) this.#logger(false, '\x1b[1mSHUTDOWN SUCCESS\x1b[0m');
        else this.#logger(true, '\x1b[1mSHUTDOWN FORCED\x1b[0m');
      }
    }
  }

  async devSetup() {
    try {
      const imp = await import('electron-devtools-installer');
      await imp.default(
        {
          id: 'nhdogjmejiglipccpnnnanhbledajbpd',
          electron: '>=18.0.2',
        }
        ,{
          loadExtensionOptions: {
            allowFileAccess: true,
          },
        },
      );
    } catch(e) {
      console.log('[main]', 'failed to install extension:', e);
    }
  }

  async prodSetup() {
    try {
      const { autoUpdater } = await import('electron-updater');
      await autoUpdater.checkForUpdatesAndNotify();
      // check for updates every 5 minutes
      const check = setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[api]', e));
        autoUpdater.once('update-downloaded', () => {
          clearInterval(check);
        });
      }, 5*60*1000);
    } catch(e) {
      console.log('[main]', 'failed to check for updates', e);
    }
  }

  async serverSetup() {
    if(!app.commandLine.hasSwitch('login')) throw new Error('--login missing');
    if(!app.commandLine.hasSwitch('password')) throw new Error('--password missing');
    if(!app.commandLine.hasSwitch('port')) throw new Error('--port missing');

    const login = app.commandLine.getSwitchValue('login');
    const password = app.commandLine.getSwitchValue('password');
    const portStr = app.commandLine.getSwitchValue('port');

    // checking values
    if(!login.length) throw new Error('--login cannot be an empty string');
    if(!password.length) throw new Error('--password cannot be an empty string');
    if(!portStr || typeof portStr !== 'string') throw new Error(`--port unexpected value: ${typeof portStr}`);
    const port = parseInt(portStr);
    if(isNaN(port)) throw new Error(`--port unexpected value: ${typeof portStr}, ${port}`);
    if(port <= 1024 || port >= 65535) throw new Error(`--port must be between 1024 and 65535: got ${port}`);

    this.#api = new forkAPI({login,password, port, ssl: 'false' });
    const { fork } = await this.#api.start();
    if(!fork) throw Error('couldnt start server');
    fork.on('message', (msg:ForkResponse) => {
      if(msg.type !== 'shutdownFromWeb') return;
      app.quit();
    });
  }

  async desktopSetup() {
    // create window
    const win = await restoreOrCreateWindow();
    // Prevent application from closing when main window is closed.
    win.on('close', (evt) => {
      if (!this.#isAppQuitting) {
        evt.preventDefault();
        win.hide();
      }
    });

    // system tray icon setup
    const lang = findAppLocale(app.getLocale());
    const locale = await loadLocale(lang);
    this.#tray = new Tray(nativeImage.createFromDataURL(icon));
    const contextMenu = Menu.buildFromTemplate([
      { label: locale.electron.systemtray.show, click: showWindow, type: 'normal'},
      { type: 'separator'},
      { label: locale.electron.systemtray.quit, role: 'quit', type: 'normal' },
    ]);
    this.#tray.setToolTip('Fukayo');
    this.#tray.setContextMenu(contextMenu);

    // IPC

    // start the server from the UI
    ipcMain.handle('start-server', async (ev,  payload: startPayload) => {
      this.#api = new forkAPI(payload);
      const start = await this.#api.start();
      return start.resp;
    });
    // returns user data path
    ipcMain.handle('get-path', (ev, path:Paths) => {
      return app.getPath(path);
    });

    // image to clipboard
    ipcMain.handle('copy-image-to-clipboard', (ev, string: string) => {
      const img = nativeImage.createFromDataURL(string);
      return clipboard.writeImage(img);
    });

  }
}
