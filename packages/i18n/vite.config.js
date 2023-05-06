import { join } from 'path';
import { chrome } from '../../.electron-vendors.cache.json';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';

const PACKAGE_ROOT = __dirname;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: process.cwd(),
  plugins: [
    VueI18nPlugin({ strictMessage: false }),
  ],
  resolve: {
    alias: {
      '@renderer': join(PACKAGE_ROOT, '..', 'renderer', 'src'),
      '@api': join(PACKAGE_ROOT, '..', 'api', 'src'),
      '@main': join(PACKAGE_ROOT, '..', 'main', 'src'),
      '@preload': join(PACKAGE_ROOT, '..', 'preload', 'src'),
      '@assets': join(PACKAGE_ROOT, '..', 'renderer', 'assets'),
      '@buildResources': join(PACKAGE_ROOT, '..', '..', 'buildResources'),
      '@i18n': join(PACKAGE_ROOT, '..', 'i18n', 'src'),
      'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
    },
  },
  build: {
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: 'terser',
    lib: {
      formats: ['cjs'],
      entry: './src/index.ts',
      name: 'i18n',
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            const modules = ['quasar', '@quasar', 'dayjs'];
            const chunk = modules.find((module) => id.includes(`/node_modules/${module}`));
            return chunk ? `vendor-${chunk}` : 'vendor';
          }
        },
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
};

export default config;
