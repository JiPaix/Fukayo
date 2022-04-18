<script lang="ts" setup>
import { computed, onMounted, ref, onBeforeUnmount } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import 'animate.css';
import 'flag-icons';
import type { sock } from '../socketClient';
import type { SearchResult } from '../../../api/src/mirrors/types/search';
import type { SearchErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import type { TaskDone } from '../../../api/src/mirrors/types/shared';
import searchMangasInfiniteScroll from './searchMangasInfiniteScroll.vue';

const props = defineProps<{
  socket: sock
}>();

const $q = useQuasar();
const $t = useI18n().t.bind(useI18n());
const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

// related to the search query
const inputRef = ref<HTMLInputElement | null>(null) // ref to the input element
const query = ref(''); // what's currently in the search input
const currentQuery = ref(''); // what's been searched
const display = ref(false); // whether the search results are displayed
const loading = ref(false); // whether the search is in progress
const rawResults = ref([] as (SearchResult)[]); // the raw search results

// filters: filter can be applied before a search is made to limit the amount of queries the server has to do
const includedMirrors = ref<string[]>([]); // mirrors to include in the search
const sortAZ = ref<boolean>(true); // sort by name (A-Z|Z-A)
const includedLangs = ref<string[]>([]); // languages to include


// before mouting we get available mirrors and languages
const allLangs = ref<string[]>([]);
const mirrorsList = ref([] as {
  name: string;
  displayName: string;
  host: string;
  enabled: boolean;
  icon: string;
  langs: string[];
}[]);

onMounted(() => {
  props.socket.emit('getMirrors', (mirrors) => {
    mirrorsList.value = mirrors;
    includedMirrors.value = mirrors.map(m => m.name);
    includedLangs.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));
    allLangs.value = includedLangs.value;
  });

});

// when search page is closed we send a message to the server to stop the search
onBeforeUnmount(() => {
  props.socket.emit('stopSearchInMirrors');
});

// Typescript hack to differentiate between searchResults and searchErrorMessages
function isSearchResult(res: SearchResult | SearchErrorMessage | TaskDone): res is SearchResult {
  return (res as SearchResult).link !== undefined;
}

function isTaskDone(res: SearchResult | SearchErrorMessage | TaskDone): res is TaskDone {
  return (res as TaskDone).done !== undefined;
}

// trigger search
function research() {
  if(!query.value || query.value.length < 3) return;
  if(query.value === currentQuery.value) return;
  if(inputRef.value && $q.platform.has.touch) inputRef.value.blur(); // blur the input to hide the keyboard
  display.value = false;
  props.socket.emit('stopSearchInMirrors'); // stop previous search
  currentQuery.value = query.value;
  rawResults.value = [];

  const task = { id: Date.now(), dones: 0, nbOfDonesToExpect: 0 };
  const listener = (id:number, res?:SearchResult | SearchErrorMessage | TaskDone) => {
    if(id === task.id) {
      if(res && isSearchResult(res)) rawResults.value.push(res);
      else if(res && isTaskDone(res)) {
        task.dones++;
         if(task.dones === task.nbOfDonesToExpect) {
           props.socket.off('searchInMirrors', listener);
           loading.value = false;
         }
      }
    }
  };

  props.socket.emit('searchInMirrors', query.value, task.id, includedMirrors.value, includedLangs.value, (nbOfDonesToExpect) => {
    task.nbOfDonesToExpect = nbOfDonesToExpect;
    display.value = true;
    loading.value = true;
    props.socket.on('searchInMirrors', listener);
  });

}

// computed search results (it just adds mirrorinfo to each result)
const results = computed(() => {
  return rawResults.value.map(r => {
    const mirrorinfo = mirrorsList.value.find(m => m.name === r.mirror);
    if(!mirrorinfo) throw Error('mirrorinfo not found');
      return {
        ...r,
        mirrorinfo,
      };
  })
  .filter(r => includedMirrors.value.includes(r.mirrorinfo.name))
  .filter(r => includedLangs.value.some(l => r.mirrorinfo.langs.includes(l)))
  .sort((a,b) => {
    if(sortAZ.value) return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });
});

// are all mirrors included in the filter list?
const includedAllMirrors = computed(() => {
  if(includedMirrors.value.length < mirrorsList.value.length) {
    if(includedMirrors.value.length === 0) return false;
    return null;
  }
  return true;
});

// include all mirrors in the filter list
const toggleAllMirrors = () => {
  if(includedAllMirrors.value) {
    mirrorsList.value.forEach(m => {
      if(includedMirrors.value.includes(m.name)) toggleMirror(m.name);
    });
  } else {
    mirrorsList.value.forEach(m => {
      if(!includedMirrors.value.includes(m.name)) toggleMirror(m.name);
    });
  }
};

