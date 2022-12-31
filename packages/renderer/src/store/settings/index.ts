import { mirrorsLang } from '@i18n';
import type { Settings } from '@renderer/store/settings/types';
import { defineStore } from 'pinia';

const mostCommonLanguages = ['en', 'fr', 'de', 'pt', 'pt-br', 'es', 'es-la', 'ru', 'tr', 'ja', 'id', 'zh', 'zh-hk'];

const defaultSettings:Settings = {
  theme: 'dark',
  server: {
    login: 'admin',
    password: null,
    port : 4444,
    ssl: 'false',
    hostname: 'https://localhost',
    cert: null,
    key: null,
    accessToken: null,
    refreshToken: null,
  },
  mangaPage: {
    chapters: {
      sort: 'ASC',
      hideRead: false,
      KomgaTryYourBest: [],
      scanlators : {
        ignore: [],
      },
    },
  },
  reader : {
    webtoon: false,
    showPageNumber: true,
    zoomMode: 'auto',
    longStrip: true,
    longStripDirection: 'vertical',
    book: false,
    bookOffset: false,
    preloadNext: true,
    overlay: true,
    rtl: false,
  },
  readerGlobal: {
    preloadNext: true,
  },
  library: {
    showUnread: true,
    sort: 'AZ',
    firstTimer: 1,
  },
  i18n: {
    ignored: mirrorsLang.filter(l => !mostCommonLanguages.includes(l)),
  },
};

export const useStore = defineStore('settings', {
  state: () => defaultSettings,
});
