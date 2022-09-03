import type { mirrorsLangsType } from '@i18n/availableLangs';

export type MangaInDBwithLabel = {
  id: string,
  mirror: string,
  langs:mirrorsLangsType[],
  name: string,
  displayName?: string,
  url: string,
  unread: number,
  chapters: {
    label: string | number;
    value: number;
    read:boolean
    lang: mirrorsLangsType
  }[]
};

export type MangaGroup = {
  name: string;
  mangas: MangaInDBwithLabel[];
  covers: string[];
  unread:number;
};
