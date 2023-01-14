import type { MangaPage } from '@api/models/types/manga';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import type { useI18n } from 'vue-i18n';

export function chapterLabel(number:number, name?:string) {
  if(name) return `${number} - ${name}`;
  return number;
}

export function isMouseEvent(event:KeyboardEvent|MouseEvent):event is MouseEvent {
  return typeof (event as KeyboardEvent).key === 'undefined';
}


export function formatChapterInfoToString(isKomgaTryingItsBest:boolean, $t: Translate['t'], chap?:MangaPage['chapters'][number]|null) {
  if(!chap) return '';
  let str = '';
  if(chap.volume) str += `${$t('mangas.volume')} ${chap.volume}`;
  if((!isKomgaTryingItsBest && chap.volume !== undefined ) || (isKomgaTryingItsBest && chap.number > -1 && typeof chap.volume !== 'undefined')) {
    str += ' - ';
  }
  if(!isKomgaTryingItsBest || (isKomgaTryingItsBest && chap.number > -1 && chap.volume === undefined)) {
    str += `${$t('mangas.chapter')} ${chap.number}`;
  }
  return str;
}

type Translate = ReturnType<typeof useI18n<{message: typeof en}, appLangsType>>;
