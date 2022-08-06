import { supportedLangs } from './supportedLangs';

export function findLocale(lang:string) {
  const locale = supportedLangs.find(locale => {
    if (locale === lang) {
      return true;
    }
    const regex = new RegExp(`${locale}-.*`);
    return regex.test(lang);
  });
  return locale ? locale : 'en';
}
