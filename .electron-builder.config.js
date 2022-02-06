

if (process.env.VITE_APP_VERSION === undefined) {
  process.env.VITE_APP_VERSION = JSON.parse(require('fs').readFileSync('./package.json').toString()).version;
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
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
  }
};

module.exports = config;
