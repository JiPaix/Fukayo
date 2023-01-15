<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { applyAllFilters, sortLangs, sortMirrorByNames } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useStoreSettings } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  stepper?: boolean;
  subHeaderSize?: number
}>();

/** emits */
const emit = defineEmits<{
  (event: 'continue'): void
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** settings store */
settings = useStoreSettings();

// states
const
/** search filter */
query = ref<string|null>(''),
/** sort ascending/descending sorting */
sortAZ = ref(true),
/** list of languages available from mirrors */
allLangs = ref<string[]>([]),
/** language(s) to include in the  results */
includedLangsRAW = ref<string[]>([]),
/** Mirrors info as retrieved from the server */
mirrorsRAW = ref<Array<mirrorInfo>>([]),
/** is user changing credentials? */
modifying = ref<Record<string, boolean>>({ }),
/** div#row height */
rowSize = ref(0);

// computed
const
/** sources sorted by name */
mirrors = computed(() => {
  return sortMirrorByNames(applyAllFilters(mirrorsRAW.value, query.value, includedLangs.value), sortAZ.value) as Array<mirrorInfo>;
}),
/** selected languages */
includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
}),
/** are all languages selected? */
includedAllLanguage = computed(() => {
  if(includedLangsRAW.value.length < allLangs.value.length) {
    if(includedLangsRAW.value.length === 0) return false;
    return null;
  }
  return true;
}),
/** parent's QHeader height */
headerSize = computed(() => {
  return (props.subHeaderSize || 0) + (document.querySelector<HTMLDivElement>('#top-header')?.offsetHeight || 0);
});

/** delete key from record */
function omit<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/** return the value with type `T | undefined` */
function asTypeOrUndefined<T>(value: T): T|undefined {
  if(value) return value;
  return undefined;
}

/** change and save option */
async function changeOption(mirrorName:string, property:string, value:unknown) {
  const socket = await useSocket(settings.server);
  if(value === '') value = null;
  if(typeof value === 'string' && property === 'port') {
    const toNb = parseInt(value);
    if(!isNaN(toNb)) value = toNb;
  }
  if(property === 'login') {
    modifying.value[mirrorName] = true;
  }
  socket.emit('changeMirrorSettings', mirrorName, { [property]: value }, (sources) => {
    mirrorsRAW.value = sources;
  });
}
/** return an icon name given the option's name when setting is true */
function toggleButtonIconChecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power';
  if(propertyName === 'adult') return 'favorite';
  return '';
}

/** return an icon name given the option's name when setting is false */
function toggleButtonIconUnchecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power_off';
  if(propertyName === 'adult') return 'child_friendly';
  return '';
}

/** return a color given the option's name */
function toggleButtonColor(propertyName: string) {
  if(propertyName === 'enabled') return 'positive';
  if(propertyName === 'adult') return 'pink';
  return 'orange';
}

/** return the translated option's name */
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

/** return an icon name depending on the mirror status (online/offline, dead, selfhosted) */
function mirrorStatusIcon(mirror:mirrorInfo) {
  if(mirror.isDead) return { color: 'negative', icon: 'o_broken_image', tooltip: $t('settings.mirror_is_dead')};
  else if(!mirror.isOnline && mirror.selfhosted && mirror.options.host) return { color: 'red', icon: 'o_cloud_off', tooltip: $t('settings.source_is_offline') };
  else if(!mirror.isOnline && mirror.selfhosted) return {color: 'orange', icon: 'o_login', tooltip: $t('settings.source_requires_setup') };
  else if(!mirror.isOnline) return { color: 'negative', icon: 'o_cloud_off', tooltip: $t('settings.source_is_offline') };
  else if(!mirror.enabled) return { color: 'negative', icon: 'not_interested'};
  else return { color: 'positive', icon: 'done'};
}

/** save size of div#row */
function resizeRow() {
  const div = document.querySelector<HTMLDivElement>('#row');
  if(div) rowSize.value = div.offsetHeight;
}

