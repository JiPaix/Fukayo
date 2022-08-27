import type { mirrorsLangsType } from '@renderer/locales/lib/supportedLangs';

export function ISO3166_1_ALPHA2_TO_ISO639_1(input: string): mirrorsLangsType {
  input = input.toLocaleUpperCase();
  if(input == 'ET') return 'aa'; //=> Ethiopia -> Afar

  if(input == 'ZA') return 'af'; //=> South Africa -> Afrikaans

  if(input == 'AE') return 'ar'; //=> United Arab Emirates -> Arabic
  if(input == 'BH') return 'ar'; //=> Bahrain -> Arabic
  if(input == 'DJ') return 'ar'; //=> Djibouti -> Arabic
  if(input == 'DZ') return 'ar'; //=> Algeria -> Arabic
  if(input == 'EG') return 'ar'; //=> Egypt -> Arabic
  if(input == 'EH') return 'ar'; //=> Western Sahara -> Arabic
  if(input == 'JO') return 'ar'; //=> Jordan -> Arabic
  if(input == 'KW') return 'ar'; //=> Kuwait -> Arabic
  if(input == 'LB') return 'ar'; //=> Lebanon -> Arabic
  if(input == 'LY') return 'ar'; //=> Libya -> Arabic
  if(input == 'MA') return 'ar'; //=> Morocco -> Arabic
  if(input == 'MR') return 'ar'; //=> Mauritania -> Arabic
  if(input == 'NE') return 'ar'; //=> Niger -> Arabic
  if(input == 'OM') return 'ar'; //=> Oman -> Arabic
  if(input == 'PS') return 'ar'; //=> Palestine, State of -> Arabic
  if(input == 'QA') return 'ar'; //=> Qatar -> Arabic
  if(input == 'SA') return 'ar'; //=> Saudi Arabia -> Arabic
  if(input == 'SD') return 'ar'; //=> Sudan -> Arabic
  if(input == 'SY') return 'ar'; //=> Syrian Arab Republic -> Arabic
  if(input == 'TD') return 'ar'; //=> Chad -> Arabic
  if(input == 'TN') return 'ar'; //=> Tunisia -> Arabic
  if(input == 'YE') return 'ar'; //=> Yemen -> Arabic

  if(input == 'AZ') return 'az'; //=> Azerbaijan -> Azerbaijani

  if(input == 'BY') return 'be'; //=> Belarus -> Belarusian

  if(input == 'BG') return 'bg'; //=> Bulgaria -> Bulgarian

  if(input == 'VU') return 'bi'; //=> Vanuatu -> Bislama

  if(input == 'BD') return 'bn'; //=> Bangladesh -> Bengladish

  if(input == 'BA') return 'bs'; //=> Bosnia and Herzegovina -> Bosnian

  if(input == 'GU') return 'ch'; //=> Guam -> Chamorro

  if(input == 'DK') return 'da'; //=> Denmark -> Danish

  if(input == 'AT') return 'de'; //=> Austria -> German
  if(input == 'CH') return 'de'; //=> Switzerland -> German
  if(input == 'DE') return 'de'; //=> Germany -> German
  if(input == 'LI') return 'de'; //=> Liechtenstein -> German

  if(input == 'MV') return 'dv'; //=> Maldives -> Divehi, Dhivehi, Maldivian

  if(input == 'BT') return 'dz'; //=> Bhutan -> Dzongkha

  if(input == 'AD') return 'ca'; //=> Andorra -> Catalan, Valencian

  if(input == 'CZ') return 'cs'; //=> Czechia -> Czech

  if(input == 'TG') return 'ee'; //=> Togo -> Ewe

  if(input == 'CY') return 'el'; //=> Cyprus -> Greek

  if(input == 'GR') return 'el'; //=> Greece -> Greek

  if(input == 'EE') return 'et'; //=> Estonia -> Estonian

  if(input == 'AG') return 'en'; //=> Antigua and Barbuda -> English
  if(input == 'AI') return 'en'; //=> Anguilla -> English
  if(input == 'AQ') return 'en'; //=> Antarctica -> English
  if(input == 'AS') return 'en'; //=> American Samoa -> English
  if(input == 'AU') return 'en'; //=> Australia -> English
  if(input == 'CA') return 'en'; //=> Canada -> English
  if(input == 'CK') return 'en'; //=> Cook Islands -> English
  if(input == 'CX') return 'en'; //=> Christmas Island -> English
  if(input == 'BB') return 'en'; //=> Barbados -> English
  if(input == 'BM') return 'en'; //=> Bermuda -> English
  if(input == 'BS') return 'en'; //=> Bahamas -> English
  if(input == 'BW') return 'en'; //=> Botswana -> English
  if(input == 'BZ') return 'en'; //=> Belize -> English
  if(input == 'DM') return 'en'; //=> Dominica -> English
  if(input == 'FM') return 'en'; //=> Micronesia (Federated States of) -> English
  if(input == 'FK') return 'en'; //=> Falkland Islands (Malvinas) -> English
  if(input == 'GB') return 'en'; //=> United Kingdom of Great Britain and Northern Ireland -> English
  if(input == 'GD') return 'en'; //=> Grenada -> English
  if(input == 'GG') return 'en'; //=> Guernsey -> English
  if(input == 'GH') return 'en'; //=> Ghana -> English
  if(input == 'GI') return 'en'; //=> Gibraltar -> English
  if(input == 'GM') return 'en'; //=> Gambia -> English
  if(input == 'GS') return 'en'; //=> South Georgia and the South Sandwich Islands -> English
  if(input == 'GY') return 'en';  //=> Guyana -> English
  if(input == 'HM') return 'en'; //=> Heard Island and McDonald Islands -> English
  if(input == 'IE') return 'en'; //=> Ireland -> English
  if(input == 'IO') return 'en'; //=> British Indian Ocean Territory -> English
  if(input == 'JE') return 'en'; //=> Jersey -> English
  if(input == 'JM') return 'en'; //=> Jamaica -> English
  if(input == 'KI') return 'en'; //=> Kiribati -> English
  if(input == 'KN') return 'en'; //=> Saint Kitts and Nevis -> English
  if(input == 'KY') return 'en'; //=> Cayman Islands -> English
  if(input == 'LC') return 'en'; //=> Saint Lucia -> English
  if(input == 'LR') return 'en'; //=> Liberia -> English
  if(input == 'LS') return 'en'; //=> Lesotho -> English
  if(input == 'MP') return 'en'; //=> Northern Mariana Islands -> English
  if(input == 'MS') return 'en'; //=> Montserrat -> English
  if(input == 'MU') return 'en'; //=> Mauritius -> English
  if(input == 'NA') return 'en'; //=> Namibia -> English
  if(input == 'NF') return 'en'; //=> Norfolk Island -> English
  if(input == 'NR') return 'en'; //=> Nauru -> English
  if(input == 'NU') return 'en'; //=> Niue -> English
  if(input == 'PG') return 'en'; //=> Papua New Guinea -> English
  if(input == 'PN') return 'en'; //=> Pitcairn -> English
  if(input == 'SB') return 'en'; //=> Solomon Islands -> English
  if(input == 'SH') return 'en'; //=> Saint Helena, Ascension and Tristan da Cunha -> English
  if(input == 'SL') return 'en'; //=> Sierra Leone -> English
  if(input == 'SS') return 'en'; //=> South Sudan -> English
  if(input == 'TC') return 'en'; //=> Turks and Caicos Islands -> English
  if(input == 'TK') return 'en'; //=> Tokelau -> English
  if(input == 'TT') return 'en'; //=> Trinidad and Tobago -> English
  if(input == 'TV') return 'en'; //=> Tuvalu -> English
  if(input == 'UM') return 'en'; //=> United States Minor Outlying Islands -> English
  if(input == 'US') return 'en'; //=> United States of America -> English
  if(input == 'VC') return 'en'; //=> Saint Vincent and the Grenadines -> English
  if(input == 'VG') return 'en'; //=> Virgin Islands (British) -> English
  if(input == 'VI') return 'en'; //=> Virgin Islands (U.S.) -> English
  if(input == 'ZM') return 'en'; //=> Zambia -> English

  if(input == 'BO') return 'es'; //=> Bolivia (Plurinational State of) -> Spanish
  if(input == 'ES') return 'es'; //=> Spain -> Spanish
  if(input == 'GQ') return 'es'; //=> Equatorial Guinea -> Spanish


  if(input == 'AR') return 'es-la'; //=> Argentina -> Spanish (Latin American)
  if(input == 'CL') return 'es-la'; //=> Chile -> Spanish (Latin American)
  if(input == 'CO') return 'es-la'; //=> Colombia -> Spanish (Latin American)
  if(input == 'CR') return 'es-la'; //=> Costa Rica -> Spanish (Latin American)
  if(input == 'CU') return 'es-la'; //=> Cuba -> Spanish (Latin American)
  if(input == 'DO') return 'es-la'; //=> Dominican Republic -> Spanish (Latin American)
  if(input == 'EC') return 'es-la'; //=> Ecuador -> Spanish (Latin American)
  if(input == 'GT') return 'es-la'; //=> Guatemala -> Spanish (Latin American)
  if(input == 'HN') return 'es-la'; //=> Honduras -> Spanish (Latin American)
  if(input == 'NI') return 'es-la'; //=> Nicaragua -> Spanish (Latin American)
  if(input == 'MX') return 'es-la'; //=> Mexico -> Spanish (Latin American)
  if(input == 'PA') return 'es-la'; //=> Panama -> Spanish (Latin American)
  if(input == 'PR') return 'es-la'; //=> Puerto Rico -> Spanish (Latin American)
  if(input == 'PY') return 'es-la'; //=> Paraguay -> Spanish (Latin American)
  if(input == 'SV') return 'es-la'; //=> El Salvador -> Spanish (Latin American)
  if(input == 'UY') return 'es-la'; //=> Uruguay -> Spanish (Latin American)
  if(input == 'VE') return 'es-la'; //=> Venezuela (Bolivarian Republic of) -> Spanish (Latin American)

  if(input == 'IR') return 'fa'; //=> Iran (Islamic Republic of) -> Persian

  if(input == 'FI') return 'fi'; //=> Finland -> Finnish

  if(input == 'FJ') return 'fj'; //=> Fiji -> Fijian

  if(input == 'FO') return 'fo'; //=> Faroe Islands -> Faroese

  if(input == 'BE') return 'fr'; //=> Belgium -> French
  if(input == 'BF') return 'fr'; //=> Burkina Faso -> French
  if(input == 'BI') return 'fr'; //=> Burundi -> French
  if(input == 'BJ') return 'fr'; //=> Benin -> French
  if(input == 'BL') return 'fr'; //=> Saint Barthélemy -> French
  if(input == 'CD') return 'fr'; //=> Congo, Democratic Republic of the -> French
  if(input == 'CI') return 'fr'; //=> Côte d'Ivoire -> French
  if(input == 'CM') return 'fr'; //=> Cameroon -> French
  if(input == 'FR') return 'fr'; //=> France -> French
  if(input == 'GA') return 'fr'; //=> Gabon -> French
  if(input == 'GF') return 'fr'; //=> French Guiana -> French
  if(input == 'GN') return 'fr'; //=> Guinea -> French
  if(input == 'GP') return 'fr'; //=> Guadeloupe -> French
  if(input == 'KM') return 'fr'; //=> Comoros -> French
  if(input == 'MC') return 'fr'; //=> Monaco -> French
  if(input == 'MF') return 'fr'; //=> Saint Martin (French part) -> French
  if(input == 'MG') return 'fr'; //=> Madagascar -> French
  if(input == 'ML') return 'fr'; //=> Mali -> French
  if(input == 'MQ') return 'fr'; //=> Martinique -> French
  if(input == 'NC') return 'fr'; //=> New Caledonia -> French
  if(input == 'PM') return 'fr'; //=> Saint Pierre and Miquelon -> French
  if(input == 'PF') return 'fr'; //=> French Polynesia -> French
  if(input == 'RE') return 'fr'; //=> Réunion -> French
  if(input == 'SC') return 'fr'; //=> Seychelles -> French
  if(input == 'SN') return 'fr'; //=> Senegal -> French
  if(input == 'TF') return 'fr'; //=> French Southern Territories -> French
  if(input == 'YT') return 'fr'; //=> Mayotte -> French
  if(input == 'WF') return 'fr'; //=> Wallis and Futuna -> French

  if(input == 'IM') return 'gv'; //=> Isle of Man -> Manx

  if(input == 'NG') return 'ha'; //=> Nigeria

  if(input == 'IL') return 'he'; //=> Israel -> Hebrew

  if(input == 'IN') return 'hi'; //=> India -> Hindi

  if(input == 'HR') return 'hr'; //=> Croatia -> Croatian

  if(input == 'HT') return 'ht'; //=> Haiti -> Haitian, Haitian Creole

  if(input == 'HU') return 'hu'; //=> Hungary -> Hungarian

  if(input == 'AM') return 'hy'; //=> Armenia -> Armenian

  if(input == 'ID') return 'id'; //=> Indonesia -> Indonesian

  if(input == 'IS') return 'is'; //=> Iceland -> Icelandic

  if(input == 'IT') return 'it'; //=> Italy -> Italian
  if(input == 'SM') return 'it'; //=> San Marino -> Italian
  if(input == 'VA') return 'it'; //=> Holy See -> Italian

  if(input == 'JP') return 'ja'; //=> Japan -> Japanese
  if(input == 'PW') return 'ja'; //=> Palau -> Japanese

  if(input == 'GE') return 'ka'; //=> Georgia -> Georgian

  if(input == 'KZ') return 'kk'; //=> Kazakhstan -> Kazakh

  if(input == 'GL') return 'kl'; //=> Greenland -> Kalaallisut, Greenlandic

  if(input == 'KH') return 'km'; //=> Cambodia -> Central Khmer

  if(input == 'KP') return 'ko'; //=> Korea (Democratic People's Republic of) -> Korean
  if(input == 'KR') return 'ko'; //=> Korea, Republic of -> Korean

  if(input == 'IQ') return 'ku'; //=> Iraq -> Kurdish

  if(input == 'LU') return 'lb'; //=> Luxembourg -> Luxembourgish, Letzeburgesch

  if(input == 'CG') return 'ln'; //=> Congo -> Lingala

  if(input == 'LA') return 'lo'; //=> Lao People's Democratic Republic -> Lao

  if(input == 'LT') return 'lt'; //=> Lithuania -> Lithuanian

  if(input == 'LV') return 'lv'; //=> Latvia -> Latvian

  if(input == 'MH') return 'mh'; //=> Marshall Islands -> Marshallese

  if(input == 'NZ') return 'mi'; //=> New Zealand -> Maori

  if(input == 'MK') return 'mk'; //=> North Macedonia

  if(input == 'MN') return 'mn'; //=> Mongolia -> Mongolian

  if(input == 'MT') return 'mt'; //=> Malta -> Maltese

  if(input == 'BN') return 'ms'; //=> Brunei Darussalam -> Malay
  if(input == 'CC') return 'ms'; //=> Cocos (Keeling) Islands -> Malay
  if(input == 'MY') return 'ms'; //=> Malaysia -> Malay
  if(input == 'SG') return 'ms'; //=> Singapore -> Malay

  if(input == 'MM') return 'my'; //=> Myanmar -> Burmese

  if(input == 'AW') return 'nl'; //=> Aruba -> Dutch
  if(input == 'BQ') return 'nl'; //=> Bonaire, Sint Eustatius and Saba -> Dutch
  if(input == 'CW') return 'nl'; //=> Curaçao -> Dutch
  if(input == 'NL') return 'nl'; //=> Netherlands -> Dutch
  if(input == 'SR') return 'nl'; //=> Suriname -> Dutch
  if(input == 'SX') return 'nl'; //=> Sint Maarten (Dutch part) -> Dutch

  if(input == 'NP') return 'ne'; //=> Nepal -> Nepali

  if(input == 'BV') return 'no'; //=> Bouvet Island -> Norwegian
  if(input == 'NO') return 'no'; //=> Norway -> Norwegian

  if(input == 'MW') return 'ny'; //=> Malawi -> Chichewa, Chewa, Nyanja
  if(input == 'ZW') return 'ny'; //=> Zimbabwe -> Chichewa, Chewa, Nyanja

  if(input == 'PL') return 'pl'; //=> Poland -> Polish

  if(input == 'AF') return 'ps'; //=> Afghanistan -> Pashto

  if(input == 'AO') return 'pt'; //=> Angola -> Portuguese
  if(input == 'CV') return 'pt'; //=> Cabo Verde -> Portuguese
  if(input == 'GW') return 'pt'; //=> Guinea-Bissau -> Portuguese
  if(input == 'MZ') return 'pt'; //=> Mozambique -> Portuguese
  if(input == 'PT') return 'pt'; //=> Portugal -> Portuguese
  if(input == 'ST') return 'pt'; //=> Sao Tome and Principe -> Portuguese
  if(input == 'TL') return 'pt'; //=> Timor-Leste -> Portuguese

  if(input == 'BR') return 'pt-br'; //=> Brazil -> Portuguese (Brazil)

  if(input == 'PE') return 'qu'; //=> Peru -> Quechua

  if(input == 'MD') return 'ro'; //=> Moldova, Republic of -> Romanian, Moldavian, Moldovan
  if(input == 'RO') return 'ro'; //=> Romania -> Romanian, Moldavian, Moldovan

  if(input == 'KG') return 'ru'; //=> Kyrgyzstan -> Russian
  if(input == 'RU') return 'ru'; //=> Russian Federation -> Russian

  if(input == 'RW') return 'rw'; //=> Rwanda -> Kinyarwanda

  if(input == 'AX') return 'sv'; //=> Åland Islands -> Swedish
  if(input == 'SE') return 'sv'; //=> Sweden -> Swedish

  if(input == 'KE') return 'sw'; //=> Kenya -> Swahili
  if(input == 'TZ') return 'sw'; //=> Tanzania, United Republic of -> Swahili
  if(input == 'UG') return 'sw'; //=> Uganda -> Swahili

  if(input == 'CF') return 'sg'; //=> Central African Republic -> Sango

  if(input == 'LK') return 'si'; //=> Sri Lanka -> Sinhala, Sinhalese

  if(input == 'SK') return 'sk'; //=> Slovakia -> Slovak

  if(input == 'SI') return 'sl'; //=> Slovenia -> Slovenian

  if(input == 'WS') return 'sm'; //=> Samoa -> Samoan

  if(input == 'SO') return 'so'; //=> Somalia -> Somali

  if(input == 'AL') return 'sq'; //=> Albania -> Albanian
  if(input == 'ME') return 'sq'; //=> Montenegro -> Albanian

  if(input == 'RS') return 'sr'; //=> Serbia -> Serbian

  if(input == 'SZ') return 'ss'; //=> Eswatini -> Swati

  if(input == 'TJ') return 'tg'; //=> Tajikistan -> Tajik

  if(input == 'TH') return 'th'; //=> Thailand -> Thai

  if(input == 'TM') return 'tk'; //=> Turkmenistan -> Turkmen

  if(input == 'PH') return 'tl'; //=> Philippines -> Tagalog, Filipino (Pilipino)

  if(input == 'TO') return 'to'; //=> Tonga -> Tonga (Tonga Islands)

  if(input == 'TR') return 'tr'; //=> Türkiye -> Turkish

  if(input == 'PK') return 'ur'; //=> Pakistan

  if(input == 'UA') return 'uk'; //=> Ukraine -> Ukrainian

  if(input == 'UZ') return 'uz'; //=> Uzbekistan -> Uzbek

  if(input == 'VN') return 'vi'; //=> Viet Nam -> Vietnamese

  if(input == 'ER') return 'xx'; //=> Eritrea -> Unknown
  if(input == 'SJ') return 'xx'; //=> Svalbard and Jan Mayen -> Unknown
  if(input == 'XX') return 'xx'; //=> Unknown -> Unknown

  if(input == 'CN') return 'zh'; //=> China -> Chinese (Traditional)

  if(input == 'HK') return 'zh-hk'; //=> Hong Kong -> Chinese (simplified)
  if(input == 'MO') return 'zh-hk'; //=> Macao -> Chinese (simplified)
  if(input == 'TW') return 'zh-hk'; //=> Taiwan, Province of China -> Chinese (simplified)

  return 'xx'; //=> Unknown

}
