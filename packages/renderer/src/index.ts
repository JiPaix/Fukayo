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
import Library from './components/library/App.vue';
import Search from './components/search/App.vue';
import Manga from './components/manga/App.vue';
import Explore from './components/explore/App.vue';
import ExploreMirror from './components/explore/SourceExplore.vue';
import Settings from './components/settings/App.vue';
import Logs from './components/logs/App.vue';

const router = createRouter({
  history: createWebHistory(),
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
        path: '/manga/:mirror/:lang/:url/:chapterindex?',
        component: Manga,
      },
      {
        name: 'explore',
        path: '/explore',
        component: Explore,
      },
      {
        name: 'explore_mirror',
        path: '/explore/:mirror',
        component: ExploreMirror,
      },
      {
        name: 'settings',
        path: '/settings',
        component: Settings,
      },
      {
        name: 'logs',
        path: '/logs',
        component: Logs,
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
import { findLocales } from './locales/lib';
import { setupI18n } from './locales/lib';
import dayjs from 'dayjs';

const lang = findLocales(navigator.language);
myApp.use(setupI18n({ locale: lang }));
myApp.provide('dayJS', dayjs);

// init
myApp.mount('#app');
