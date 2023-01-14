import type { mirrorsLangsType } from '@i18n/availableLangs';
import type { RouteParamsRaw } from 'vue-router';

export type mangaRoute = {
  id: string,
  lang: mirrorsLangsType
  mirror: string,
}

export type readerRoute = {
  mirror: string,
  lang: mirrorsLangsType,
  id: string,
  chapterId: string,
}

export type settingsRoute = {
  tab: 'general' | 'sources' | 'languages' | 'files'
}

export function routeTypeHelper(routeName: 'settings', params: settingsRoute): {name: 'reader', params: settingsRoute }
export function routeTypeHelper(routeName: 'reader', params: readerRoute): {name: 'reader', params: readerRoute }
export function routeTypeHelper(routeName: 'manga', params: mangaRoute): {name: 'manga', params: mangaRoute }
export function routeTypeHelper(routeName: string, params: RouteParamsRaw) {
  return { name: routeName, params };
}
