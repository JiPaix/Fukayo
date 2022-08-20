<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import { sortLangs, toggleAllLanguages, toggleAllMirrors, toggleLang, toggleMirror } from '@renderer/components/helpers/mirrorFilters';
import type en from '@renderer/locales/en.json';
import type { supportedLangsType } from '@renderer/locales/lib/supportedLangs';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  mirrorList: mirrorInfo[]
  langList: string[]
}>();
/** emits */
const emit = defineEmits<{
  (event: 'search', input: typeof search.value): void
  (event: 'filter', mirror: string[], langs:string[]): void
}>();
const $t = useI18n<{message: typeof en}, supportedLangsType>().t.bind(useI18n());
/** settings */
const settings = useSettingsStore();
/** search filter */
const search = ref<string|null>(null);
/** mirror filter */
const includedMirrors = ref<string[]>([]);
/** lang filter */
const includedLangsRAW = ref<string[]>([]);
/** return the ordered list of includedLangsRAW */
const includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
});
/** all mirrors are included? */
const includedAllMirrors = computed({
  get() {
    if(includedMirrors.value.length < props.mirrorList.length) {
      if(includedMirrors.value.length === 0) return false;
      return null;
    }
    return true;
  },
  set() {
    pickallMirrors();
  },
});
/** all langs are included? */
const includedAllLanguage = computed({
  get() {
    if(includedLangsRAW.value.length < props.langList.length) {
      if(includedLangsRAW.value.length === 0) return false;
      return null;
    }
    return true;
  },
  set() {
    pickAllLangs();
  },
});

/** include/exclude a mirror from the filter, also affects the language filter */
function pickMirror(mirror:string) {
  toggleMirror(mirror, props.mirrorList, includedMirrors, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l));
}

/** include/exclude all mirrors from the filter */
function pickallMirrors() {
  toggleAllMirrors(props.mirrorList, includedAllMirrors.value, includedMirrors, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l));
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pickLang(lang:string) {
  toggleLang(lang, includedLangsRAW, props.mirrorList, includedMirrors);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l));
}

/** include/exclude all languages from the filter */
function pickAllLangs() {
  toggleAllLanguages(includedAllLanguage.value, props.langList, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l));
}

watch(() => props.mirrorList, (mirrors) => {
  mirrors.forEach(m => {
    if(!includedMirrors.value.includes(m.name)) {
      includedMirrors.value.push(m.name);
    }
  });
});

watch(() => props.langList, (langs) => {
  langs.forEach(l => {
    if(!includedLangsRAW.value.includes(l)) {
      includedLangsRAW.value.push(l);
    }
  });
});

onMounted(() => {
  const langs = new Set<string>();
  const mirrors = new Set<string>();
  props.mirrorList.forEach(m => {
    m.langs.forEach(l => langs.add(l));
    mirrors.add(m.name);
  });
  includedLangsRAW.value = Array.from(langs);
  includedMirrors.value = Array.from(mirrors);
});
</script>
<template>
  <div class="row">
    <q-input
      v-model="search"
      clearable
      filled
      color="orange"
      :label="$t('library.filter_by_name')"
      class="col-12"
      @keyup="emit('search', search)"
    />
    <div class="col-12 q-mt-md text-center">
      <q-btn-group :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'">
        <q-btn
          :ripple="false"
          text-color="orange"
          icon="filter_alt"
          style="cursor:default!important;"
        />
        <q-btn
          :icon="settings.library.sort === 'AZ' ? 'text_rotation_angledown' : 'text_rotation_angleup'"
          size="1em"
          @click="settings.library.sort === 'AZ' ? settings.library.sort = 'ZA' : settings.library.sort = 'AZ'"
        />
        <q-btn-dropdown
          :text-color="includedAllMirrors || includedMirrors.length === 0 ? '' : 'orange'"
          icon="bookmarks"
          size="1em"
        >
          <q-list
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
          >
            <q-item
              dense
              clickable
              :dark="$q.dark.isActive"
              @click="pickallMirrors"
            >
              <q-checkbox
                v-model="includedAllMirrors"
                size="32px"
                color="primary"
                toggle-indeterminate
                class="q-ma-none q-pa-none"
                :dark="$q.dark.isActive"
              />
              <q-item-section
                avatar
                class="q-ma-none q-pa-none"
                style="min-width:36px!important;"
              >
                <q-avatar
                  size="36px"
                  text-color="primary"
                  icon="o_bookmarks"
                />
              </q-item-section>
              <q-item-section class="text-uppercase text-bold">
                {{ $t('search.all') }}
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-for="mirror in mirrorList"
              :key="mirror.name"
              clickable
              :dark="$q.dark.isActive"
              @click="pickMirror(mirror.name)"
            >
              <q-checkbox
                v-model="includedMirrors"
                size="32px"
                color="orange"
                :val="mirror.name"
                class="q-ma-none q-pa-none"
                :dark="$q.dark.isActive"
              />
              <q-item-section
                avatar
                class="q-ma-none q-pa-none"
                style="min-width: 32px!important;"
              >
                <q-avatar
                  size="32px"
                  :icon="'img:'+mirror.icon"
                />
              </q-item-section>
              <q-item-section>
                {{ mirror.displayName }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn-dropdown
          icon="translate"
          size="1em"
          :text-color="includedAllLanguage || includedLangs.length === 0 ? '' : 'orange'"
        >
          <q-list
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
          >
            <q-item
              dense
              clickable
              :dark="$q.dark.isActive"
              @click="pickAllLangs"
            >
              <q-checkbox
                v-model="includedAllLanguage"
                size="32px"
                color="primary"
                class="q-ma-none q-pa-none"
                toggle-indeterminate
                :dark="$q.dark.isActive"
              />
              <q-item-section
                avatar
                class="q-ma-none q-pa-none"
                style="min-width:36px!important;"
              >
                <q-avatar
                  size="36px"
                  text-color="primary"
                  icon="o_language"
                />
              </q-item-section>
              <q-item-section class="text-uppercase text-bold">
                {{ $t('search.all') }}
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-for="lang in props.langList"
              :key="lang"
              clickable
              :dark="$q.dark.isActive"
              @click="pickLang(lang)"
            >
              <q-checkbox
                :model-value="includedLangs"
                size="32px"
                color="orange"
                :val="lang"
                class="q-ma-none q-pa-none"
                :dark="$q.dark.isActive"
                @update:model-value="pickLang(lang)"
              />
              <q-item-section class="q-ma-none">
                {{ $t('languages.'+lang+'.value') }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn
          icon="new_releases"
          size="1em"
          :text-color="settings.library.showUnread ? '' : 'orange'"
          @click="settings.library.showUnread = !settings.library.showUnread"
        >
          <q-tooltip>
            {{ settings.library.showUnread ? $t('library.hide_unread') : $t('library.show_unread') }}
          </q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
  </div>
</template>
