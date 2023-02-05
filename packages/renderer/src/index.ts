import Root from '@renderer/App.vue';
import { createApp } from 'vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

// LocalStorage
import { piniaLocalStorage } from '@renderer/stores/localStorage';
import { createPinia } from 'pinia';
const pinia = createPinia();
pinia.use(piniaLocalStorage);

// Router
const router = createRouter({
  history: typeof window.apiServer === 'undefined' ? createWebHistory() : createWebHashHistory(),
  routes: [
      {
        name: 'home',
        path: '/',
        component: () => import('@renderer/components/library/App.vue'),
      },
      {
        name: 'search',
        path: '/search',
        component: () => import('@renderer/components/search/App.vue'),
        props: route => ({ query: route.query.q, langs: route.query.langs }),
      },
      {
        name: 'manga',
        path: '/manga/:mirror/:id/:lang',
        component: () => import('@renderer/components/manga/App.vue'),
        props: true,
      },
      {
        name: 'reader',
        path: '/manga/:mirror/:id/:lang/read/:chapterId',
        component: () => import('@renderer/components/reader/App.vue'),
        props: true,
      },
      {
        name: 'explore',
        path: '/explore',
        component: () => import('@renderer/components/explore/App.vue'),
      },
      {
        name: 'explore_mirror',
        path: '/explore/:mirror',
        component: () => import('@renderer/components/explore/SourceExplore.vue'),
      },
      {
        name: 'settings',
        path: '/settings/:tab?',
        component: () => import('@renderer/components/settings/App.vue'),
      },
      {
        name: 'import',
        path: '/import',
        component: () => import('@renderer/components/import/App.vue'),
      },
      {
        name: 'logs',
        path: '/logs',
        component: () => import('@renderer/components/logs/App.vue'),
      },
    ],
});

// Quasar
import { Dialog, Loading, Notify, Quasar } from 'quasar';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/** @ts-ignore */
import('@fontsource/roboto');
import('@quasar/extras/material-icons/material-icons.css');
import('@quasar/extras/material-icons-outlined/material-icons-outlined.css');
import('@quasar/extras/material-icons-round/material-icons-round.css');
import('quasar/dist/quasar.css');

const QuasarConfig = {
  plugins: { Dialog, Notify, Loading },
  config: {
    brand: {
      primary: '#3d75ad',
      secondary: '#4da89f',
      accent: '#9C27B0',
      dark: '#1d1d1d',
      positive: '#3b9c52',
      negative: '#b53645',
      info: '#61c1d4',
      warning: '#dbb54d',
    },
  },
};

// localization
import { findAppLocale } from '@i18n';
import { setupI18n } from '@renderer/locales';
import dayjs from 'dayjs';

const lang = findAppLocale(navigator.language);

// init
const App = createApp(Root);
App.provide('dayJS', dayjs);
App.use(setupI18n({ locale: lang }));
App.use(Quasar, QuasarConfig);
App.use(pinia);
App.use(router);
App.mount('#app');
