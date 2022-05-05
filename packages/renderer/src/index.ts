import {createApp} from 'vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import App from './App.vue';

const myApp = createApp(App);

// pinia stores
import { createPinia } from 'pinia';
import { piniaLocalStorage } from './store/localStorage';
const pinia = createPinia();
pinia.use(piniaLocalStorage);

myApp.use(pinia);

// router
const Search = () => import('./components/searchMangas.vue');
const Library = () => import('./components/MangaLibrary.vue');
const Manga = () => import('./components/showManga.vue');
const router = createRouter({
  history: typeof window.apiServer === 'undefined' ? createWebHashHistory() : createWebHistory(),
  routes: [
      {
        name: 'home',
        path: '/',
        component: Library,
      },
      {
        name: 'search',
        path: '/search',
        component: Search,
        props: route => ({ query: route.query.q }),
      },
      {
        name: 'manga',
        path: '/manga/:mirror/:lang/:url',
        component: Manga,
      },
    ],
});

myApp.use(router);

// localization
import { findLocales } from './locales/lib';
import { setupI18n } from './locales/lib';
import dayjs from 'dayjs';
import dayjsrelative from 'dayjs/plugin/relativeTime';
import dayjslocalizedformat from 'dayjs/plugin/localizedFormat';
import type { availableLanguages } from './locales/lib/index';

const lang = findLocales(navigator.language) as typeof availableLanguages[0];

/**
 * DayJS doesn't support locales lazy loading.
 * for consistency sake, imported locales must be part of the i18n global localization.
 * @see availableLanguages
 */
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

dayjs.extend(dayjsrelative);
dayjs.extend(dayjslocalizedformat);
dayjs.locale(lang);

myApp.provide('dayJS', dayjs);
myApp.use(setupI18n({ locale: lang }));

// quasar
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



// flags
import('flag-icons/css/flag-icons.css');


// init
myApp.mount('#app');
