/* eslint-env node */

import vueI18n from '@intlify/vite-plugin-vue-i18n';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { builtinModules } from 'module';
import { join } from 'path';
import { chrome } from '../../.electron-vendors.cache.json';
// import vuetify from '@vuetify/vite-plugin';

const PACKAGE_ROOT = __dirname;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
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
  plugins: [
    vue({template: transformAssetUrls}),
    vueI18n({
      include: join(PACKAGE_ROOT, 'src', 'locales') + '/**',
    }),
    quasar(),
  ],
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    minify: 'terser',
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: 'index.html',
      external: [
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            const modules = ['quasar', '@quasar', 'vue', '@vue', 'dayjs', '@intlify', '@vueuse', 'vue-i18n'];
            const chunk = modules.find((module) => id.includes(`/node_modules/${module}`));
            return chunk ? `vendor-${chunk}` : 'vendor';
          }
        },
      },
    },

    emptyOutDir: true,
    reportCompressedSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
};

export default config;
