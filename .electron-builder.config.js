

if (process.env.VITE_APP_VERSION === undefined) {
  process.env.VITE_APP_VERSION = JSON.parse(require('fs').readFileSync('./package.json').toString()).version;
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.electron.electronmangasreader',
  productName: 'Electron Mangas Reader',
  // copyright: '',
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  files: [
    'packages/**/dist/**',
  ],
  extraMetadata: {
    version: process.env.VITE_APP_VERSION,
  },
  linux: {
    target: "appImage",
    synopsis: 'Read your favorite manga',
    category: 'Utility',
    icon: 'buildResources/icon_256.png',
  },
  win: {
    target: "nsis",
    icon: 'buildResources/icon_256.ico',
    // legalTrademarks: undefined,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: "buildResources/icon_256.ico",
    // installerHeaderIcon: "buildResources/icons/win/icon.ico",
    // license: "eula.txt",
  },
  // mac: {
  //   category: 'public.app-category.utilities',
  //   target: 'dmg',
    // icon: 'buildResources/icons/mac/icon.icns',
  // },
  // dmg: {

  // }
};

module.exports = config;
