<script lang="ts" setup>
import { ref, computed, onBeforeMount } from 'vue';
import { useSocket } from '../helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useI18n } from 'vue-i18n';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';
import { sortLangs, sortMirrorByNames } from '../helpers/mirrorFilters';
import { applyAllFilters } from '../helpers/mirrorFilters';


/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());


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

const includedAllLanguage = computed(() => {
  if(includedLangsRAW.value.length < allLangs.value.length) {
    if(includedLangsRAW.value.length === 0) return false;
    return null;
  }
  return true;
});

const includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
});


function changeOption(mirrorName:string, property:string, value:unknown) {
  socket?.emit('changeSettings', mirrorName, { [property]: value }, (sources) => {
    mirrorsRAW.value = sources;
  });
}

function toggleButtonIconChecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power';
  if(propertyName === 'adult') return 'favorite';
  return '';
}

function toggleButtonIconUnchecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power_off';
  if(propertyName === 'adult') return 'child_friendly';
  return '';
}

function toggleButtonColor(propertyName: string) {
  if(propertyName === 'enabled') return 'positive';
  if(propertyName === 'adult') return 'pink';
  return 'orange';
}

function optionLabel(propertyName:string, value:unknown) {
  let prefix = '';
  let suffix = ' ';
  if(typeof value !== 'boolean' && typeof value !== 'string' && typeof value !== 'number') return propertyName;
  if(typeof value === 'boolean') {
    if(value) prefix += $t('settings.enable.value');
    else prefix += $t('settings.disable.value');
  }
  if(typeof value === 'string' || typeof value === 'number') {
    prefix += $t('settings.change.value');
  }

  if(propertyName === 'enabled') suffix += $t('settings.enabled.value');
  if(propertyName === 'adult') suffix += $t('settings.adult.value');

  return prefix + suffix;
}
/** include/exclude all languages from the filter */
function toggleAllLanguages() {
  if(includedAllLanguage.value) {
    allLangs.value.forEach(l => {
      if(includedLangsRAW.value.includes(l)) toggleLang(l);
    });
  } else {
    allLangs.value.forEach(l => {
      if(!includedLangsRAW.value.includes(l)) toggleLang(l);
    });
  }
}

/** include/exclude a language from the filter, also affects the mirror filter */
function toggleLang(lang:string) {
  if(includedLangsRAW.value.some(m => m === lang)) {
    includedLangsRAW.value = includedLangsRAW.value.filter(m => m !== lang);
  } else {
    includedLangsRAW.value.push(lang);
  }
}

// get available mirrors before rendering and start the search if params are present
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', true, (m) => {
    mirrorsRAW.value = m.sort((a, b) => a.name.localeCompare(b.name));
    includedLangsRAW.value = Array.from(new Set(m.map(m => m.langs).flat()));
    allLangs.value = includedLangsRAW.value;
  });
});
</script>
<template>
  <q-card
    class="w-100"
    flat
  >
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
                @click="toggleAllLanguages"
              >
                <q-checkbox
                  v-model="includedAllLanguage"
                  size="32px"
                  color="primary"
                  class="q-ma-none q-pa-none"
                  toggle-indeterminate
                  @click="toggleAllLanguages"
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
                @click="toggleLang(lang)"
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
      <q-infinite-scroll class="w-100 q-mt-md q-pa-lg">
        <q-list
          :dark="settings.theme === 'dark'"

          separator
        >
          <q-expansion-item
            v-for="mirror in mirrors"
            :key="mirror.name"
            group="sources"
            :icon="'img:'+mirror.icon"
            :label="mirror.displayName"
            class="shadow-2"
            :dark="settings.theme === 'dark'"
          >
            <q-list
              separator
            >
              <div
                v-for="(value, propertyName) in mirror.options"
                :key="propertyName"
              >
                <q-item
                  v-if="propertyName !== 'version'"
                  class="flex items-center"
                  :clickable="typeof value === 'boolean'"
                  :dark="settings.theme === 'dark'"
                  style="background:rgba(255, 255, 255, 0.05)"
                  @click="typeof value === 'boolean' ? changeOption(mirror.name, propertyName, !value) : null"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel(propertyName, value) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    v-if="typeof value === 'boolean'"
                    side
                  >
                    <q-toggle
                      :color="toggleButtonColor(propertyName)"
                      :checked-icon="toggleButtonIconChecked(propertyName)"
                      :unchecked-icon="toggleButtonIconUnchecked(propertyName)"
                      :model-value="value"
                      size="lg"
                      @update:model-value="(v) => changeOption(mirror.name, propertyName, v)"
                    />
                  </q-item-section>
                  <q-item-section
                    v-if="typeof value === 'string' || typeof value === 'number'"
                    side
                  >
                    <q-input
                      :type="typeof value === 'number' ? 'number' : 'text'"
                      dense
                      :model-value="value"
                      @update:model-value="(v) => changeOption(mirror.name, propertyName, v)"
                    >
                      <template #after>
                        <q-btn
                          class="q-mr-sm q-ml-lg"
                          round
                          dense
                          icon="save"
                        />
                      </template>
                    </q-input>
                  </q-item-section>
                </q-item>
              </div>
            </q-list>
          </q-expansion-item>
        </q-list>
      </q-infinite-scroll>
    </q-card-section>
  </q-card>
</template>
