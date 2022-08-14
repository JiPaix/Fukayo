import {createApp} from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

const myApp = createApp(App);

// LocalStorage
import { createPinia } from 'pinia';
import { piniaLocalStorage } from './store/localStorage';
const pinia = createPinia();
pinia.use(piniaLocalStorage);

myApp.use(pinia);

// Router
const router = createRouter({
  history: createWebHistory(),
  routes: [
      {
        name: 'home',
        path: '/',
        component: () => import('./components/library/App.vue'),
      },
      {
        name: 'search',
        path: '/search',
        component: () => import('./components/search/App.vue'),
        props: route => ({ query: route.query.q }),
      },
      {
        name: 'manga',
        path: '/manga/:mirror/:lang/:id',
        component: () => import('./components/manga/App.vue'),
        props: { url: true },
      },
      {
        name: 'explore',
        path: '/explore',
        component: () => import('./components/explore/App.vue'),
      },
      {
        name: 'explore_mirror',
        path: '/explore/:mirror',
        component: () => import('./components/explore/SourceExplore.vue'),
      },
      {
        name: 'settings',
        path: '/settings',
        component: () => import('./components/settings/App.vue'),
      },
      {
        name: 'logs',
        path: '/logs',
        component: () => import('./components/logs/App.vue'),
      },
    ],
});

myApp.use(router);

// Quasar
import { Quasar, Dialog, Notify, Loading } from 'quasar';
import('@quasar/extras/roboto-font/roboto-font.css');
import('@quasar/extras/material-icons/material-icons.css');
import('@quasar/extras/material-icons-outlined/material-icons-outlined.css');
import('@quasar/extras/material-icons-round/material-icons-round.css');
import('quasar/dist/quasar.css');

myApp.use(Quasar, {
  plugins: {Dialog, Notify, Loading},
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
});

// localization
import { findLocale } from './locales/lib/findLocale';
import { setupI18n } from './locales/lib';
import dayjs from 'dayjs';

const lang = findLocale(navigator.language);
myApp.use(setupI18n({ locale: lang }));
myApp.provide('dayJS', dayjs);

// init
myApp.mount('#app');
