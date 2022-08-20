import { builtinModules } from 'module';
import { join } from 'path';
import { chrome } from '../../.electron-vendors.cache.json';

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
      '@renderer/': join(PACKAGE_ROOT, '..', 'renderer', 'src') + '/',
      '@api/': join(PACKAGE_ROOT, '..', 'api', 'src') + '/',
      '@main/': join(PACKAGE_ROOT, '..', 'main', 'src') + '/',
      '@preload/': join(PACKAGE_ROOT, '..', 'preload', 'src') + '/',
      '@assets/': join(PACKAGE_ROOT, '..', 'renderer', 'assets') + '/',
      '@buildResources/': join(PACKAGE_ROOT, '..', '..', 'buildResources') + '/',
    },
  },
  build: {
    sourcemap: 'inline',
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        entryFileNames: '[name].cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
};

export default config;
