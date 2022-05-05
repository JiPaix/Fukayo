import { nextTick } from 'vue';
import type { I18n , I18nOptions } from 'vue-i18n';
import { createI18n } from 'vue-i18n';

export const availableLanguages = ['en', 'fr'];

export function findLocales(lang:string) {
  const locale = availableLanguages.find(locale => {
    if (locale === lang) {
      return true;
    }
    const regex = new RegExp(`${locale}-.*`);
    return regex.test(lang);
  });
  return locale ? locale : 'en';
}

export function setupI18n(options:I18nOptions = {}) {
  if(!options.globalInjection) options.globalInjection = true;
  if(!options.locale) options.locale = findLocales(navigator.language);
  const i18n = createI18n(options);
  setI18nLanguage(i18n, options.locale);
  return i18n;
}

export function setI18nLanguage(i18n:I18n<unknown, unknown, unknown, true>, locale:string) {
  i18n.global.locale = locale;
  loadLocaleMessages(i18n, locale);
  /**
   * NOTE:
   * If you need to specify the language setting for headers, such as the `fetch` API, set it here.
   * The following is an example for axios.
   *
   * axios.defaults.headers.common['Accept-Language'] = locale
   */
  document.querySelector('html')?.setAttribute('lang', locale);
}

export async function loadLocaleMessages(i18n:I18n<unknown, unknown, unknown, true>, locale:string) {
  // load locale messages with dynamic import
  const messages = await import(`../${locale}.json`);

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages.default);

  return nextTick();
}

