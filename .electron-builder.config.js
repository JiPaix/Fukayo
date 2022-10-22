

if (process.env.VITE_APP_VERSION === undefined) {
  process.env.VITE_APP_VERSION = JSON.parse(require('fs').readFileSync('./package.json').toString()).version;
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.electron.fukayo',
  productName: 'Fukayo',
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
    category: 'AudioVideo',
    icon: 'icon_256.png',
  },
  win: {
    target: "nsis",
    icon: 'icon_256.ico',
    // legalTrademarks: undefined,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: "icon_256.ico",
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