/** get all sources and languages and listen if a mirror gets logged in */
async function On() {
  const socket = await useSocket(settings.server);
  socket.emit('getMirrors', true, (m) => {
    mirrorsRAW.value = m.sort((a, b) => a.name.localeCompare(b.name));
    includedLangsRAW.value = Array.from(new Set(m.map(m => m.langs).flat()));
    allLangs.value = includedLangsRAW.value;
  });
  socket.on('loggedIn', (name, val) => {
    const find = mirrorsRAW.value.find(m => m.name === name);
    if(find) find.loggedIn = val;
    modifying.value[name] = false;
  });
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('loggedIn');
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
    <q-page-container>
      <q-page>
        <q-scroll-area
          :style="{height: `${$q.screen.height-headerSize-5}px`, minHeight: '100px'}"
          :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
          :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
          class="q-pa-lg"
        >
          <div
            id="row"
            class="row items-center q-mb-lg"
          >
            <q-banner
              class="col-12 q-mb-lg"
              :class="$q.dark.isActive ? 'bg-grey-9 text-white': 'bg-grey-3 text-black'"
            >
              <template #avatar>
                <q-icon
                  name="travel_explore"
                />
              </template>
              {{ $t('settings.source.description') }}
              <template #action>
                <q-btn
                  v-if="props.stepper"
                  color="orange"
                  push
                  :label="$t('settings.confirm')"
                  class="q-ml-auto"
                  @click="emit('continue')"
                />
              </template>
            </q-banner>
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
            <q-resize-observer @resize="resizeRow" />
          </div>

          <q-list
            :dark="$q.dark.isActive"
            separator
          >
            <q-expansion-item
              v-for="mirror in mirrors"
              :key="mirror.name"
              :dense="$q.screen.gt.md"
              group="sources"
              :icon="'img:'+mirror.icon"
              :label="mirror.displayName"
              class="shadow-2"
              :dark="$q.dark.isActive"
              :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
            >
              <template #header>
                <div class="flex items-center q-mr-auto">
                  <q-icon
                    :name="'img:'+mirror.icon"
                    size="16px"
                  />
                  <q-icon
                    :name="mirrorStatusIcon(mirror).icon"
                    :color="mirrorStatusIcon(mirror).color"
                    size="16px"
                    class="q-mx-xs"
                  >
                    <q-tooltip v-if="mirrorStatusIcon(mirror).tooltip">
                      {{ mirrorStatusIcon(mirror).tooltip }}
                    </q-tooltip>
                  </q-icon>
                  <span>{{ mirror.displayName }}</span>
                </div>
              </template>
              <q-list
                separator
                :dark="$q.dark.isActive"
                :dense="$q.screen.gt.md"
              >
                <!-- Customized Enable -->
                <q-item
                  :dense="$q.screen.gt.md"
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
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :color="toggleButtonColor('enabled')"
                      :checked-icon="toggleButtonIconChecked('enabled')"
                      :unchecked-icon="toggleButtonIconUnchecked('enabled')"
                      :model-value="mirror.options.enabled"
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
                    :dense="$q.screen.gt.md"
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
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :color="toggleButtonColor(propertyName)"
                        :checked-icon="toggleButtonIconChecked(propertyName)"
                        :unchecked-icon="toggleButtonIconUnchecked(propertyName)"
                        :model-value="value"
                        :dense="$q.screen.gt.md"
                        :dark="$q.dark.isActive"
                        @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
                      />
                    </q-item-section>
                    <q-item-section
                      v-if="typeof value === 'string' || typeof value === 'number'"
                      side
                    >
                      <q-input
                        :dense="$q.screen.gt.md"
                        :debounce="500"
                        :type="typeof value === 'number' ? 'number' : 'text'"
                        :model-value="value"
                        :dark="$q.dark.isActive"
                        @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
                      >
                        <template #after>
                          <q-btn
                            class="q-mr-sm q-ml-lg"
                            round
                            :dense="$q.screen.gt.md"
                            icon="save"
                          />
                        </template>
                      </q-input>
                    </q-item-section>
                  </q-item>
                </div>
                <!-- Customized Login -->
                <div v-if="mirror.options.hasOwnProperty('login')">
                  <div
                    dense
                    style="background:rgba(255, 255, 255, 0.2)"
                    class="flex flex-center justify-center items-center"
                  >
                    <span class="text-h6 ">{{ $t('settings.credentials').toLocaleUpperCase() }}</span>
                  </div>
                  <q-item
                    :dark="$q.dark.isActive"
                    style="background:rgba(255, 255, 255, 0.3)"
                    :class="$q.dark.isActive ? '' : 'bg-white'"
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('login') }}
                      </q-item-label>
                    </q-item-section>
                    <q-input
                      type="text"
                      :dense="$q.screen.gt.md"
                      outlined
                      hide-bottom-space
                      stack-label
                      :debounce="500"
                      :model-value="asTypeOrUndefined(mirror.options.login as string) || ''"
                      :dark="$q.dark.isActive"
                      :loading="modifying[mirror.name]"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'login', v)"
                    >
                      <template #append>
                        <q-icon
                          v-if="!modifying[mirror.name]"
                          :name="mirror.loggedIn ? 'check' : 'close'"
                          :color="mirror.loggedIn ? 'positive' : 'negative'"
                        />
                      </template>
                    </q-input>
                  </q-item>
                </div>
                <!-- Customized Password -->
                <div v-if="mirror.options.hasOwnProperty('password')">
                  <q-item
                    :dark="$q.dark.isActive"
                    style="background:rgba(255, 255, 255, 0.3)"
                    :class="$q.dark.isActive ? '' : 'bg-white'"
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('password') }}
                      </q-item-label>
                    </q-item-section>
                    <q-input
                      type="password"
                      :dense="$q.screen.gt.md"
                      :debounce="500"
                      outlined
                      :model-value="asTypeOrUndefined(mirror.options.password as string) || ''"
                      :dark="$q.dark.isActive"
                      :loading="modifying[mirror.name]"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'password', v)"
                    >
                      <template #append>
                        <q-icon
                          v-if="!modifying[mirror.name]"
                          :name="mirror.loggedIn ? 'check' : 'close'"
                          :color="mirror.loggedIn ? 'positive' : 'negative'"
                        />
                      </template>
                    </q-input>
                  </q-item>
                </div>
                <!-- Customized host -->
                <div v-if="mirror.options.hasOwnProperty('host')">
                  <q-item
                    :dark="$q.dark.isActive"
                    style="background:rgba(255, 255, 255, 0.3)"
                    :class="$q.dark.isActive ? '' : 'bg-white'"
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('host') }}
                      </q-item-label>
                    </q-item-section>
                    <q-input
                      type="text"
                      :dense="$q.screen.gt.md"
                      :debounce="500"
                      outlined
                      :model-value="asTypeOrUndefined(mirror.options.host as string) || ''"
                      :dark="$q.dark.isActive"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'host', v)"
                    >
                      <template #append>
                        <q-icon
                          v-if="!modifying[mirror.name]"
                          :name="mirror.isOnline ? 'check' : 'close'"
                          :color="mirror.isOnline ? 'positive' : 'negative'"
                        />
                      </template>
                    </q-input>
                  </q-item>
                </div>
                <!-- Customized port -->
                <div v-if="mirror.options.hasOwnProperty('port')">
                  <q-item
                    :dark="$q.dark.isActive"
                    style="background:rgba(255, 255, 255, 0.3)"
                    :class="$q.dark.isActive ? '' : 'bg-white'"
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('port') }}
                      </q-item-label>
                    </q-item-section>
                    <q-input
                      type="number"
                      :dense="$q.screen.gt.md"
                      outlined
                      :debounce="500"
                      :model-value="asTypeOrUndefined(mirror.options.port as number) || 8080"
                      :dark="$q.dark.isActive"
                      :loading="modifying[mirror.name]"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'port', v)"
                    >
                      <template #append>
                        <q-icon
                          v-if="!modifying[mirror.name]"
                          :name="mirror.isOnline ? 'check' : 'close'"
                          :color="mirror.isOnline ? 'positive' : 'negative'"
                        />
                      </template>
                    </q-input>
                  </q-item>
                </div>
                <!-- Customized protocol -->
                <div v-if="mirror.options.hasOwnProperty('protocol')">
                  <q-item
                    :dark="$q.dark.isActive"
                    style="background:rgba(255, 255, 255, 0.3)"
                    :class="$q.dark.isActive ? '' : 'bg-white'"
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('protocol') }}
                      </q-item-label>
                    </q-item-section>
                    <q-select
                      outlined
                      :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
                      :dense="$q.screen.gt.md"
                      :options-dense="$q.screen.gt.md"
                      :model-value="asTypeOrUndefined(mirror.options.protocol as string) || 'http'"
                      :dark="$q.dark.isActive"
                      :options="['http', 'https']"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'protocol', v)"
                    >
                      <template #append>
                        <q-icon
                          v-if="!modifying[mirror.name]"
                          :name="mirror.isOnline ? 'check' : 'close'"
                          :color="mirror.isOnline ? 'positive' : 'negative'"
                        />
                      </template>
                    </q-select>
                  </q-item>
                </div>
                <!-- Excluded Groups -->
                <div v-if="mirror.options.hasOwnProperty('excludedGroups')">
                  <q-item
                    :dense="$q.screen.gt.md"
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
                      :dense="$q.screen.gt.md"
                      :options-dense="$q.screen.gt.md"
                      :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
                      :model-value="mirror.options.excludedGroups"
                      :label="$t('settings.source.excludedGroupsHints')"
                      filled
                      use-input
                      use-chips
                      multiple
                      hide-dropdown-icon
                      new-value-mode="add-unique"
                      reactive-rules
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
                    :dense="$q.screen.gt.md"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ optionLabel('excludedUploaders') }}
                      </q-item-label>
                    </q-item-section>
                    <q-select
                      color="orange"
                      :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
                      :dense="$q.screen.gt.md"
                      :options-dense="$q.screen.gt.md"
                      :model-value="mirror.options.excludedUploaders"
                      :label="$t('settings.source.excludedGroupsHints')"
                      filled
                      use-input
                      use-chips
                      multiple
                      hide-dropdown-icon
                      new-value-mode="add-unique"
                      reactive-rules
                      :rules="[ val => isValidUUI(val) || $t('settings.source.validUUID') ]"
                      @update:model-value="(v:unknown) => changeOption(mirror.name, 'excludedUploaders', v)"
                    />
                  </q-item>
                </div>
              </q-list>
            </q-expansion-item>
          </q-list>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
