import type { mirrorsLangsType } from '@i18n/index';

export type ImportResults = {
  mirror: {name: string, icon:string, langs: mirrorsLangsType[];}
  name: string,
  langs: mirrorsLangsType[],
  url: string,
  covers: string[],
  inLibrary: boolean,
}
