import {node} from '../../.electron-vendors.cache.json';
import {join} from 'path';

const PACKAGE_ROOT = __dirname;

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
    sourcemap: 'inline',
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: 'src/index.ts',
      name: 'api',
      fileName: 'index',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'express',
        'morgan',
        'socket.io',
        'node:crypto',
        'node:fs',
        'node:http',
        'node:https',
        'node-forge',
        'node:fs',
        'node:path',
        'puppeteer',
        'puppeteer-cluster',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'puppeteer-extra-plugin-adblocker-no-vulnerabilities',
        'systeminformation',
        'axios',
        'cheerio',
        'file-type',
      ],
      output:{
        manualChunks(id) {
          if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }

          const chunk = id.split('/');
          const isMirror = chunk[chunk.length - 2] === 'mirrors';
          const isMirrorIcon = chunk[chunk.length - 2] === 'icons' && chunk[chunk.length - 3] === 'mirrors';
          if(isMirror) return chunk[chunk.length - 1].replace(/\.\w+$/, '');
          if(isMirrorIcon) return chunk[chunk.length - 1].replace(/\.\w+$/, '.icon');
        },
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
};

export default config;
