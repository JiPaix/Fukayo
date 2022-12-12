import { randomBytes } from 'crypto';
import type { ElectronApplication } from 'playwright';
import { _electron as electron } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';

let electronApp: ElectronApplication;

beforeAll(async () => {
  electronApp = await electron.launch({args: ['.']});
  await electronApp.waitForEvent('window');
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
  // on startup the app tries to directly connect the user to the server
  await page.waitForSelector('#app');
  const root = await page.$('#app', {strict: true});
  expect(root).to.not.be.null;
  if(!root) return;
  expect((await root.innerHTML()).trim(), 'Window content was empty').not.equal('');
});


test('Preload versions', async () => {
  const page = await electronApp.firstWindow();
  expect(page.evaluate).to.be.a.toBeDefined();
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

test('Server setup', async () => {
  const page = await electronApp.firstWindow();
  const randomLogin = randomBytes(6).toString('hex');
  const randomPassword = randomBytes(10).toString('hex');

  await page.locator('input[name="login"]' ).fill(randomLogin);
  await page.locator('input[name="password"]').fill(randomPassword);
  await page.locator('input[name="port"]').fill('3000');
  await page.locator('#no-ssl').click();
  await page.locator('button[type=submit]').click();

});

test('Server is running', async () => {
  const page = await electronApp.firstWindow();
  await page.waitForSelector('.w-100');
  const library = await page.$('.w-100');
  expect(library).to.not.be.null;
});
