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

  let quasar: { default: QuasarLanguage } | undefined;
  let dayjs: { default: ILocale } | undefined;

  try {
    quasar = await quasarLangs[ `../../../node_modules/quasar/lang/${locale}.mjs` ]() as unknown as { default: QuasarLanguage };
  } catch(err) {
    quasar = await quasarLangs[ '../../../node_modules/quasar/lang/en-US.mjs' ]() as unknown as { default: QuasarLanguage };
  }

  try {
    dayjs = await dayJSLangs[ `../../../node_modules/dayjs/esm/locale/${ locale }.js` ]() as { default: ILocale };
  } catch(err) {
    dayjs = await dayJSLangs[ '../../../node_modules/dayjs/esm/locale/en.js' ]() as { default: ILocale };
  }

  if(!dayjs || !quasar) throw Error('couldn\'t load locales');

  return {
    dayjs: dayjs.default,
    quasar: quasar.default,
  };

}
