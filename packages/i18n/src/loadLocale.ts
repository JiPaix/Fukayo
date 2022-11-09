
/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { appLangsType } from '@i18n';
import type { ConfigType } from 'dayjs'; //=> this is just because we need ILocale interface which isn't exported
import type { QuasarLanguage } from 'quasar';

/* eslint-disable @typescript-eslint/no-unused-vars */
type useless = ConfigType

export async function loadLocale(locale: appLangsType) {
  const json = await import(`../locales/${locale}.json`) as { default : typeof import('../locales/en.json') };
  return json.default;
}


export async function importLocale(locale: appLangsType) {
  const quasarLangs = import.meta.glob('../../../node_modules/quasar/lang/*.mjs');
  const dayJSLangs = import.meta.glob('../../../node_modules/dayjs/esm/locale/*.js');

  const quasarSpecific = locale === 'en' ? 'en-US' : locale;

  const quasar = await quasarLangs[ `../../../node_modules/quasar/lang/${quasarSpecific}.mjs` ]() as unknown as { default: QuasarLanguage };
  const dayjs = await dayJSLangs[ `../../../node_modules/dayjs/esm/locale/${ locale }.js` ]() as { default: ILocale };
  return {
    dayjs: dayjs.default,
    quasar: quasar.default,
  };
}