// include/exclude a mirror in the filter list
const toggleMirror = (mirror:string) => {
  if(includedMirrors.value.some(m => m === mirror)) {
    includedMirrors.value = includedMirrors.value.filter(m => m !== mirror);
  } else {
    includedMirrors.value.push(mirror);
  }

  const mirrors = mirrorsList.value.filter(m => includedMirrors.value.includes(m.name));
  includedLangs.value = Array.from(new Set(mirrors.map(m => m.langs).flat()));

};

// are all langs included in the filter list?
const includedAllLanguage = computed(() => {
  if(includedLangs.value.length < allLangs.value.length) {
    if(includedLangs.value.length === 0) return false;
    return null;
  }
  return true;
});

// include all langs in the filter list
const toggleAllLanguages = () => {

  if(includedAllLanguage.value) {
    allLangs.value.forEach(l => {
      if(includedLangs.value.includes(l)) toggleLang(l);
    });
  } else {
    allLangs.value.forEach(l => {

      if(!includedLangs.value.includes(l)) toggleLang(l);
    });
  }
};

// include/exclude a lang in the filter list
// exclude mirrors with matching langs
const toggleLang = (lang:string) => {
  if(includedLangs.value.some(m => m === lang)) {
    includedLangs.value = includedLangs.value.filter(m => m !== lang);
  } else {
    includedLangs.value.push(lang);
  }

  // only include mirrors which support at least one of the included langs
  includedMirrors.value = mirrorsList.value.filter(m => {
    return includedLangs.value.some(l => m.langs.includes(l));
  }).map(m => m.name);
};
</script>
<template>
  <q-dialog
    ref="dialogRef"
    maximized
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin">
      <q-card-section class="flex">
        <q-btn
          size="1em"
          round
          outline
          icon="close"
          color="orange"
          class="q-ml-auto"
          @click="onDialogCancel"
        />
      </q-card-section>
      <q-card-section>
        <q-input
          ref="inputRef"
          v-model="query"
          type="text"
          outlined
          :placeholder="$t('searchMangas.placeholder.value')"
          clearable
          color="white"
          :class="rawResults.length ? 'no-r-border' : ''"
          autofocus
          @keyup.enter="research"
          :loading="loading"
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
      </q-card-section>
      <q-card-section class="flex q-mt-lg justify-center">
        <q-btn-group
          rounded
        >
          <q-btn
            :ripple="false"
            color="white"
            text-color="orange"
            rounded
            icon="filter_alt"
            style="cursor:default!important;"
            size="1em"
          />
          <q-btn
            rounded

            :icon="sortAZ ? 'text_rotation_angleup' : 'text_rotation_angledown'"
            @click="sortAZ = !sortAZ"
            size="1em"
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
                @click="toggleAllMirrors"
              >
                <q-checkbox
                  v-model="includedAllMirrors"
                  color="orange"
                  toggle-indeterminate
                  @click="toggleAllMirrors"
                  class="q-ma-none q-pa-none"
                />
                <q-item-section
                  avatar
                  class="q-ml-sm"
                >
                  <q-avatar
                    size="46px"
                    text-color="primary"
                    icon="bookmarks"
                  />
                </q-item-section>
                <q-item-section class="text-uppercase text-bold">
                  {{ $t('searchMangas.all.value')}}
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="mirror in mirrorsList"
                :key="mirror.name"
                clickable
                @click="toggleMirror(mirror.name)"
              >
                <q-checkbox
                  v-model="includedMirrors"
                  color="orange"
                  :val="mirror.name"
                  class="q-ma-none q-pa-none"
                />
                <q-item-section
                  avatar
                  class="q-ml-sm"
                >
                  <q-avatar

                    :icon="'img:'+mirror.icon"
                  />
                </q-item-section>
                <q-item-section>
                  {{ mirror.displayName }} {{
                    rawResults.filter(r=> r.mirror === mirror.name).length ?
                    '('+rawResults.filter(r=> r.mirror === mirror.name).length+')' : ''
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
                @click="toggleAllLanguages"
              >
                <q-checkbox
                  v-model="includedAllLanguage"
                  color="primary"
                  toggle-indeterminate
                  @click="toggleAllLanguages"
                />
                <q-item-section class="q-ml-sm">
                <q-icon
                  name="language"
                  size="24px"
                  color="primary"
                >
                </q-icon>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="lang in allLangs"
                :key="lang"
                clickable
                @click="toggleLang(lang)"
              >
                <q-checkbox
                  v-model="includedLangs"
                  color="orange"
                  :val="lang"
                  class="q-ma-none q-pa-none"
                />
                <q-item-section class="q-ml-sm">
                <div class="fi" :class="'fi-'+$t('languages.'+lang+'.flag')" style="width:24px;" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </q-btn-group>
      </q-card-section>
      <q-card-section>
      <searchMangasInfiniteScroll :results="results" :loading="loading"/>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
