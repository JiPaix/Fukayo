<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { useI18n } from 'vue-i18n';
import 'animate.css';
import type { sock } from '../socketClient';
import type { SearchResult } from '../../../api/src/mirrors/types/search';
import type { SearchErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import countryFlag from './countryFlag.vue';

const props = defineProps<{
  socket: sock
}>();

const $t = useI18n().t.bind(useI18n());
const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

const query = ref('');
const currentQuery = ref('');
const display = ref(false);
const rawResults = ref([] as (SearchResult)[]);
const includedMirrors = ref<string[]>([]);
const sortAZ = ref<boolean>(true);



const mirrorsList = ref([] as {
  name: string;
  displayName: string;
  host: string;
  enabled: boolean;
  icon: string;
  langs: string[];
}[]);

const includedLangs = ref<string[]>([]);
const allLangs = ref<string[]>([]);
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
function isSearchResult(res: SearchResult | SearchErrorMessage): res is SearchResult {
  return (res as SearchResult).link !== undefined;
}

// trigger search
function research() {
  display.value = false;
  if(!query.value || query.value.length < 3) return;
  props.socket.emit('stopSearchInMirrors'); // stop previous search
  currentQuery.value = query.value;
  rawResults.value = [];
  const now = Date.now();
  props.socket.emit('searchInMirrors', query.value, now, includedMirrors.value, includedLangs.value);
  display.value = true;
  const listener = (id:number, res?:SearchResult | SearchErrorMessage) => {
    if(id === now) {

      if(res && isSearchResult(res)) rawResults.value.push(res);
    }
  };
  props.socket.on('searchInMirrors', listener);
}

// computed search results (just adds mirrorinfo to each result)
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
    if(sortAZ.value) {
        if(a.name < b.name) return -1;
        return 0;
    } else {
        if(a.name > b.name) return -1;
        return 0;
    }
  });
});

const includedAllMirrors = computed(() => {
  if(includedMirrors.value.length < mirrorsList.value.length) {
    if(includedMirrors.value.length === 0) return false;
    return null;
  }
  return true;
});

const toggleAllMirrors = () => {
  if(includedAllMirrors.value) {
    includedMirrors.value = [];
  } else {
    includedMirrors.value = mirrorsList.value.map(m => m.name);
  }
};

const toggleMirror = (mirror:string) => {
  if(includedMirrors.value.some(m => m === mirror)) {
    includedMirrors.value = includedMirrors.value.filter(m => m !== mirror);
  } else {
    includedMirrors.value.push(mirror);
  }
};

const langsInIncludedMirrors = computed(() => {
  const langs = new Set<string>();
  mirrorsList.value.forEach(m => {
    if(includedMirrors.value.includes(m.name)) {
      m.langs.forEach(l => {
        langs.add(l);
      });
    }
  });
  return Array.from(langs);
});

const includedAllLanguage = computed(() => {
  if(includedLangs.value.length < allLangs.value.length) {
    if(includedLangs.value.length === 0) return false;
    return null;
  }
  return true;
});

const toggleAllLanguages = () => {
  if(includedAllLanguage.value) {
    includedLangs.value = [];
  } else {
    includedLangs.value = allLangs.value;
  }
};

const toggleLang = (lang:string) => {
  if(includedLangs.value.some(m => m === lang)) {
    includedLangs.value = includedLangs.value.filter(m => m !== lang);
  } else {
    includedLangs.value.push(lang);
  }
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
          size="md"
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
          v-model="query"
          type="text"
          outlined
          :placeholder="$t('searchMangas.placeholder.value')"
          clearable
          color="white"
          :class="rawResults.length ? 'no-r-border' : ''"
          autofocus
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
      </q-card-section>
      <q-card-section class="q-mt-lg">
        <q-btn-group
          outline
          rounded
          class="flex justify-center"
          style="width:100%;"
        >
          <q-avatar
            square
            color="white"
          >
            <q-icon
              name="filter_alt"
              size="24"
              color="orange"
            />
          </q-avatar>
          <q-btn
            outline
            rounded
            color="white"
            :icon="sortAZ ? 'text_rotation_angleup' : 'text_rotation_angledown'"
            @click="sortAZ = !sortAZ"
          />

          <q-btn-dropdown
            outline
            color="white"
            :label="$t('searchMangas.mirrorLabel.value')"
            :icon="includedMirrors.length === mirrorsList.length ? 'bookmark_added' : 'bookmark_remove'"
          >
            <q-list>
              <q-item
                dense
                clickable
                @click="toggleAllMirrors"
              >
                <q-checkbox
                  v-model="includedAllMirrors"
                  color="primary"
                  toggle-indeterminate
                  @click="toggleAllMirrors"
                />
                <q-item-section class="q-ml-sm text-uppercase">
                  {{ !includedAllMirrors ? $t('searchMangas.selectAll.value') : $t('searchMangas.unselectAll.value') }}
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
                  class="q-pr-none"
                  style="min-width: 40px;"
                >
                  <q-avatar

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
            outline
            color="white"
            :label="$t('searchMangas.languageLabel.value')"
            icon="translate"
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
                <q-item-section class="q-ml-sm text-uppercase">
                  {{ !includedAllLanguage ? $t('searchMangas.selectAll.value') : $t('searchMangas.unselectAll.value') }}
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
                <q-item-section>
                  <countryFlag
                    class="q-ml-auto q-mr-auto"
                    :country="lang"
                    size="40px"
                    showname
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </q-btn-group>
      </q-card-section>
      <q-card-section>
        {{ langsInIncludedMirrors }}
      </q-card-section>
      <q-card-section>
        <q-virtual-scroll
          style="max-height: 100%;"
          :items="results"
          separator
        >
          <template #default="{item}">
            <q-card
              v-ripple
              class="q-ma-md row"
              style="cursor:pointer;height: 150px!important;overflow: hidden;"
            >
              <div class="flex">
                <q-img
                  :src="item.cover"
                  fit="scale-down"
                  style="width: 100px;height: 150px;"
                />
              </div>
              <div class="col">
                <div class="q-ml-sm">
                  <span class="text-h6">
                    {{ item.name }}
                    <q-avatar size="16px">
                      <img
                        :src="item.mirrorinfo.icon"
                        small
                      >
                      <q-tooltip
                        anchor="top right"
                        self="center middle"
                      >
                        {{ item.mirror }}
                      </q-tooltip>
                    </q-avatar>
                    <q-avatar size="18px">
                      <countryFlag
                        :country="item.lang"
                        size="16px"
                      />
                    </q-avatar>

                  </span>

                  <div v-if="item.last_release">
                    <q-chip
                      v-if="item.last_release.volume !== undefined"
                      color="teal"
                      dense
                    >
                      {{ $t('mangas.volume.value') }}: {{ item.last_release.volume }}
                    </q-chip>
                    <q-chip
                      v-if="item.last_release.chapter !== undefined"
                      color="teal"
                      dense
                    >
                      {{ $t('mangas.chapter.value') }}: {{ item.last_release.chapter }}
                    </q-chip>
                    <q-chip
                      v-if="item.last_release.name !== undefined"
                      color="teal"
                      dense
                    >
                      {{ $t('mangas.chaptername.value') }}: {{ item.last_release.name }}
                    </q-chip>
                  </div>


                  <div class="caption q-mt-md ellipsis-3-lines q-pr-lg">
                    {{ item.synopsis }}
                  </div>
                </div>
              </div>
            </q-card>
          </template>
        </q-virtual-scroll>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
