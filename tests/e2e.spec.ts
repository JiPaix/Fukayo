import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';

let electronApp: ElectronApplication;

beforeAll(async () => {
  electronApp = await electron.launch({args: ['.']});
});

afterAll(async () => {
  await electronApp.close();
});

test('Main window state', async () => {
  const windowState: { isVisible: boolean; isDevToolsOpened: boolean; isCrashed: boolean }
    = await electronApp.evaluate(({BrowserWindow}) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];

    const getState = () => ({
      isVisible: mainWindow.isVisible(),
      isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
      isCrashed: mainWindow.webContents.isCrashed(),
    });

    return new Promise((resolve) => {
      if (mainWindow.isVisible()) {
        resolve(getState());
      } else
        mainWindow.once('ready-to-show', () => setTimeout(() => resolve(getState()), 0));
    });
  });

  expect(windowState.isCrashed, 'App was crashed').toBeFalsy();
  expect(windowState.isVisible, 'Main window was not visible').toBeTruthy();
  expect(windowState.isDevToolsOpened, 'DevTools was opened').toBeFalsy();
});

test('Main window web content', async () => {
  const page = await electronApp.firstWindow();
  const element = await page.$('#app', {strict: true});
  expect(element, 'Can\'t find root element').toBeDefined();
  expect((await element.innerHTML()).trim(), 'Window content was empty').not.equal('');
});


test('Preload versions', async () => {
  const page = await electronApp.firstWindow();
  const exposedVersions = await page.evaluate(() => globalThis.versions);
  const expectedVersions = await electronApp.evaluate(() => process.versions);
  expect(exposedVersions).toBeDefined();
  expect(exposedVersions).to.deep.equal(expectedVersions);
});

test('Preload apiServer', async () => {
  const page = await electronApp.firstWindow();

  const exposed = await page.evaluate(() => globalThis.apiServer);

  expect(exposed).to.haveOwnProperty('startServer');
  expect(exposed).to.haveOwnProperty('stopServer');
  expect(exposed).to.haveOwnProperty('getEnv');

  const startType = await page.evaluate(() => typeof globalThis.apiServer.startServer);
  const stopType = await page.evaluate(() => typeof globalThis.apiServer.stopServer);
  const getEnvType = await page.evaluate(() => typeof globalThis.apiServer.getEnv);

  expect(startType).toEqual('function');
  expect(stopType).toEqual('function');
  expect(getEnvType).toEqual('string');

  const env = await page.evaluate(() => globalThis.apiServer.getEnv);
  expect(env).toEqual('production');
});

test('Server start', async () => {
  const page = await electronApp.firstWindow();
  await page.evaluate( async () => {
    const login = globalThis.document.querySelector<HTMLInputElement>('input[name="login"]');
    login.value = 'test';
    login.dispatchEvent(new Event('input'));
    const password = globalThis.document.querySelector<HTMLInputElement>('input[name="password"]');
    password.value = 'testtest';
    password.dispatchEvent(new Event('input'));
    const port = globalThis.document.querySelector<HTMLInputElement>('input[name="port"]');
    port.value = '3000';
    port.dispatchEvent(new Event('input'));
    const ssl = globalThis.document.querySelector<HTMLInputElement>('#no-ssl');
    ssl.click();
    ssl.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    const button = globalThis.document.querySelector<HTMLButtonElement>('button[type=submit]');
    button.click();
  });
  await new Promise(resolve => setTimeout(resolve, 10000));
});
