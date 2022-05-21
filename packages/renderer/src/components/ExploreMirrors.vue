<script lang="ts" setup>
import { ref, computed, onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket } from './helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { applyAllFilters, setupMirrorFilters, sortLangs, sortMirrorByNames, toggleAllLanguages, toggleLang } from './helpers/mirrorFilters';
import type { socketClientInstance } from '../../../api/src/client/types';
import type { mirrorInfo } from '../../../api/src/models/types/shared';

const router = useRouter();
/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** quasar */
const $q = useQuasar();

/** search filter */
const query = ref<string|null>('');
/** sort ascending/descending sorting */
const sortAZ = ref(true);
/** list of languages available from mirrors */
const allLangs = ref<string[]>([]);
/** language(s) to include in the  results */
const includedLangsRAW = ref<string[]>([]);
/** Mirrors info as retrieved from the server */
const mirrorsRAW = ref<mirrorInfo[]>([]);

const mirrors = computed(() => {
  return sortMirrorByNames(applyAllFilters(mirrorsRAW.value, query.value, includedLangs.value), sortAZ.value);
});

/** return the ordered list of includedLangsRAW */
const includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
});

/** returns true if all available languages are included in the filter */
const includedAllLanguage = computed(() => {
  if(includedLangsRAW.value.length < allLangs.value.length) {
    if(includedLangsRAW.value.length === 0) return false;
    return null;
  }
  return true;
});

function pickall() {
  return toggleAllLanguages(includedAllLanguage.value, allLangs.value, includedLangsRAW);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pick(lang:string) {
  return toggleLang(lang, includedLangsRAW);
}


// get available mirrors before rendering and start the search if params are present
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', false, (m) => {
    setupMirrorFilters(m, mirrorsRAW, includedLangsRAW, allLangs);
  });
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
          :placeholder="$t('explore.placeholder.value')"
          outlined
          clearable
          autofocus
          color="white"
        >
          <template
            #append
          >
            <q-icon
              v-if="!query"
              :name="'search'"
              style="cursor:pointer"
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
            icon="translate"
            size="1em"
          >
            <q-list>
              <q-item
                dense
                clickable
                @click="pickall"
              >
                <q-checkbox
                  v-model="includedAllLanguage"
                  size="32px"
                  color="primary"
                  class="q-ma-none q-pa-none"
                  toggle-indeterminate
                  @click="pickall"
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
                  {{ $t('search.all.value') }}
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="lang in allLangs"
                :key="lang"
                clickable
                @click="pick(lang)"
              >
                <q-checkbox
                  v-model="includedLangs"
                  size="32px"
                  color="orange"
                  :val="lang"
                  class="q-ma-none q-pa-none"
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
    <q-card-section>
      <q-list
        class="w-100 q-mt-md q-pa-lg"
        separator
        :dark="settings.theme === 'dark'"
      >
        <q-item
          v-for="mirror in mirrors"
          :key="mirror.name"
          v-ripple
          clickable
          class="q-mx-md"
          :dark="settings.theme.includes('dark')"
          @click="router.push({
            name: 'explore_mirror',
            params: {
              mirror: mirror.name,
            },
          })"
        >
          <q-item-section avatar>
            <q-icon
              color="primary"
              :name="'img:'+mirror.icon"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ mirror.displayName }}</q-item-label>
            <q-item-label
              caption
              lines="2"
            >
              <div>
                {{ mirror.host }}
              </div>
              <div class="flex q-mt-xs">
                <q-chip
                  v-for="lang in mirror.langs"
                  :key="lang"
                  dense
                  size="sm"
                  color="orange"
                >
                  {{ $t(`languages.${lang}.value`) }}
                </q-chip>
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section
            v-if="$q.screen.gt.xs"
            side
          >
            <div
              class="row items-center"
            >
              <div class="col q-px-md text-caption">
                {{ $t('explore.meta.quality.value') }}
              </div>
              <div class="col">
                <q-linear-progress
                  :value="mirror.meta.quality"
                  color="accent"
                  style="width:40px;height:6px;"
                  rounded
                  :dark="settings.theme === 'dark'"
                />
              </div>
            </div>
            <div
              class="row items-center"
            >
              <div class="col q-px-md text-caption">
                {{ $t('explore.meta.speed.value') }}
              </div>
              <q-linear-progress
                :value="mirror.meta.speed"
                color="warning"
                style="width:40px;height:6px;"
                rounded
                :dark="settings.theme === 'dark'"
              />
            </div>
            <div class="row items-center">
              <div class="col q-px-md text-caption">
                {{ $t('explore.meta.popularity.value') }}
              </div>
              <q-linear-progress
                :value="mirror.meta.popularity"
                color="info"
                style="width:40px;height:6px;"
                rounded
                :dark="settings.theme === 'dark'"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<style lang="css" scoped>

.q-item__section--main ~ .q-item__section--side {
  padding-left: 0;
}
</style>
