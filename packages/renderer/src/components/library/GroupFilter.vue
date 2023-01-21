<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { sortLangs, toggleAllLanguages, toggleAllMirrors, toggleLang, toggleMirror } from '@renderer/components/helpers/mirrorFilters';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  mirrorList: mirrorInfo[]
  langList: mirrorsLangsType[]
  userCategories?: string[]
}>();

/** emits */
const emit = defineEmits<{
  (event: 'search', input: typeof search.value): void
  (event: 'filter', mirror: string[], langs:mirrorsLangsType[], userCategories:string[]): void
}>();

// settings
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** settings */
settings = useSettingsStore();

// states
const
/** search filter */
search = ref<string|null>(null),
/** mirror filter */
includedMirrors = ref<string[]>([]),
/** lang filter */
includedLangsRAW = ref<mirrorsLangsType[]>([]),
/** show the filter dialog */
showFilterDialog = ref(false),
/** selected categories */
selectedCategories = ref<string[]>([]);

// computed
const
/** return the ordered list of includedLangsRAW */
includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
}),
/** all mirrors are included? (read-write) */
includedAllMirrors = computed({
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
}),
/** all langs are included? (read-write) */
includedAllLanguage = computed({
  get() {
    if(includedLangsRAW.value.length < props.langList.length) return false;
    return true;
  },
  set() {
    pickAllLangs();
  },
}),
/** are all categories included? (read-write) */
includedAllCategories = computed({
  get() {
    if(!props.userCategories) return false;
    if(selectedCategories.value.length !== props.userCategories.length) return false;
    return true;
  },
  set() {
    pickAllCategories();
  },
});

