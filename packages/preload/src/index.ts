/**
 * @module preload
 */

import { copyImageToClipboard, startServer, stopServer, toggleFullScreen } from '@preload/apiServer';
import { getPath } from '@preload/config';
import { contextBridge } from 'electron';


/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */

/**
 * After analyzing the `exposeInMainWorld` calls,
 * `packages/preload/exposedInMainWorld.d.ts` file will be generated.
 * It contains all interfaces.
 * `packages/preload/exposedInMainWorld.d.ts` file is required for TS is `renderer`
 *
 * @see https://github.com/cawa-93/dts-for-context-bridge
 */

/**
 * Expose Environment versions.
 * @example
 * console.log( window.versions )
 */
contextBridge.exposeInMainWorld('versions', process.versions);

/**
  * Expose the user data path.
  * intended to be used in a vuex store plugin
  */
contextBridge.exposeInMainWorld('getPath', getPath);
contextBridge.exposeInMainWorld('apiServer', { startServer, stopServer, getEnv: import.meta.env.MODE, copyImageToClipboard, toggleFullScreen });
