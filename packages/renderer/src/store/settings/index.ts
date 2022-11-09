import type { mirrorsLangsType } from '@i18n';
import { defineStore } from 'pinia';

export const useStore = defineStore('settings', {
  state: () => {
    return {
      theme: 'dark' as 'dark' | 'light',
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
      mangaPage: {
        chapters: {
          sort: 'ASC' as 'ASC' | 'DESC',
          hideRead: false,
          /** list of manga ids that enable "special" sorting */
          KomgaTryYourBest: [] as string[],
          scanlators : {
            ignore: [] as { /** manga id */ id: string, /** scanlator's name (undefined = nogroup) */ name: string }[],
          },
        },
      },
      reader : {
        webtoon: false,
        showPageNumber: true,
        zoomMode: 'auto' as 'auto' | 'fit-width' | 'fit-height' | 'custom',
        zoomValue: 100,
        longStrip: true,
        preloadNext: true,
        overlay: true,
      },
      library: {
        showUnread: true,
        sort: 'AZ' as 'AZ' | 'ZA' | 'unread' | 'read',
        firstTimer: 1 as 1|2|3,
      },
      i18n: {
        ignored: [] as mirrorsLangsType[],
      },
    };
  },
});
