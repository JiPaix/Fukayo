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
      onwarn: (warning) => {
        if(warning.code === 'EVAL') return;
      },
      external: [
        'express',
        'morgan',
        'socket.io',
        'node:crypto',
        'node:process',
        'node:fs',
        'node:http',
        'node:https',
        'node-forge',
        'node:fs',
        'node:path',
        'node:events',
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
      ],
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
