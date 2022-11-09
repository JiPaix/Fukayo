import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n';
import type { Ref } from 'vue';

export function sortMirrorByNames(mirrors:mirrorInfo[], AZ:boolean) {
  return mirrors.sort((a, b) => {
    if (AZ) {
      return a.displayName.localeCompare(b.displayName);
    }
    return b.displayName.localeCompare(a.displayName);
  });
}

export function applyAllFilters(mirrors:mirrorInfo[], query: string|null, includedLangs: string[]) {
    const q = query ? query.toLowerCase() : '';
    return mirrors.filter(mirror => {
      return (
        (
          mirror.name.toLowerCase().includes(q) ||
          mirror.displayName.toLowerCase().includes(q) ||
          mirror.host.toLowerCase().includes(q)
        ) && mirror.langs.some(m => includedLangs.includes(m))
      );
    });
}

/** sort langs by their i18n-translated value */
export function sortLangs(langs:string[], $t:(string:string)=>string) {
  return langs.sort((a, b) => $t(`languages.${a}`).localeCompare($t(`languages.${b}`)));
}

/** include/exclude all languages from the filter */
export function toggleAllLanguages(includedAllLanguage: boolean|null, allLangs: mirrorsLangsType[], includedLangsRAW: Ref<mirrorsLangsType[]>) {
  if(includedAllLanguage) {
    allLangs.forEach(l => {
      if(includedLangsRAW.value.includes(l)) toggleLang(l, includedLangsRAW);
    });
  } else {
    allLangs.forEach(l => {
      if(!includedLangsRAW.value.includes(l)) toggleLang(l, includedLangsRAW);
    });
  }
}

/** include/exclude a language from the filter, also affects the mirror filter */
export function toggleLang(lang:mirrorsLangsType, includedLangsRAW: Ref<mirrorsLangsType[]>, mirrorsRAW?:mirrorInfo[], includedMirrors?: Ref<string[]>, globallyIgnored?:mirrorsLangsType[]) {
  if(includedLangsRAW.value.some(m => m === lang)) {
    includedLangsRAW.value = includedLangsRAW.value.filter(m => m !== lang);
  } else {
    includedLangsRAW.value.push(lang);
  }
  if(globallyIgnored) {
    // remove said language from list
    includedLangsRAW.value = includedLangsRAW.value.filter(l => !globallyIgnored.includes(l));
  }
  if(includedMirrors && mirrorsRAW) includedMirrors.value = mirrorsRAW.filter(m => {
    return includedLangsRAW.value.some(l => m.langs.includes(l));
  }).map(m => m.name);
}

export function toggleAllMirrors(mirrorsRAW: mirrorInfo[], includedAllMirrors: boolean|null, includedMirrors: Ref<string[]>, includedLangsRAW?: Ref<mirrorsLangsType[]>) {
  if(includedAllMirrors) {
    mirrorsRAW.forEach(m => {
      if(includedMirrors.value.includes(m.name)) toggleMirror(m.name, mirrorsRAW, includedMirrors, includedLangsRAW);
    });
  } else {
    mirrorsRAW.forEach(m => {
      if(!includedMirrors.value.includes(m.name)) toggleMirror(m.name, mirrorsRAW, includedMirrors, includedLangsRAW);
    });
  }
}

export function toggleMirror(mirror:string, mirrorsRAW: mirrorInfo[], includedMirrors: Ref<string[]>, includedLangsRAW?: Ref<mirrorsLangsType[]>, globallyIgnoredLanguage?:mirrorsLangsType[]) {
  if(includedMirrors.value.some(m => m === mirror)) {
    includedMirrors.value = includedMirrors.value.filter(m => m !== mirror);
  } else {
    includedMirrors.value.push(mirror);
  }
  if(includedLangsRAW) {
    const mirrors = mirrorsRAW.filter(m => includedMirrors.value.includes(m.name));
    includedLangsRAW.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));
  }
  if(globallyIgnoredLanguage) {
    // remove said language from list
    if(includedLangsRAW) includedLangsRAW.value = includedLangsRAW.value.filter(l => !globallyIgnoredLanguage.includes(l));
  }
}


export function setupMirrorFilters(mirrors:mirrorInfo[], mirrorsRAW: Ref<mirrorInfo[]>, includedLangsRAW: Ref<mirrorsLangsType[]>, allLangs: Ref<mirrorsLangsType[]>|mirrorsLangsType[], includedMirrors?: Ref<string[]>, globallyIgnored?: mirrorsLangsType[]) {
  // set enabled mirrors list
  mirrorsRAW.value = mirrors.sort((a, b) => a.name.localeCompare(b.name));
  // get list of languages based of mirrors
  includedLangsRAW.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));
  // If list of language to ignore is provided:
  if(globallyIgnored) {
    // remove said language from list
    includedLangsRAW.value = includedLangsRAW.value.filter(l => !globallyIgnored.includes(l));
    // remove mirror that don't match the new language list
    mirrorsRAW.value = mirrorsRAW.value.filter(m => m.langs.some(l => includedLangsRAW.value.includes(l)));
  }
  // copy includedLangs to allLangs
  if((allLangs as Ref<mirrorsLangsType[]>).value) {
    (allLangs as Ref<mirrorsLangsType[]>).value = includedLangsRAW.value;
  }
  // if a list of mirror is provided add them to the included list
  if(includedMirrors) includedMirrors.value = mirrors.map(m => m.name);
}
