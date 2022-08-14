import {node} from '../../.electron-vendors.cache.json';
import {join} from 'path';
import { builtinModules } from 'module';

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
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
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
