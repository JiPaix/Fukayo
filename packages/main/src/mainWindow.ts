import icon from '@buildResources/icon_128.png';
import { BrowserWindow, globalShortcut, nativeImage } from 'electron';
import { join } from 'path';
import { URL } from 'url';

async function createWindow(bounds?: Electron.Rectangle) {
  const browserWindow = new BrowserWindow({
    roundedCorners: true,
    show: false, // Use 'ready-to-show' event to show window
    x: bounds?.x,
    y: bounds?.y,
    height: bounds?.height,
    width: bounds?.width,
    webPreferences: {
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like iframe or Electron's BrowserView. https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(__dirname, '../../preload/dist/index.cjs'),
    },
    icon: import.meta.env.MODE === 'test' ? join(__dirname, '../../../buildResources/icon_128.png') : nativeImage.createFromDataURL(icon),
  });

  /**
   * Do not allow page refreshes in production
   */
  if(import.meta.env.PROD) {
    browserWindow.on('focus', () => {
      globalShortcut.register('CommandOrControl+R', () => { /** */ });
      globalShortcut.register('CommandOrControl+Shift+I', () => { /** */ });
      globalShortcut.register('F5', () => { /** */ });
    });

    browserWindow.on('blur', () => {
      globalShortcut.unregisterAll();
    });
  }

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  browserWindow.on('ready-to-show', () => {
    browserWindow?.setMenuBarVisibility(false);
    browserWindow?.show();

    if (import.meta.env.DEV) {
      browserWindow?.webContents.openDevTools();
    }
  });

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test
   */
  const pageUrl = import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
    ? import.meta.env.VITE_DEV_SERVER_URL
    : new URL('../renderer/dist/index.html', 'file://' + __dirname).toString();


  await browserWindow.loadURL(pageUrl);

  return browserWindow;
}

/**
 * Restore existing BrowserWindow or Create new BrowserWindow
 */
export async function restoreOrCreateWindow(bounds?: Electron.Rectangle) {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow(bounds);
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
  return window;
}

/** hide window instead of closing it */
export async function hideWindow() {
  const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
  if (window) {
    window.hide();
  }
}

/** show window instead of reloading it */
export async function showWindow() {
  const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
  if (window) {
    window.show();
  }
}
