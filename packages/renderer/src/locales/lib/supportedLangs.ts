/**
 * Available language for the APP (ISO3166-1 alpha 2)
 *
 * - English: `en`
 * - French: `fr`
 */
export const supportedLangs = ['en', 'fr'] as const;
export type supportedLangsType = typeof supportedLangs[number];

/**
 * available languages (ISO 639-1):
 *
 * - Abkhazian: `ab`
 * - Afar: `aa`
 * - Afrikaans: `af`
 * - Akan: `ak`
 * - Albanian: `sq`
 * - Amharic: `am`
 * - Arabic: `ar`
 * - Aragonese: `an`
 * - Armenian: `hy`
 * - Assamese: `as`
 * - Avaric: `av`
 * - Avestan: `ae`
 * - Aymara: `ay`
 * - Azerbaijani: `az`
 * - Bambara: `bm`
 * - Bashkir: `ba`
 * - Basque: `eu`
 * - Belarusian: `be`
 * - Bengali: `bn`
 * - Bislama: `bi`
 * - Bosnian: `bs`
 * - Breton: `br`
 * - Bulgarian: `bg`
 * - Burmese: `my`
 * - Catalan, Valencian: `ca`
 * - Chamorro: `ch`
 * - Chechen: `ce`
 * - Chichewa, Chewa, Nyanja: `ny`
 * - Chinese (simplified): `zh`
 * - Chinese (traditional): `zh-hk`
 * - Chinese (romanized): `zh-ro`
 * - Church Slavic, Old Slavonic, Church Slavonic, Old Bulgarian, Old Church Slavonic: `cu`
 * - Chuvash: `cv`
 * - Cornish: `kw`
 * - Corsican: `co`
 * - Cree: `cr`
 * - Croatian: `hr`
 * - Czech: `cs`
 * - Danish: `da`
 * - Divehi, Dhivehi, Maldivian: `dv`
 * - Dutch, Flemish: `nl`
 * - Dzongkha: `dz`
 * - English: `en`
 * - Esperanto: `eo`
 * - Estonian: `et`
 * - Ewe: `ee`
 * - Faroese: `fo`
 * - Fijian: `fj`
 * - Finnish: `fi`
 * - French: `fr`
 * - Western Frisian: `fy`
 * - Fulah: `ff`
 * - Gaelic, Scottish Gaelic: `gd`
 * - Galician: `gl`
 * - Ganda: `lg`
 * - Georgian: `ka`
 * - German: `de`
 * - Greek, Modern (1453–): `el`
 * - Kalaallisut, Greenlandic: `kl`
 * - Guarani: `gn`
 * - Gujarati: `gu`
 * - Haitian, Haitian Creole: `ht`
 * - Hausa: `ha`
 * - Hebrew: `he`
 * - Herero: `hz`
 * - Hindi: `hi`
 * - Hiri Motu: `ho`
 * - Hungarian: `hu`
 * - Icelandic: `is`
 * - Ido: `io`
 * - Igbo: `ig`
 * - Indonesian: `id`
 * - Interlingua (International Auxiliary Language Association): `ia`
 * - Interlingue, Occidental: `ie`
 * - Inuktitut: `iu`
 * - Inupiaq: `ik`
 * - Irish: `ga`
 * - Italian: `it`
 * - Japanese: `ja`
 * - Japnese (romanized): `ja-ro`
 * - Javanese: `jv`
 * - Kannada: `kn`
 * - Kanuri: `kr`
 * - Kashmiri: `ks`
 * - Kazakh: `kk`
 * - Central Khmer: `km`
 * - Kikuyu, Gikuyu: `ki`
 * - Kinyarwanda: `rw`
 * - Kirghiz, Kyrgyz: `ky`
 * - Komi: `kv`
 * - Kongo: `kg`
 * - Korean: `ko`
 * - Korean (romanized): `ko-ro`
 * - Kuanyama, Kwanyama: `kj`
 * - Kurdish: `ku`
 * - Lao: `lo`
 * - Latin: `la`
 * - Latvian: `lv`
 * - Limburgan, Limburger, Limburgish: `li`
 * - Lingala: `ln`
 * - Lithuanian: `lt`
 * - Luba-Katanga: `lu`
 * - Luxembourgish, Letzeburgesch: `lb`
 * - Macedonian: `mk`
 * - Malagasy: `mg`
 * - Malay: `ms`
 * - Malayalam: `ml`
 * - Maltese: `mt`
 * - Manx: `gv`
 * - Maori: `mi`
 * - Marathi: `mr`
 * - Marshallese: `mh`
 * - Mongolian: `mn`
 * - Nauru: `na`
 * - Navajo, Navaho: `nv`
 * - North Ndebele: `nd`
 * - South Ndebele: `nr`
 * - Ndonga: `ng`
 * - Nepali: `ne`
 * - Norwegian: `no`
 * - Norwegian Bokmål: `nb`
 * - Norwegian Nynorsk: `nn`
 * - Sichuan Yi, Nuosu: `ii`
 * - Occitan: `oc`
 * - Ojibwa: `oj`
 * - Oriya: `or`
 * - Oromo: `om`
 * - Ossetian, Ossetic: `os`
 * - Pali: `pi`
 * - Pashto, Pushto: `ps`
 * - Persian: `fa`
 * - Polish: `pl`
 * - Portuguese: `pt`
 * - Portuguese (Brazil): `pt-br`
 * - Punjabi, Panjabi: `pa`
 * - Quechua: `qu`
 * - Romanian, Moldavian, Moldovan: `ro`
 * - Romansh: `rm`
 * - Rundi: `rn`
 * - Russian: `ru`
 * - Northern Sami: `se`
 * - Samoan: `sm`
 * - Sango: `sg`
 * - Sanskrit: `sa`
 * - Sardinian: `sc`
 * - Serbian: `sr`
 * - Shona: `sn`
 * - Sindhi: `sd`
 * - Sinhala, Sinhalese: `si`
 * - Slovak: `sk`
 * - Slovenian: `sl`
 * - Somali: `so`
 * - Southern Sotho: `st`
 * - Spanish, Castilian: `es`
 * - Spanish (Latin America): `es-la`
 * - Sundanese: `su`
 * - Swahili: `sw`
 * - Swati: `ss`
 * - Swedish: `sv`
 * - Tagalog: `tl`
 * - Tahitian: `ty`
 * - Tajik: `tg`
 * - Tamil: `ta`
 * - Tatar: `tt`
 * - Telugu: `te`
 * - Thai: `th`
 * - Tibetan: `bo`
 * - Tigrinya: `ti`
 * - Tonga (Tonga Islands): `to`
 * - Tsonga: `ts`
 * - Tswana: `tn`
 * - Turkish: `tr`
 * - Turkmen: `tk`
 * - Twi: `tw`
 * - Uighur, Uyghur: `ug`
 * - Ukrainian: `uk`
 * - Urdu: `ur`
 * - Uzbek: `uz`
 * - Venda: `ve`
 * - Vietnamese: `vi`
 * - Volapük: `vo`
 * - Walloon: `wa`
 * - Welsh: `cy`
 * - Wolof: `wo`
 * - Xhosa: `xh`
 * - Yiddish: `yi`
 * - Yoruba: `yo`
 * - Zhuang, Chuang: `za`
 * - Zulu: `zu`
 */
