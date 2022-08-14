import {node} from '../../.electron-vendors.cache.json';
import {join} from 'path';
import {builtinModules} from 'module';

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
      entry: './src/index.ts',
      name: 'main',
      formats: ['cjs'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-devtools-installer',
        ...builtinModules.filter(m => !m.startsWith('_')),
      ],
      output: {
        entryFileNames: '[name].cjs',
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            const path = id.split('/node_modules/')[1];
            const subpath = path.split('/')[0];
            return `${subpath}/index`;
          }
        },
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
};

export default config;