/** select all categories */
function pickAllCategories() {
  if(!props.userCategories) return;
  if(selectedCategories.value.length === props.userCategories.length) selectedCategories.value = [];
  else selectedCategories.value = props.userCategories;
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** toggle a category */
function toggleCategory(cat:string) {
  if(selectedCategories.value.includes(cat)) selectedCategories.value = selectedCategories.value.filter(c => c !== cat);
  else selectedCategories.value.push(cat);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** include/exclude a mirror from the filter, also affects the language filter */
function pickMirror(mirror:string) {
  toggleMirror(mirror, props.mirrorList, includedMirrors, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** include/exclude all mirrors from the filter */
function pickallMirrors() {
  toggleAllMirrors(props.mirrorList, includedAllMirrors.value, includedMirrors, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pickLang(lang:mirrorsLangsType) {
  toggleLang(lang, includedLangsRAW, props.mirrorList, includedMirrors);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** include/exclude all languages from the filter */
function pickAllLangs() {
  toggleAllLanguages(includedAllLanguage.value, props.langList, includedLangsRAW);
  emit('filter', includedMirrors.value, includedLangsRAW.value.map(l => l), selectedCategories.value);
}

/** update props.mirrorList to includedMirrors  */
watch(() => props.mirrorList, (mirrors) => {
  mirrors.forEach(m => {
    if(!includedMirrors.value.includes(m.name)) {
      includedMirrors.value.push(m.name);
    }
  });
});

/** update props.langList to includedLangsRAW */
watch(() => props.langList, (langs) => {
  langs.forEach(l => {
    if(!includedLangsRAW.value.includes(l)) {
      includedLangsRAW.value.push(l);
    }
  });
});

onMounted(() => {
  const langs = new Set<mirrorsLangsType>();
  const mirrors = new Set<string>();
  props.mirrorList.forEach(m => {
    mirrors.add(m.name);
  });
  props.langList.forEach(l => langs.add(l));
  includedLangsRAW.value = Array.from(langs);
  includedMirrors.value = Array.from(mirrors);
});
</script>
<template>
  <div class="row q-pa-lg">
    <q-input
      v-model="search"
      clearable
      filled
      color="orange"
      :label="$t('library.filter_by_name')"
      class="col-12"
      autocomplete="off"
      type="search"
      @keyup="emit('search', search)"
    />
    <div class="col-12 q-mt-md text-center">
      <q-btn-group :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'">
        <q-btn
          v-if="$q.screen.gt.xs"
          :ripple="false"
          text-color="orange"
          icon="filter_alt"
          style="cursor:default!important;"
        />
        <q-btn
          v-if="$q.screen.gt.xs"
          :icon="settings.library.sort === 'AZ' ? 'text_rotation_angledown' : 'text_rotation_angleup'"
          size="1em"
          @click="settings.library.sort === 'AZ' ? settings.library.sort = 'ZA' : settings.library.sort = 'AZ'"
        />
        <q-btn
          v-if="$q.screen.gt.xs"
          :icon="settings.library.sort === 'unread' ? 'trending_up' : 'trending_down'"
          size="1em"
          @click="settings.library.sort === 'unread' ? settings.library.sort = 'read' : settings.library.sort = 'unread'"
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
                  icon="o_translate"
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
                {{ $t('languages.'+lang) }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn-dropdown
          v-if="userCategories && userCategories.length"
          icon="category"
          size="1em"
          :text-color="selectedCategories.length === userCategories.length ? '' : 'orange'"
        >
          <q-list
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
          >
            <q-item
              dense
              clickable
              :dark="$q.dark.isActive"
              @click="pickAllCategories"
            >
              <q-checkbox
                v-model="includedAllCategories"
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
                  icon="o_category"
                />
              </q-item-section>
              <q-item-section class="text-uppercase text-bold">
                {{ $t('search.all') }}
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-for="cat in props.userCategories"
              :key="cat"
              clickable
              :dark="$q.dark.isActive"
              @click="toggleCategory(cat)"
            >
              <q-checkbox
                :model-value="selectedCategories.includes(cat)"
                size="32px"
                color="orange"
                :val="cat"
                class="q-ma-none q-pa-none"
                :dark="$q.dark.isActive"
                @update:model-value="toggleCategory(cat)"
              />
              <q-item-section class="q-ma-none">
                {{ cat }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn
          v-if="$q.screen.gt.xs"
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
    <q-btn
      v-if="!$q.screen.gt.xs"
      class="col-12 q-mt-md text-center bg-grey-9"
      icon="filter_list"
      @click="showFilterDialog = !showFilterDialog"
    />
  </div>
  <q-dialog
    v-model="showFilterDialog"
    position="standard"
  >
    <q-card
      class="q-pa-lg"
      style="width: 350px;"
    >
      <div class="row items-center">
        <div class="col-6">
          <span class="text-weight-bold">{{ $t('library.sort_by_name') }}:</span>
        </div>
        <div class="col-6 text-right">
          <q-btn
            flat
            round
            :color="settings.library.sort === 'AZ' || settings.library.sort === 'ZA' ? 'orange': ''"
            :icon="settings.library.sort === 'AZ' ? 'text_rotation_angledown' : 'text_rotation_angleup'"
            size="lg"
            @click="settings.library.sort === 'AZ' ? settings.library.sort = 'ZA' : settings.library.sort = 'AZ'"
          />
        </div>
      </div>
      <div class="row items-center q-mt-lg">
        <div class="col-6">
          <span class="text-weight-bold">{{ $t('library.hide_unread') }}:</span>
        </div>
        <div class="col-6 text-right">
          <q-toggle
            :model-value="!settings.library.showUnread"
            color="orange"
            @update:model-value="settings.library.showUnread = !settings.library.showUnread"
          />
        </div>
      </div>
      <div class="row items-center q-mt-lg">
        <div class="col-6">
          <span class="text-weight-bold">{{ $t('library.sort_by_read') }}:</span>
        </div>
        <div class="col-6 text-right">
          <q-btn
            flat
            :icon="settings.library.sort === 'unread' ? 'trending_up' : 'trending_down'"
            size="lg"
            :color="settings.library.sort === 'unread' || settings.library.sort === 'read' ? 'orange': ''"
            @click="settings.library.sort === 'unread' ? settings.library.sort = 'read' : settings.library.sort = 'unread'"
          />
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>
