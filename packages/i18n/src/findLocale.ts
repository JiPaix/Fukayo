import { appLangs } from '@i18n';

export function findAppLocale(lang:string) {
  const locale = appLangs.find(locale => {
    if (locale === lang) {
      return true;
    }
    const regex = new RegExp(`${locale}-.*`);
    return regex.test(lang);
  });
  return locale ? locale : 'en';
}
