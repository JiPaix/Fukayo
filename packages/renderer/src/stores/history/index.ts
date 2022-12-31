import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { defineStore } from 'pinia';

export const useHistoryStore = defineStore('history', {
  state: () => {
    return {
      manga: null as null | MangaInDB | MangaPage,
    };
  },
});
