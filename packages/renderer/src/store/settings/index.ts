
import { defineStore } from 'pinia';

export const useStore = defineStore('settings', {
  state: () => {
    return {
      theme: 'dark',
      server : {
        login: 'admin',
        password: null as string | null,
        port: 4444,
        ssl: 'false' as 'false' | 'provided' | 'app',
        hostname: 'https://localhost',
        cert: null as string | null,
        key: null as string | null,
        accessToken: null as string | null,
        refreshToken: null as string | null,
      },
      reader : {
        webtoon: false,
        showPageNumber: true,
        zoomMode: 'auto' as 'auto' | 'fit-width' | 'fit-height' | 'custom',
        zoomValue: 100,
        longStrip: true,
        preloadNext: true,
      },
      library: {
        showUnread: true,
        sort: 'AZ' as 'AZ' | 'ZA' | 'unread' | 'read',
      },
    };
  },
});
