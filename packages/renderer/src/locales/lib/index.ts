import { nextTick } from 'vue';
import type { I18n , I18nOptions } from 'vue-i18n';
import { createI18n } from 'vue-i18n';
import { Quasar } from 'quasar';
import dayjs from 'dayjs';
import dayjsrelative from 'dayjs/plugin/relativeTime';
import dayjslocalizedformat from 'dayjs/plugin/localizedFormat';

export const availableLanguages = ['en-US', 'fr'] as const;

export function findLocales(lang:string) {
  const locale = availableLanguages.find(locale => {
    if (locale === lang) {
      return true;
    }
    const regex = new RegExp(`${locale}-.*`);
    return regex.test(lang);
  });
  return locale ? locale : 'en-US';
}

export function setupI18n(options:I18nOptions = {}) {
  if(!options.globalInjection) options.globalInjection = true;
  if(!options.locale) options.locale = findLocales(navigator.language);
  const i18n = createI18n(options);
  setI18nLanguage(i18n, options.locale);
  return i18n;
}

export function setI18nLanguage(i18n:I18n<unknown, unknown, unknown, true>, locale:string) {
  /** vue-i18n */
  i18n.global.locale = locale;
  loadLocaleMessages(i18n, locale);

  /** Quasar */
  const langList = import.meta.glob('../../../../../node_modules/quasar/lang/*.mjs');
  langList[ `../../../../../node_modules/quasar/lang/${ locale }.mjs` ]().then(lang => {
    Quasar.lang.set(lang.default);
  });

  /** dayjs */
  const list = import.meta.glob('../../../../../node_modules/dayjs/esm/locale/*.js');

  list[ `../../../../../node_modules/dayjs/esm/locale/${ locale }.js` ]().then((c) => {
    dayjs.locale(c.default);
  });

  dayjs.extend(dayjsrelative);
  dayjs.extend(dayjslocalizedformat);
}

export async function loadLocaleMessages(i18n:I18n<unknown, unknown, unknown, true>, locale:string) {
  // load locale messages with dynamic import
  const messages = await import(`../${locale}.json`);

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages.default);

  return nextTick();
}
