import type { mirrorsLangsType } from '@i18n';

export type ImportResults = {
  mirror: {name: string, langs: mirrorsLangsType[];}
  name: string,
  langs: mirrorsLangsType[],
  url: string,
  covers: string[],
  inLibrary: boolean,
}
