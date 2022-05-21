import type { mirrorInfo } from '../../../../api/src/models/types/shared';
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
  return langs.sort((a, b) => $t(`languages.${a}.value`).localeCompare($t(`languages.${b}.value`)));
}

/** include/exclude all languages from the filter */
export function toggleAllLanguages(includedAllLanguage: boolean|null, allLangs: string[], includedLangsRAW: Ref<string[]>) {
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
export function toggleLang(lang:string, includedLangsRAW: Ref<string[]>, mirrorsRAW?:Ref<mirrorInfo[]>, includedMirrors?: Ref<string[]>) {
  if(includedLangsRAW.value.some(m => m === lang)) {
    includedLangsRAW.value = includedLangsRAW.value.filter(m => m !== lang);
  } else {
    includedLangsRAW.value.push(lang);
  }
  if(includedMirrors && mirrorsRAW) includedMirrors.value = mirrorsRAW.value.filter(m => {
    return includedLangsRAW.value.some(l => m.langs.includes(l));
  }).map(m => m.name);
}

export function toggleAllMirrors(mirrorsRAW: Ref<mirrorInfo[]>, includedAllMirrors: boolean|null, includedMirrors: Ref<string[]>, includedLangsRAW?: Ref<string[]>) {
  if(includedAllMirrors) {
    mirrorsRAW.value.forEach(m => {
      if(includedMirrors.value.includes(m.name)) toggleMirror(m.name, mirrorsRAW, includedMirrors, includedLangsRAW);
    });
  } else {
    mirrorsRAW.value.forEach(m => {
      if(!includedMirrors.value.includes(m.name)) toggleMirror(m.name, mirrorsRAW, includedMirrors, includedLangsRAW);
    });
  }
}

export function toggleMirror(mirror:string, mirrorsRAW: Ref<mirrorInfo[]>, includedMirrors: Ref<string[]>, includedLangsRAW?: Ref<string[]>) {
  if(includedMirrors.value.some(m => m === mirror)) {
    includedMirrors.value = includedMirrors.value.filter(m => m !== mirror);
  } else {
    includedMirrors.value.push(mirror);
  }
  if(includedLangsRAW) {
    const mirrors = mirrorsRAW.value.filter(m => includedMirrors.value.includes(m.name));
    includedLangsRAW.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));
  }
}


export function setupMirrorFilters(mirrors:mirrorInfo[], mirrorsRAW: Ref<mirrorInfo[]>, includedLangsRAW: Ref<string[]>, allLangs: Ref<string[]>, includedMirrors?: Ref<string[]>) {
  mirrorsRAW.value = mirrors.sort((a, b) => a.name.localeCompare(b.name));
  includedLangsRAW.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));
  allLangs.value = includedLangsRAW.value;
  if(includedMirrors) includedMirrors.value = mirrors.map(m => m.name);
}
