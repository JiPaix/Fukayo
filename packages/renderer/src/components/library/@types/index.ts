import type { MangaInDB } from '@api/models/types/manga';
import type { mirrorsLangsType } from '@i18n/availableLangs';

export type MangaInDBwithLabel = {
  id: string,
  mirror: string,
  langs:mirrorsLangsType[],
  name: string,
  displayName?: string,
  tags: string[],
  authors: string[],
  url: string,
  synopsis?:string,
  userCategories: string[],
  unread: number,
  /** is the mirror dead? */
  dead:boolean,
  /** is the entry broken? */
  broken: boolean,
  meta: MangaInDB['meta'],
  chapters: (MangaInDB['chapters'][0] & {
    label: string | number;
    value: number;
  })[]
};

export type MangaGroup = {
  name: string;
  mangas: MangaInDBwithLabel[];
  covers: string[];
  unread:number;
};
