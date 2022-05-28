<script lang="ts" setup>
import { computed, ref, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useSocket } from '../helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { isSearchResult, isTaskDone } from '../helpers/typechecker';
import { setupMirrorFilters, sortLangs, toggleAllLanguages, toggleAllMirrors, toggleLang, toggleMirror } from '../helpers/mirrorFilters';
import SearchResults from './SearchResults.vue';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { SearchResult } from '../../../../api/src/models/types/search';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';

/** current route */
const route = useRoute();
/** stored settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** socket */
let socket:socketClientInstance|undefined;


/** template ref for the search input */
const inputRef = ref<HTMLInputElement | null>(null);
/** search input model */
const query = ref('');
/** last search we actually proceeded */
const currentQuery = ref('');
/** display results */
const display = ref(false);
/** display a loading circle next the the input while processing the request */
const loading = ref(false);
/** query results from the websocket */
const rawResults = ref([] as (SearchResult)[]); // the raw search results
/** sort results A-Z or Z-A */
const sortAZ = ref<boolean>(true); // sort by name (A-Z|Z-A)
/** list of languages available from mirrors */
const allLangs = ref<string[]>([]);
/** language(s) to include in the query and/or results */
const includedLangsRAW = ref<string[]>([]);
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

/** return the ordered list of includedLangsRAW */
const includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
});

/** returns true if all available mirror are included in the filter */
const includedAllMirrors = computed(() => {
  if(includedMirrors.value.length < mirrorsList.value.length) {
    if(includedMirrors.value.length === 0) return false;
    return null;
  }
  return true;
});

/** returns true if all available languages are included in the filter */
const includedAllLanguage = computed(() => {
  if(includedLangsRAW.value.length < allLangs.value.length) {
    if(includedLangsRAW.value.length === 0) return false;
    return null;
  }
  return true;
});

/** include/exclude a mirror from the filter, also affects the language filter */
function pickMirror(mirror:string) {
  toggleMirror(mirror, mirrorsList, includedMirrors, includedLangsRAW);
}

/** include/exclude all mirrors from the filter */
function pickallMirrors() {
  toggleAllMirrors(mirrorsList, includedAllMirrors.value, includedMirrors, includedLangsRAW);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pickLang(lang:string) {
  toggleLang(lang, includedLangsRAW, mirrorsList, includedMirrors);
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
  socket?.emit('stopSearchInMirrors');

  display.value = false;
  currentQuery.value = query.value;
  rawResults.value = [];
  /** helper to keep track of on going query */
  const task = { id: Date.now(), dones: 0, nbOfDonesToExpect: 0 };

  socket?.emit(
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
      display.value = true;
      loading.value = true;

      socket?.on('searchInMirrors', (id, res) => {
        if(id === task.id) {
          if(res && isSearchResult(res)) rawResults.value.push(res);
          else if(res && isTaskDone(res)) {
            // mirror sent us a 'done' message
            task.dones++;
            if(task.dones === task.nbOfDonesToExpect) {
              // if all mirrors have responded, we can stop listening and stop the loading animation
              socket?.off('searchInMirrors');
              loading.value = false;
            }
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
    setupMirrorFilters(mirrors, mirrorsList, includedLangsRAW, allLangs, includedMirrors);
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
  <q-card class="w-100">
    <q-card-section class="row items-center">
      <div class="col-xs-12 col-sm-4 offset-sm-4 col-md-6 offset-md-3 text-center">
        <q-input
          ref="inputRef"
          v-model="query"
          type="text"
          :placeholder="$t('search.placeholder')"
          outlined
          clearable
          autofocus
          color="white"
          :loading="loading"
          @keyup.enter="research"
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
      </div>
      <div class="col-12 q-mt-md text-center">
        <q-btn-group>
          <q-btn
            :ripple="false"
            color="white"
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
            :text-color="includedAllMirrors ? 'white' : 'orange'"
            icon="bookmarks"
            size="1em"
          >
            <q-list>
              <q-item
                dense
                clickable
                @click="pickallMirrors"
              >
                <q-checkbox
                  v-model="includedAllMirrors"
                  size="32px"
                  color="primary"
                  toggle-indeterminate
                  class="q-ma-none q-pa-none"
                  @click="pickallMirrors"
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
                @click="pickMirror(mirror.name)"
              >
                <q-checkbox
                  v-model="includedMirrors"
                  size="32px"
                  color="orange"
                  :val="mirror.name"
                  class="q-ma-none q-pa-none"
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
            <q-list>
              <q-item
                dense
                clickable
                @click="pickAllLangs"
              >
                <q-checkbox
                  v-model="includedAllLanguage"
                  size="32px"
                  color="primary"
                  class="q-ma-none q-pa-none"
                  toggle-indeterminate
                  @click="pickAllLangs"
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
                @click="pickLang(lang)"
              >
                <q-checkbox
                  :model-value="includedLangs"
                  size="32px"
                  color="orange"
                  :val="lang"
                  class="q-ma-none q-pa-none"
                  @update:model-value="pickLang(lang)"
                />
                <q-item-section class="q-ma-none">
                  {{ $t('languages.'+lang+'.value') }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </q-btn-group>
      </div>
    </q-card-section>
    <q-card-section v-if="results.length">
      <search-results
        :results="results"
      />
    </q-card-section>
  </q-card>
</template>
