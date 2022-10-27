<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { mirrorInfo } from '@api/models/types/shared';
import type en from '@i18n/../locales/en.json';
import type { appLangsType } from '@i18n/index';
import { applyAllFilters, sortLangs, sortMirrorByNames } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
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
const mirrorsRAW = ref<Array<mirrorInfo & { isLoggedIn?: boolean }>>([]);

const mirrors = computed(() => {
  return sortMirrorByNames(applyAllFilters(mirrorsRAW.value, query.value, includedLangs.value), sortAZ.value) as Array<mirrorInfo & { isLoggedIn?: boolean }>;
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
  if(value === '') value = null;
  if(typeof value === 'string' && property === 'port') {
    const toNb = parseInt(value);
    if(!isNaN(toNb)) value = toNb;
  }
  socket?.emit('changeMirrorSettings', mirrorName, { [property]: value }, (sources) => {
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

function optionLabel(propertyName:string) {

  switch (propertyName) {
    case 'enabled':
      return $t('settings.source.enabled');
    case 'cache':
      return $t('settings.cache');
    case 'adult':
      return $t('settings.source.adult');
    case 'markAsRead':
      return $t('settings.source.markAsRead');
    case 'login':
      return $t('setup.login');
    case 'password':
      return $t('setup.password');
    case 'host':
      return $t('settings.source.host');
    case 'port':
      return $t('setup.port');
    case 'protocol':
      return $t('settings.source.protocol');
    case 'dataSaver':
      return $t('settings.source.dataSaver');
    case 'excludedGroups':
      return $t('settings.source.excludedGroups');
      case 'excludedUploaders':
      return $t('settings.source.excludedUploaders');
    default:
      return `"${propertyName}"`;
  }
}

function omit<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

function asTypeOrUndefined<T>(value: T): T|undefined {
  if(value) return value;
  return undefined;
}

function isValidUUI(ids:string[]) {
  let res = true;
  ids.forEach(i => {
    if(!i.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/)) res = false;
  });
  return res;
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
    mirrorsRAW.value = m.map(m => { return {...m, isLoggedIn: false}; }).sort((a, b) => a.name.localeCompare(b.name));
    includedLangsRAW.value = Array.from(new Set(m.map(m => m.langs).flat()));
    allLangs.value = includedLangsRAW.value;
  });
});
</script>
<template>
  <q-card
    class="w-100"
    flat
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? 'bg-dark': 'bg-grey-2'"
  >
    <q-card-section
      class="row items-center"
    >
      <div class="col-xs-12 col-sm-4 offset-sm-4 col-md-6 offset-md-3 text-center">
        <q-input
          ref="inputRef"
          v-model="query"
          name="search"
          type="search"
          autocomplete="off"
          :placeholder="$t('explore.placeholder')"
          outlined
          clearable
          autofocus
          :color="$q.dark.isActive ? 'white' : 'primary'"
          :dark="$q.dark.isActive"
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
        <q-btn-group
          :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
        >
          <q-btn
            :ripple="false"
            :color="$q.dark.isActive ? 'white' : 'dark'"
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
            <q-list
              :dark="$q.dark.isActive"
              :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
            >
              <q-item
                dense
                clickable
                :dark="$q.dark.isActive"
                @click="toggleAllLanguages"
              >
                <q-checkbox
                  v-model="includedAllLanguage"
                  size="32px"
                  color="primary"
                  class="q-ma-none q-pa-none"
                  toggle-indeterminate
                  :dark="$q.dark.isActive"
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
                  {{ $t('search.all') }}
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="lang in allLangs"
                :key="lang"
                clickable
                :dark="$q.dark.isActive"
                @click="toggleLang(lang)"
              >
                <q-checkbox
                  v-model="includedLangs"
                  size="32px"
                  color="orange"
                  :val="lang"
                  class="q-ma-none q-pa-none"
                  :dark="$q.dark.isActive"
                />
                <q-item-section class="q-ma-none">
                  {{ $t('languages.'+lang) }}
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
          :dark="$q.dark.isActive"
          separator
        >
          <q-expansion-item
            v-for="mirror in mirrors"
            :key="mirror.name"
            group="sources"
            :icon="'img:'+mirror.icon"
            :label="mirror.displayName"
            class="shadow-2"
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
          >
            <q-list
              separator
              :dark="$q.dark.isActive"
            >
              <!-- Customized Enable -->
              <q-item
                class="flex items-center"
                clickable
                :dark="$q.dark.isActive"
                style="background:rgba(255, 255, 255, 0.3)"
                :class="$q.dark.isActive ? '' : 'bg-white'"
                @click="changeOption(mirror.name, 'enabled', !mirror.options.enabled)"
              >
                <q-item-section>
                  <q-item-label>
                    {{ optionLabel('enabled') }}
                  </q-item-label>
                </q-item-section>
                <q-item-section
                  side
                >
                  <q-toggle
                    :color="toggleButtonColor('enabled')"
                    :checked-icon="toggleButtonIconChecked('enabled')"
                    :unchecked-icon="toggleButtonIconUnchecked('enabled')"
                    :model-value="mirror.options.enabled"
                    size="lg"
                    :dark="$q.dark.isActive"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'enabled', v)"
                  />
                </q-item-section>
              </q-item>
              <!-- We exclude some properties so we can customize them -->
              <div
                v-for="(value, propertyName) in omit(mirror.options, ['enabled', 'login', 'password', 'host', 'port', 'protocol', 'excludedGroups', 'excludedUploaders'])"
                :key="propertyName"
              >
                <q-item
                  class="flex items-center"
                  :clickable="typeof value === 'boolean'"
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                  @click="typeof value === 'boolean' ? changeOption(mirror.name, propertyName, !value) : null"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel(propertyName) }}
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
                      :dark="$q.dark.isActive"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
                    />
                  </q-item-section>
                  <q-item-section
                    v-if="typeof value === 'string' || typeof value === 'number'"
                    side
                  >
                    <q-input
                      :debounce="500"
                      :type="typeof value === 'number' ? 'number' : 'text'"
                      dense
                      :model-value="value"
                      :dark="$q.dark.isActive"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
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
              <!-- Customized Login -->
              <div v-if="mirror.options.hasOwnProperty('login')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('login') }}
                    </q-item-label>
                  </q-item-section>
                  <q-input
                    type="text"
                    dense
                    :debounce="500"
                    :model-value="asTypeOrUndefined(mirror.options.login as string) || ''"
                    :dark="$q.dark.isActive"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'login', v)"
                  />
                </q-item>
              </div>
              <!-- Customized Password -->
              <div v-if="mirror.options.hasOwnProperty('password')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('password') }}
                    </q-item-label>
                  </q-item-section>
                  <q-input
                    type="password"
                    dense
                    :debounce="500"
                    :model-value="asTypeOrUndefined(mirror.options.password as string) || ''"
                    :dark="$q.dark.isActive"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'password', v)"
                  />
                </q-item>
              </div>
              <!-- Customized host -->
              <div v-if="mirror.options.hasOwnProperty('host')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('host') }}
                    </q-item-label>
                  </q-item-section>
                  <q-input
                    type="text"
                    dense
                    :debounce="500"
                    :model-value="asTypeOrUndefined(mirror.options.host as string) || ''"
                    :dark="$q.dark.isActive"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'host', v)"
                  />
                </q-item>
              </div>
              <!-- Customized port -->
              <div v-if="mirror.options.hasOwnProperty('port')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('port') }}
                    </q-item-label>
                  </q-item-section>
                  <q-input
                    type="number"
                    dense
                    :debounce="500"
                    :model-value="asTypeOrUndefined(mirror.options.port as number) || 8080"
                    :dark="$q.dark.isActive"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'port', v)"
                  />
                </q-item>
              </div>
              <!-- Customized protocol -->
              <div v-if="mirror.options.hasOwnProperty('protocol')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('protocol') }}
                    </q-item-label>
                  </q-item-section>
                  <q-select
                    dense
                    :model-value="asTypeOrUndefined(mirror.options.protocol as string) || 'http'"
                    :dark="$q.dark.isActive"
                    :options="['http', 'https']"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'protocol', v)"
                  />
                </q-item>
              </div>
              <!-- Excluded Groups -->
              <div v-if="mirror.options.hasOwnProperty('excludedGroups')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('excludedGroups') }}
                    </q-item-label>
                  </q-item-section>
                  <q-select
                    dense
                    :model-value="mirror.options.excludedGroups"
                    :label="$t('settings.source.excludedGroupsHints')"
                    filled
                    use-input
                    use-chips
                    multiple
                    hide-dropdown-icon
                    input-debounce="0"
                    new-value-mode="add-unique"
                    style="width: 250px"
                    :rules="[ val => isValidUUI(val) || $t('settings.source.validUUID') ]"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'excludedGroups', v)"
                  />
                </q-item>
              </div>
              <!-- Excluded Uploaders -->
              <div v-if="mirror.options.hasOwnProperty('excludedUploaders')">
                <q-item
                  :dark="$q.dark.isActive"
                  style="background:rgba(255, 255, 255, 0.3)"
                  :class="$q.dark.isActive ? '' : 'bg-white'"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ optionLabel('excludedUploaders') }}
                    </q-item-label>
                  </q-item-section>
                  <q-select
                    color="orange"
                    dense
                    :model-value="mirror.options.excludedUploaders"
                    :label="$t('settings.source.excludedGroupsHints')"
                    filled
                    use-input
                    use-chips
                    multiple
                    hide-dropdown-icon
                    input-debounce="0"
                    new-value-mode="add-unique"
                    style="width: 250px"
                    reactive-rules
                    :rules="[ val => isValidUUI(val) || $t('settings.source.validUUID') ]"
                    @update:model-value="(v:unknown) => changeOption(mirror.name, 'excludedUploaders', v)"
                  />
                </q-item>
              </div>
            </q-list>
          </q-expansion-item>
        </q-list>
      </q-infinite-scroll>
    </q-card-section>
  </q-card>
</template>