export const mirrorsLang = [
    'xx',
    'ab',
    'aa',
    'af',
    'ak',
    'sq',
    'am',
    'ar',
    'an',
    'hy',
    'as',
    'av',
    'ae',
    'ay',
    'az',
    'bm',
    'ba',
    'eu',
    'be',
    'bn',
    'bi',
    'bs',
    'br',
    'bg',
    'my',
    'ca',
    'ch',
    'ce',
    'ny',
    'zh',
    'zh-hk',
    'zh-ro',
    'cu',
    'cv',
    'kw',
    'co',
    'cr',
    'hr',
    'cs',
    'da',
    'dv',
    'nl',
    'dz',
    'en',
    'eo',
    'et',
    'ee',
    'fo',
    'fj',
    'fi',
    'fr',
    'fy',
    'ff',
    'gd',
    'gl',
    'lg',
    'ka',
    'de',
    'el',
    'kl',
    'gn',
    'gu',
    'ht',
    'ha',
    'he',
    'hz',
    'hi',
    'ho',
    'hu',
    'is',
    'io',
    'ig',
    'id',
    'ia',
    'ie',
    'iu',
    'ik',
    'ga',
    'it',
    'ja',
    'ja-ro',
    'jv',
    'kn',
    'kr',
    'ks',
    'kk',
    'km',
    'ki',
    'rw',
    'ky',
    'kv',
    'kg',
    'ko',
    'ko-ro',
    'kj',
    'ku',
    'lo',
    'la',
    'lv',
    'li',
    'ln',
    'lt',
    'lu',
    'lb',
    'mk',
    'mg',
    'ms',
    'ml',
    'mt',
    'gv',
    'mi',
    'mr',
    'mh',
    'mn',
    'na',
    'nv',
    'nd',
    'nr',
    'ng',
    'ne',
    'no',
    'nb',
    'nn',
    'ii',
    'oc',
    'oj',
    'or',
    'om',
    'os',
    'pi',
    'ps',
    'fa',
    'pl',
    'pt',
    'pt-br',
    'pa',
    'qu',
    'ro',
    'rm',
    'rn',
    'ru',
    'se',
    'sm',
    'sg',
    'sa',
    'sc',
    'sr',
    'sn',
    'sd',
    'si',
    'sk',
    'sl',
    'so',
    'st',
    'es',
    'es-la',
    'su',
    'sw',
    'ss',
    'sv',
    'tl',
    'ty',
    'tg',
    'ta',
    'tt',
    'te',
    'th',
    'bo',
    'ti',
    'to',
    'ts',
    'tn',
    'tr',
    'tk',
    'tw',
    'ug',
    'uk',
    'ur',
    'uz',
    've',
    'vi',
    'vo',
    'wa',
    'cy',
    'wo',
    'xh',
    'yi',
    'yo',
    'za',
    'zu',
] as const;

export type mirrorsLangsType = Mutable<typeof mirrorsLang[number]>

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key];
}
