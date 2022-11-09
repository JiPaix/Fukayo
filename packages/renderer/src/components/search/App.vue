<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { SearchErrorMessage } from '@api/models/types/errors';
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import GroupCard from '@renderer/components/explore/GroupCard.vue';
import { setupMirrorFilters, sortLangs, toggleAllLanguages, toggleAllMirrors, toggleLang, toggleMirror } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isSearchResult, isTaskDone } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

/** current route */
const route = useRoute();
/** stored settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();
/** vue-i18n */
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
/** socket */
let socket:socketClientInstance|undefined;


/** template ref for the search input */
const inputRef = ref<HTMLInputElement | null>(null);
/** search input model */
const query = ref('');
/** last search we actually proceeded */
const currentQuery = ref('');
/** display a loading circle next the the input while processing the request */
const loading = ref(false);
/** search errored */
const error = ref<null|SearchErrorMessage>(null);
/** query results from the websocket */
const rawResults = ref([] as (SearchResult)[]); // the raw search results
/** all the results been fetched  */
const done = ref(false);
/** sort results A-Z or Z-A */
const sortAZ = ref<boolean>(true); // sort by name (A-Z|Z-A)
/** list of languages available from mirrors */
const allLangs = ref<mirrorsLangsType[]>([]);
/** language(s) to include in the query and/or results */
const includedLangsRAW = ref<mirrorsLangsType[]>([]);
/** list of available mirrors */
const mirrorsList = ref<mirrorInfo[]>([]);
/** mirror(s) to include in the query and/or results */
const includedMirrors = ref<string[]>([]);

/** search results filtered and sorted */
const results = computed(() => {
  return rawResults.value.map<SearchResult>(r => {
    const mirrorinfo = mirrorsList.value.find(m => m.name === r.mirrorinfo.name);
    if(!mirrorinfo) throw Error($t('search.not_found', { sourceWord: $t('mangas.source'), websitename: r.mirrorinfo.name }));
      return {
        ...r,
        mirrorinfo,
      };
  })
  .filter(r => includedMirrors.value.includes(r.mirrorinfo.name))
  .filter(r => includedLangsRAW.value.some(l => r.mirrorinfo.langs.includes(l)))
  .sort((a,b) => {
    if(sortAZ.value) return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });
});

const mangaGroups = computed(() => {
return results.value.map(r => {
    return {
      name: r.name,
      manga: r,
      covers: r.covers,
    };
  });
});

/** return the ordered list of includedLangsRAW */
const includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
});

/** returns true if all available mirror are included in the filter */
const includedAllMirrors = computed({
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
});

/** returns true if all available languages are included in the filter */
const includedAllLanguage = computed({
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

/** include/exclude a mirror from the filter, also affects the language filter */
function pickMirror(mirror:string) {
  toggleMirror(mirror, mirrorsList.value, includedMirrors, includedLangsRAW, settings.i18n.ignored);
}

/** include/exclude all mirrors from the filter */
function pickallMirrors() {
  toggleAllMirrors(mirrorsList.value, includedAllMirrors.value, includedMirrors, includedLangsRAW);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pickLang(lang:mirrorsLangsType) {
  toggleLang(lang, includedLangsRAW, mirrorsList.value, includedMirrors, settings.i18n.ignored);
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

  if(!socket) socket = await useSocket(settings.server);
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

      socket?.on('searchInMirrors', (id, res) => {
        if(id === task.id) {
          if(Array.isArray(res)){
            res.forEach(ele => {
              if(res && isSearchResult(ele)) rawResults.value.push({...ele, covers: ele.covers.map(c => transformIMGurl(c, settings))});
              else if(res && isTaskDone(ele)) {
                // mirror sent us a 'done' message
                task.dones++;
                if(task.dones === task.nbOfDonesToExpect) {
                  // if all mirrors have responded, we can stop listening and stop the loading animation
                  socket?.off('searchInMirrors');
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
              socket?.off('searchInMirrors');
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

// get available mirrors before rendering and start the search if params are present
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  const queryParam = route.query.q as string;
  socket?.emit('getMirrors', false, (mirrors) => {
    setupMirrorFilters(mirrors, mirrorsList, includedLangsRAW, allLangs, includedMirrors, settings.i18n.ignored);
    if(queryParam) {
      query.value = queryParam;
      research();
    }
  });
});

// prevent websocket server to keep searching after unmounting
onBeforeUnmount(async () => {
  if(socket) socket.emit('stopSearchInMirrors');
});
</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-50)+'px'"
    class="shadow-2"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-footer class="bg-dark">
      <q-linear-progress
        v-if="loading"
        size="4px"
        color="orange"
        animation-speed="500"
        indeterminate
      />
    </q-footer>
    <q-page-container>
      <q-page
        v-if="error && !rawResults.length"
        class="q-pa-md"
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
      </q-page>
      <q-page
        v-else
        class="q-pa-md"
      >
        <q-form
          class="text-center"
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
              val => (val !== null && val !== '') || 'Please type something',
              val => (val && val.length > 3) || 'Not enought characters',
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
        </q-form>
        <div class="flex flex-center">
          <group-card
            v-for="(group, i) in mangaGroups"
            :key="i"
            :group="group.manga"
            :group-name="group.name"
            :mirror="group.manga.mirrorinfo"
            :hide-langs="settings.i18n.ignored"
            :covers="group.covers"
            class="q-my-lg"
          />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
