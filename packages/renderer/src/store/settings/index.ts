
import { defineStore } from 'pinia';


export const useStore = defineStore('settings', {
  state: () => {
    return {
      theme: 'dark',
      server : {
        port: 4444,
      },
    };
  },
});
