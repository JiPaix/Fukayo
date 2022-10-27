import type { appLangsType, mirrorsLangsType } from '@i18n/availableLangs';
import { appLangs, mirrorsLang } from '@i18n/availableLangs';
import { findAppLocale } from '@i18n/findLocale';
import { BC47_TO_ISO639_1, ISO3166_1_ALPHA2_TO_ISO639_1 } from '@i18n/isoConvert';
import { importLocale, loadLocale } from '@i18n/loadLocale';

export { appLangs, appLangsType, mirrorsLang, mirrorsLangsType, findAppLocale, importLocale, loadLocale, ISO3166_1_ALPHA2_TO_ISO639_1, BC47_TO_ISO639_1 };
