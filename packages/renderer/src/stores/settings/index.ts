import type { Settings } from '@renderer/stores/settings/types';
import { defineStore } from 'pinia';

const defaultSettings:Settings = {
  theme: 'dark',
  server: {
    login: 'admin',
    password: null,
    port : 4444,
    ssl: 'false',
    hostname: 'https://127.0.0.1',
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
    overlay: true,
    rtl: false,
  },
  readerGlobal: {
    preloadNext: true,
    pinRightDrawer: true,
  },
  library: {
    showUnread: true,
    sort: 'AZ',
    firstTimer: 1,
  },
};

export const useStore = defineStore('settings', {
  state: () => defaultSettings,
});
