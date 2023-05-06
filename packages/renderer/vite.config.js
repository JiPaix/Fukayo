/* eslint-env node */

import vueI18n from '@intlify/unplugin-vue-i18n/vite';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import { builtinModules } from 'module';
import { join, resolve } from 'path';
import { chrome } from '../../.electron-vendors.cache.json';
import packageJson from '../../package.json';

process.env.VITE_APP_VERSION = packageJson.version;
const PACKAGE_ROOT = __dirname;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  base: '',
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
  plugins: [
    vue({template: transformAssetUrls}),
    vueI18n({
      include: join(PACKAGE_ROOT, '..', 'i18n', 'locales') + '/**',
      strictMessage: false,
    }),
    quasar(),
  ],
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
    assetsDir: 'assets',
    rollupOptions: {
      input: resolve('index.html'),
      external: [
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            const modules = ['quasar', '@quasar', 'vue', '@vue', 'dayjs', '@intlify', '@vueuse', 'vue-i18n'];
            const chunk = modules.find((module) => id.includes(`/node_modules/${module}`));
            if(chunk === 'quasar') {
              if(id.includes('/quasar/lang/')) return `vendor-${chunk}.locales`;
            }

            if(chunk === '@vue') {
              if(id.includes('/devtools-api/lib/')) return `vendor-${chunk}.devtools`;
              if(id.includes('/@vue/runtime-')) return `vendor-${chunk}.runtimes`;
            }
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
