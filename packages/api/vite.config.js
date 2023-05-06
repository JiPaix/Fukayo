import { builtinModules } from 'module';
import { join } from 'path';
import { node } from '../../.electron-vendors.cache.json';

const PACKAGE_ROOT = __dirname;

const externals = [
  ...builtinModules.filter(m => !m.startsWith('_')),
  'express',
  'morgan',
  'socket.io',
  'puppeteer',
  'puppeteer-cluster',
  'puppeteer-extra',
  'puppeteer-extra-plugin-stealth',
  'puppeteer-extra-plugin-adblocker-no-vulnerabilities',
  '@puppeteer/browsers',
  'systeminformation',
  'axios',
  'cheerio',
  'file-type',
  'socket.io-client',
  'socket.io',
  'filenamify',
  'user-agents',
  'form-data',
  'connect-history-api-fallback',
  'openid-client',
  'electron-devtools-installer',
  'image-size',
];


/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: process.cwd(),
  resolve: {
    alias: {
      '@renderer': join(PACKAGE_ROOT, '..', 'renderer', 'src'),
      '@api': join(PACKAGE_ROOT, '..', 'api', 'src'),
      '@main': join(PACKAGE_ROOT, '..', 'main', 'src'),
      '@preload': join(PACKAGE_ROOT, '..', 'preload', 'src'),
      '@assets': join(PACKAGE_ROOT, '..', 'renderer', 'assets'),
      '@buildResources': join(PACKAGE_ROOT, '..', '..', 'buildResources'),
      '@i18n': join(PACKAGE_ROOT, '..', 'i18n', 'src'),
    },
  },
  build: {
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: 'terser',
    lib: {
      formats: ['cjs'],
      entry: './src/index.ts',
      name: 'api',
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      onwarn: (warning) => {
        if(warning.code === 'EVAL') return;
      },
      external: externals,
      output:{
        manualChunks(id) {
          const split = id.split('/');
          if(split[split.length -2] === 'icons') {
            return 'icon.'+[split[split.length -1]];
          }
        },
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
};

export default config;
