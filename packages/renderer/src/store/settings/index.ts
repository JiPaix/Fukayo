
import { defineStore } from 'pinia';



export const useStore = defineStore('settings', {
  state: () => {
    return {
      global: {
        theme: 'light',
      },
      counter: 0,
    };
  },
  actions: {
    increment() {
      this.counter++;
    },
  },
});
