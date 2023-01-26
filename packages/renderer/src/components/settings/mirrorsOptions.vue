<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { applyAllFilters, sortLangs, sortMirrorByNames } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import mirrorSetup from '@renderer/components/settings/mirrorSetup.vue';
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


function updateSources(sources:mirrorInfo[]) {
  mirrorsRAW.value = sources;
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

  const updateMirror = (key: 'isLoggedIn'|'isOnline', mirror: string, status:boolean) => {
    const source = mirrorsRAW.value.find(m => m.name === mirror);
    if(!source) return;
    if(key === 'isLoggedIn') source.loggedIn = status;
    else source.isOnline = status;
  };
  socket.on('loggedIn', (mirror, status) => updateMirror('isLoggedIn', mirror, status));
  socket.on('isOnline', (mirror, status) => updateMirror('isOnline', mirror, status));
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('loggedIn');
  socket.off('isOnline');
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
            <mirror-setup
              v-for="mirror in mirrors"
              :key="mirror.name"
              :mirror="mirror"
              @update-sources="updateSources"
            />
          </q-list>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
