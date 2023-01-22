<script lang="ts" setup>
import type { SearchErrorMessage } from '@api/models/types/errors';
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import type en from '@i18n/../locales/en.json';
import GroupCard from '@renderer/components/explore/GroupCard.vue';
import { setupMirrorFilters, sortLangs, toggleAllLanguages, toggleAllMirrors, toggleLang, toggleMirror } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isSearchResult, isTaskDone } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { QForm, QLinearProgress, useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import Fuse from 'fuse.js';

// config
const
/** quasar */
$q = useQuasar(),
/** current route */
route = useRoute(),
/** settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// globals
const
/** progress bar's default height */
progressBarSize = 4;

// states
const
/** QForm template ref */
form = ref<InstanceType<typeof QForm>>(),
formSize = ref(0),
/** template ref for the search input */
inputRef = ref<HTMLInputElement | null>(null),
/** search input model */
query = ref(''),
/** last search we actually proceeded */
currentQuery = ref(''),
/** display a loading circle next the the input while processing the request */
loading = ref(false),
/** search errored */
error = ref<null|SearchErrorMessage>(null),
/** query results from the websocket */
rawResults = ref([] as (SearchResult)[]), // the raw search results
/** all the results been fetched  */
done = ref(false),
/** sort results A-Z or Z-A */
sortAZ = ref<boolean>(true), // sort by name (A-Z|Z-A)
/** list of languages available from mirrors */
allLangs = ref<mirrorsLangsType[]>([]),
/** language(s) to include in the query and/or results */
includedLangsRAW = ref<mirrorsLangsType[]>([]),
/** list of available mirrors */
mirrorsList = ref<mirrorInfo[]>([]),
/** mirror(s) to include in the query and/or results */
includedMirrors = ref<string[]>([]),
/** ignored languages */
ignoredLangs = ref(mirrorsLang as unknown as mirrorsLangsType[]);


// computed
const
/** progress bar's current height */
progressSize = computed(() => loading.value ? progressBarSize : 0),
/** parent's QHeader + QHeader heights */
headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
}),
/** search results filtered and sorted */
results = computed(() => {
  const filtered = rawResults.value.map<SearchResult>(r => {
    const mirrorinfo = mirrorsList.value.find(m => m.name === r.mirrorinfo.name);
    if(!mirrorinfo) throw Error($t('search.not_found', { source: r.mirrorinfo.name }));
      return {
        ...r,
        mirrorinfo,
      };
  })
  .filter(r => includedMirrors.value.includes(r.mirrorinfo.name))
  .filter(r => includedLangsRAW.value.some(l => r.mirrorinfo.langs.includes(l)));

  const fuse = new Fuse(filtered, {keys: ['name'], shouldSort: true });
  console.log('searching', query.value);
  const res = fuse.search(query.value);
  return res.map(r=>r.item);
}),
/** search results grouped */
mangaGroups = computed(() => {
return results.value.map(r => {
    return {
      name: r.name,
      manga: r,
      covers: r.covers,
    };
  });
}),
/** return the ordered list of includedLangsRAW */
includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
}),
/** returns true if all available mirror are included in the filter (read-write) */
includedAllMirrors = computed({
  get() {
    if(includedMirrors.value.length < mirrorsList.value.length) {
      if(includedMirrors.value.length === 0) return false;
      return null;
    }
    return true;
  },
  set() {
    pickallMirrors();
  },
}),
/** returns true if all available languages are included in the filter (read-write) */
includedAllLanguage = computed({
  get() {
    if(includedLangsRAW.value.length < allLangs.value.length) {
      if(includedLangsRAW.value.length === 0) return false;
      return null;
    }
    return true;
  },
  set() {
    pickAllLangs();
  },
});

/** save QHeader's height */
function qformResize() {
  if(!form.value) return;
  formSize.value = form.value.$el.offsetHeight;
}

