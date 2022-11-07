import type en from '@i18n/../locales/en.json';
import type { appLangsType } from '@i18n/index';
import { findAppLocale, importLocale, loadLocale } from '@i18n/index';
import dayjs from 'dayjs';
import dayjslocalizedformat from 'dayjs/plugin/localizedFormat';
import dayjsrelative from 'dayjs/plugin/relativeTime';
import { Quasar } from 'quasar';
import type { I18n, I18nOptions } from 'vue-i18n';
import { createI18n } from 'vue-i18n';

type MessageSchema = typeof en

export function setupI18n(options:I18nOptions<{ message: MessageSchema }, appLangsType>) {
  if(!options.globalInjection) options.globalInjection = true;
  const lang = findAppLocale('en');
  const i18n = createI18n<[MessageSchema], appLangsType>({
    locale: lang,
  });

  setI18nLanguage(i18n, lang);
  return i18n;
}

export function setI18nLanguage(i18n:I18n<unknown, unknown, unknown, string, true>, locale:appLangsType) {

  loadLocale(locale).then(messages => {
    /** vue-i18n */
    i18n.global.locale = locale;
    i18n.global.setLocaleMessage(locale, messages);

    importLocale(locale).then(imp => {
      Quasar.lang.set(imp.quasar);
      dayjs.locale(imp.dayjs);
      dayjs.extend(dayjsrelative);
      dayjs.extend(dayjslocalizedformat);
    });
  });
}
