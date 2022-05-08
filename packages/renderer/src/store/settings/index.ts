
import { defineStore } from 'pinia';

export const useStore = defineStore('settings', {
  state: () => {
    return {
      theme: 'dark',
      server : {
        login: 'admin',
        port: 4444,
        ssl: 'false' as 'false' | 'provided' | 'app',
        hostname: 'https://localhost',
        cert: null as string | null,
        key: null as string | null,
        accessToken: null as string | null,
        refreshToken: null as string | null,
      },
    };
  },
});