/** include/exclude a mirror from the filter, also affects the language filter */
function pickMirror(mirror:string) {
  toggleMirror(mirror, mirrorsList.value, includedMirrors, includedLangsRAW, ignoredLangs.value);
}

/** include/exclude all mirrors from the filter */
function pickallMirrors() {
  toggleAllMirrors(mirrorsList.value, includedAllMirrors.value, includedMirrors, includedLangsRAW);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pickLang(lang:mirrorsLangsType) {
  toggleLang(lang, includedLangsRAW, mirrorsList.value, includedMirrors, ignoredLangs.value);
}

/** include/exclude all languages from the filter */
function pickAllLangs() {
  toggleAllLanguages(includedAllLanguage.value, allLangs.value, includedLangsRAW);
}

/** sends a search query to the websocket server */
async function research() {
  // make sure the query is at least 3 characters long and has changed since the last search
  if(!query.value || query.value.length < 3) return;
  if(query.value === currentQuery.value) return;

  // We don't need to reload the page to trigger/display the search results
  // But we still need to update the url to reflect the current query
  // this way we the user can grab the url and share it
  const refresh = window.location.href.replace(/\?.*/, '') + `?q=${query.value}`;
  window.history.pushState({ path: refresh }, '', refresh);

  // blur the input to hide the keyboard on touch devices
  if(inputRef.value && $q.platform.has.touch) inputRef.value.blur();

  const socket = await useSocket(settings.server);
  // stop any ongoing search requests
  socket.emit('stopSearchInMirrors');

  // reset previous results
  error.value = null;
  currentQuery.value = query.value;
  rawResults.value = [];
  done.value = false;

  /** helper to keep track of on going query */
  const task = { id: Date.now(), dones: 0, nbOfDonesToExpect: 0 };
  socket.emit(
    'searchInMirrors',
    query.value,
    task.id,
    includedMirrors.value,
    includedLangsRAW.value,
    (
      /** how many mirrors will respond */
      nbOfDonesToExpect,
    ) => {
      task.nbOfDonesToExpect = nbOfDonesToExpect;
      loading.value = true;

      socket.on('searchInMirrors', (id, res) => {
        if(id === task.id) {
          if(Array.isArray(res)){
            res.forEach(ele => {
              if(res && isSearchResult(ele)) rawResults.value.push({...ele, covers: ele.covers.map(c => transformIMGurl(c, settings))});
              else if(res && isTaskDone(ele)) {
                // mirror sent us a 'done' message
                task.dones++;
                if(task.dones === task.nbOfDonesToExpect) {
                  // if all mirrors have responded, we can stop listening and stop the loading animation
                  socket.off('searchInMirrors');
                  loading.value = false;
                  done.value = true;
                }
              }
            });
          }
          else if(res && isSearchResult(res)) rawResults.value.push({...res, covers: res.covers.map(c => transformIMGurl(c, settings))});
          else if(res && isTaskDone(res)) {
            // mirror sent us a 'done' message
            task.dones++;
            if(task.dones === task.nbOfDonesToExpect) {
              // if all mirrors have responded, we can stop listening and stop the loading animation
              socket.off('searchInMirrors');
              loading.value = false;
              done.value = true;
            }
          }
          else {
            loading.value = false;
            error.value = res;
            done.value = true;
          }
        }
      });
    },
  );
}

/** get available mirrors before rendering and start the search if params are present */
async function On() {
  const socket = await useSocket(settings.server);
  function getIgnoredLangs():Promise<void> {
    return new Promise(resolve => {
      socket.emit('getSettings', (globalSettings) => {
        ignoredLangs.value = mirrorsLang.filter(l => !globalSettings.langs.includes(l));
        resolve();
      });
    });
  }
  await getIgnoredLangs();
  const queryParam = route.query.q as string;
  socket.emit('getMirrors', false, (mirrors) => {
    setupMirrorFilters(mirrors, mirrorsList, includedLangsRAW, allLangs, includedMirrors, ignoredLangs.value);
    if(queryParam) {
      query.value = queryParam;
      research();
    }
  });
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.emit('stopSearchInMirrors');
}

onBeforeMount(On);
onBeforeUnmount(Off);
</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-headerSize)+'px'"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-footer class="bg-dark">
      <q-linear-progress
        v-if="loading"
        ref="progress"
        :size="`${progressBarSize}px`"
        color="orange"
        animation-speed="500"
        indeterminate
      />
    </q-footer>
    <q-page-container>
      <q-page style="overflow:hidden;">
        <q-form
          ref="form"
          class="text-center q-pa-lg"
          @submit="research"
        >
          <q-input
            ref="inputRef"
            v-model="query"
            type="search"
            autocomplete="off"
            :placeholder="$t('search.placeholder')"
            outlined
            clearable
            autofocus
            :dark="$q.dark.isActive"
            :color="$q.dark.isActive ? 'white': 'primary'"
            :loading="loading"
            :rules="[
              val => (typeof val === 'string' && val.trim().length > 0) || $t('search.no_input'),
              val => (typeof val === 'string' && val.trim().length >= 3) || $t('search.min_value', { number: 3 }),
            ]"
            lazy-rules
          >
            <template
              #append
            >
              <q-icon
                v-if="!query"
                :name="'search'"
                style="cursor:pointer"
                @click="research"
              />
            </template>
          </q-input>

          <q-btn-group
            :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
            class="q-mt-sm"
          >
            <q-btn
              :ripple="false"
              text-color="orange"
              icon="filter_alt"
              style="cursor:default!important;"
            />
            <q-btn
              :icon="sortAZ ? 'text_rotation_angledown' : 'text_rotation_angleup'"
              size="1em"
              @click="sortAZ = !sortAZ"
            />

            <q-btn-dropdown
              :text-color="includedAllMirrors ? '' : 'orange'"
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
                  v-for="mirror in mirrorsList"
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
                    {{ mirror.displayName }} {{
                      rawResults.filter(r=> r.mirrorinfo.name === mirror.name).length ?
                        '('+rawResults.filter(r=> r.mirrorinfo.name === mirror.name).length+')' : ''
                    }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
            <q-btn-dropdown
              icon="translate"
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
                  v-for="lang in allLangs"
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
          </q-btn-group>
          <q-resize-observer @resize="qformResize" />
        </q-form>
        <q-scroll-area
          :style="{height: `${$q.screen.height-headerSize-formSize-progressSize}px`, minHeight: '100px'}"
          :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
          :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
          class="q-pa-lg"
        >
          <div
            v-if="rawResults.length"
            class="flex flex-center"
          >
            <group-card
              v-for="(group, i) in mangaGroups"
              :key="i"
              :group="group.manga"
              :group-name="group.name"
              :mirror="group.manga.mirrorinfo"
              :hide-langs="ignoredLangs"
              :covers="group.covers"
              class="q-my-lg"
            />
          </div>
          <div
            v-else-if="error"
            class="q-my-lg"
          >
            <q-banner
              inline-actions
              class="text-dark bg-grey-5"
            >
              <template #avatar>
                <q-icon
                  name="signal_wifi_off"
                  color="negative"
                />
              </template>
              <div class="flex">
                <span class="text-bold">{{ $t('error') }}:</span>
              </div>
              <div class="flex">
                <span class="text-caption">{{ error.trace || error.error }}</span>
              </div>
            </q-banner>
          </div>
          <div
            v-else-if="done"
            class="q-my-lg"
          >
            <q-banner
              inline-actions
              class="text-dark bg-grey-5"
            >
              <template #avatar>
                <q-icon
                  name="error"
                  color="primary"
                />
              </template>
              <div class="flex">
                <span class="text-bold">{{ $t('search.no_result_for') }}</span>
              </div>
              <div class="flex">
                <span class="text-caption">{{ currentQuery }}</span>
              </div>
            </q-banner>
          </div>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
