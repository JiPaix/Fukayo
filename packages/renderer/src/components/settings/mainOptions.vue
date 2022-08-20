<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { SettingsDB } from '@api/db/settings';
import { useSocket } from '@renderer/components/helpers/socket';
import type en from '@renderer/locales/en.json';
import type { supportedLangsType } from '@renderer/locales/lib/supportedLangs';
import { useStore as useStoreSettings } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** quasar */
const $q = useQuasar();
const $t = useI18n<{message: typeof en}, supportedLangsType>().t.bind(useI18n());
/** settings store */
const settings = useStoreSettings();
/** socket */
let socket: socketClientInstance|undefined;
/** global settings */
const globalSettings = ref<SettingsDB['data'] | undefined>();

/** global settings models */
const waitDay = ref<number|undefined>();
const waitHour = ref<number|undefined>();
const waitMinutes = ref<number|undefined>();
const cacheSizeEnabled = ref<boolean|undefined>();
const cacheGB = ref<number|undefined>();
const cacheAgeEnabled = ref<boolean|undefined>();
const cacheAge = ref<number|undefined>();
const cacheDay = ref<number|undefined>();
const cacheHour = ref<number|undefined>();
const cacheMinutes = ref<number|undefined>();
const globalSettingsChanged = ref(false);



/** waitDay + waitHour + waitMinutes in ms */
const waitupdate = computed(() => {
  if (waitDay.value === undefined || waitHour.value === undefined || waitMinutes.value === undefined) {
    return undefined;
  }
  return (
    waitDay.value * 24 * 60 * 60 * 1000 +
    waitHour.value * 60 * 60 * 1000 +
    waitMinutes.value * 60 * 1000
  );
});

/** cacheDay + cacheHour + cacheMinutes in ms */
const cacheupdate = computed(() => {
  if (cacheAgeEnabled.value === false || cacheDay.value === undefined || cacheHour.value === undefined || cacheMinutes.value === undefined) {
    return undefined;
  }
  return (
    cacheDay.value * 24 * 60 * 60 * 1000 +
    cacheHour.value * 60 * 60 * 1000 +
    cacheMinutes.value * 60 * 1000
  );
});

const warning = computed(() => {
  if (cacheSizeEnabled.value) {
    if (typeof cacheGB.value !== 'undefined') {
      if(cacheGB.value < 1) {
        return $t('settings.scheduler.cache.error.size');
      }
    }
  }
    if(typeof cacheupdate.value !== 'undefined') {
      // age can't be negative
      if(cacheupdate.value < 0) return $t('settings.scheduler.cache.error.negative');
      // age can't be less than 10 minutes
      if(cacheupdate.value < 10 * 60 * 1000) return $t('settings.scheduler.cache.error.lessthan10min');
    }
    if(typeof waitupdate.value !== 'undefined') {
      // wait can't be negative
      if(waitupdate.value < 0) return $t('settings.scheduler.update.error.negative');
      // wait can't be less than 10 minutes
      if(waitupdate.value < 10 * 60 * 1000) return $t('settings.scheduler.update.error.lessthan10min');
    }
    return undefined;
});

watch([waitupdate, cacheSizeEnabled, cacheGB, cacheupdate, cacheAgeEnabled], ([newupdate, newcache, newcachegb, newcacheupdate, newcacheage], [oldupdate, oldcache, oldcachegb, oldcacheupdate, oldcacheage]) => {
  if(newupdate !== oldupdate && typeof oldupdate !== 'undefined') {
    globalSettingsChanged.value = true;
    return;
  }
  if(newcache !== oldcache && typeof oldcache !== 'undefined') {
    globalSettingsChanged.value = true;
    return;
  }
  if(newcachegb !== oldcachegb && typeof oldcachegb !== 'undefined') {
    globalSettingsChanged.value = true;
    return;
  }
  if(newcacheupdate !== oldcacheupdate && typeof oldcacheupdate !== 'undefined') {
    globalSettingsChanged.value = true;
    return;
  }
  if(newcacheage !== oldcacheage && typeof oldcacheage !== 'undefined') {
    globalSettingsChanged.value = true;
    return;
  }
});

const darkIcon = computed(() => {
  return settings.theme === 'dark' ? 'dark_mode' : 'light_mode';
});

const cacheIcon = computed(() => {
  return cacheSizeEnabled.value ? 'lock' : 'lock_open';
});

const cacheAgeIcon = computed(() => {
  return cacheAgeEnabled.value ? 'sanitizer' : 'elderly';
});

const longStripIcon = computed(() => {
  return settings.reader.longStrip ? 'swipe_vertical' : 'queue_play_next';
});

const webtoonIcon = computed(() => {
  return settings.reader.webtoon ? 'smartphone' : 'aod';
});

const preloadIcon = computed(() => {
  return settings.reader.preloadNext ? 'signal_cellular_alt' : 'signal_cellular_alt_2_bar';
});

const showPageNumberIcon = computed(() => {
  return settings.reader.showPageNumber ? 'visibility' : 'visibility_off';
});

const showOverlayIcon = computed(() => {
  return settings.reader.overlay ? 'layers' : 'layers_clear';
});

function toggleDarkMode() {
  if (settings.theme === 'dark') {
    settings.theme = 'light';
    $q.dark.set(false);
  } else {
    settings.theme = 'dark';
    $q.dark.set(true);
  }
}

function parseSettings(s: SettingsDB['data']) {
    const update = s.library.waitBetweenUpdates;
    // get the number of days, hours, and minutes from the update time which is in milliseconds
    waitDay.value = Math.floor(update / (1000 * 60 * 60 * 24));
    waitHour.value = Math.floor((update % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    waitMinutes.value = Math.floor((update % (1000 * 60 * 60)) / (1000 * 60));
    cacheSizeEnabled.value = s.cache.size.enabled;

    const cachelimit = s.cache.size.max;
    cacheGB.value = (cachelimit / (1000 * 1000 * 1000) * 100) / 100;

    cacheAgeEnabled.value = s.cache.age.enabled;
    cacheAge.value = s.cache.age.max;
    // get the number of days, hours, and minutes from the cache age which is in milliseconds
    cacheDay.value = Math.floor(s.cache.age.max / (1000 * 60 * 60 * 24));
    cacheHour.value = Math.floor((s.cache.age.max % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    cacheMinutes.value = Math.floor((s.cache.age.max % (1000 * 60 * 60)) / (1000 * 60));
}

async function getSettings() {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getSettings', (s) => {
    globalSettings.value = s;
    parseSettings(s);
  });
}

async function saveSettings() {
  if(
    !globalSettings.value
    || typeof cacheSizeEnabled.value === 'undefined'
    || typeof cacheAgeEnabled.value === 'undefined'
    || typeof cacheGB.value === 'undefined'
  ) return;
  if(!socket) socket = await useSocket(settings.server);
  const newGlobalSettings: SettingsDB['data'] = {
    ...globalSettings.value,
    library: {
      ...globalSettings.value.library,
      waitBetweenUpdates: waitupdate.value || globalSettings.value.library.waitBetweenUpdates,
    },
    cache: {
      ...globalSettings.value.cache,
      size: {
        max: cacheGB.value * 1000 * 1000 * 1000,
        enabled: cacheSizeEnabled.value,
      },
      age: {
        max: cacheupdate.value || globalSettings.value.cache.age.max,
        enabled: cacheAgeEnabled.value,
      },
    },
  };
  socket.emit('changeSettings', newGlobalSettings, (updated) => {
    if(updated) {
      globalSettings.value = newGlobalSettings;
      parseSettings(newGlobalSettings);
      globalSettingsChanged.value = false;
    }
  });
}

onBeforeMount(async () => {
  await getSettings();
});

</script>
<template>
  <q-card
    flat
    class="w-100 text"
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? 'text-white bg-dark' : 'text-black bg-grey-2'"
  >
    <q-card-section>
      <q-list
        :dark="$q.dark.isActive"
        separator
      >
        <q-expansion-item
          :label="$t('settings.global.title').toLocaleUpperCase()"
          class="shadow-2"
          :class="$q.dark.isActive ? '' : 'bg-grey-4'"
          group="global"
          :dark="$q.dark.isActive"
        >
          <q-list
            separator
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? '' : 'bg-grey-2'"
          >
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="toggleDarkMode"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.darkmode') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  :model-value="settings.theme === 'dark'"
                  :icon="darkIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                  @update:model-value="toggleDarkMode"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.update.wait', {chapterWord: $t('mangas.chapter', 20).toLocaleLowerCase()}) }}
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <div
                  v-if="typeof waitDay !== 'undefined' && typeof waitHour !== 'undefined' && typeof waitMinutes !== 'undefined'"
                  class="row items-start w-100 flex justify-around"
                >
                  <q-input
                    v-model="waitDay"
                    dense
                    type="number"
                    :min="0"
                    :label="$t('settings.update.day', waitDay)"
                    :dark="$q.dark.isActive"
                  />
                  <q-input
                    v-model="waitHour"
                    dense
                    type="number"
                    :min="0"
                    :label="$t('settings.update.hour', waitHour)"
                    :dark="$q.dark.isActive"
                  />
                  <q-input
                    v-model="waitMinutes"
                    dense
                    :min="0"
                    type="number"
                    :label="$t('settings.update.minute', waitMinutes)"
                    :dark="$q.dark.isActive"
                  />
                </div>
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="cacheSizeEnabled = !cacheSizeEnabled"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.scheduler.cache_enable') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="cacheSizeEnabled"
                  :icon="cacheIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              v-if="cacheSizeEnabled"
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.scheduler.cache_size') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div
                  v-if="typeof cacheGB !== 'undefined'"
                  class="row items-start w-100 flex justify-around"
                >
                  <q-input
                    v-model="cacheGB"
                    min="1"
                    dense
                    type="number"
                    :label="$t('settings.scheduler.cache.GB', cacheGB)"
                    :dark="$q.dark.isActive"
                  />
                </div>
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="cacheAgeEnabled = !cacheAgeEnabled"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.scheduler.cache_age_enable') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="cacheAgeEnabled"
                  :icon="cacheAgeIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              v-if="cacheAgeEnabled"
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.scheduler.cache_age') }}
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <div
                  v-if="typeof cacheDay !== 'undefined' && typeof cacheHour !== 'undefined' && typeof cacheMinutes !== 'undefined'"
                  class="row items-start w-100 flex justify-around"
                >
                  <q-input
                    v-model="cacheDay"
                    dense
                    type="number"
                    :min="0"
                    :label="$t('settings.update.day', cacheDay)"
                    :dark="$q.dark.isActive"
                  />
                  <q-input
                    v-model="cacheHour"
                    dense
                    type="number"
                    :min="0"
                    :label="$t('settings.update.hour', cacheHour)"
                    :dark="$q.dark.isActive"
                  />
                  <q-input
                    v-model="cacheMinutes"
                    dense
                    type="number"
                    :min="0"
                    :label="$t('settings.update.minute', cacheMinutes)"
                    :dark="$q.dark.isActive"
                  />
                </div>
              </q-item-section>
            </q-item>
            <q-slide-transition>
              <div
                v-show="globalSettingsChanged && typeof warning === 'undefined'"
                class="w-100"
              >
                <q-btn
                  class="bg-primary text-white cursor-pointer w-100"
                  flat
                  :rounded="false"
                  @click="saveSettings"
                >
                  {{ $t('settings.globalSettings.save') }}
                </q-btn>
              </div>
            </q-slide-transition>
            <q-slide-transition>
              <div v-show="typeof warning !== 'undefined'">
                <q-banner
                  class="bg-red text-white cursor-pointer"
                  :dark="$q.dark.isActive"
                >
                  {{ warning }}
                </q-banner>
              </div>
            </q-slide-transition>
          </q-list>
        </q-expansion-item>
        <q-expansion-item
          :label="$t('settings.reader.title').toLocaleUpperCase()"
          class="shadow-2"
          :class="$q.dark.isActive ? '' : 'bg-grey-4'"
          group="reader"
        >
          <q-list
            separator
            :class="$q.dark.isActive ? '' : 'bg-grey-2'"
            :dark="$q.dark.isActive"
          >
            <q-banner class="bg-primary text-white">
              {{ $t('settings.reader.info') }}
            </q-banner>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="settings.reader.preloadNext = !settings.reader.preloadNext"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.reader.preload') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.preloadNext"
                  :icon="preloadIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="settings.reader.longStrip = !settings.reader.longStrip"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.longstrip') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.longStrip"
                  :icon="longStripIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="settings.reader.webtoon = !settings.reader.webtoon"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.webtoon') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.webtoon"
                  :disable="settings.reader.zoomMode === 'fit-height'"
                  :icon="webtoonIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="settings.reader.showPageNumber = !settings.reader.showPageNumber"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.showpagenumber') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.showPageNumber"
                  :icon="showPageNumberIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
              @click="settings.reader.overlay = !settings.reader.overlay"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.reader.overlay') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.overlay"
                  :icon="showOverlayIcon"
                  size="lg"
                  :dark="$q.dark.isActive"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.3)"
              class="flex items-center"
              :dark="$q.dark.isActive"
              clickable
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.displaymodes') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-btn-group class="q-ml-auto q-mr-auto justify-center">
                  <q-btn
                    icon="width_wide"
                    :color="settings.reader.zoomMode === 'auto' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'auto'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.auto') }}
                    </q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="fit_screen"
                    :color="settings.reader.zoomMode === 'fit-width' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'fit-width'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-width') }}
                    </q-tooltip>
                  </q-btn>

                  <div class="q-pa-none q-ma-none no-box-shadows">
                    <q-btn
                      icon="height"
                      :text-color="settings.reader.webtoon ? 'negative' : undefined"
                      :color="settings.reader.zoomMode === 'fit-height' ? 'orange' : undefined"
                      :disable="settings.reader.webtoon"
                      @click="settings.reader.zoomMode = 'fit-height';settings.reader.webtoon = false"
                    />
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-height') }} ({{ settings.reader.webtoon ? $t('reader.displaymode.compatibility') : '' }})
                    </q-tooltip>
                  </div>
                  <q-btn
                    icon="pageview"
                    :color="settings.reader.zoomMode === 'custom' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'custom'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-custom') }}
                    </q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>
<style lang="css" scoped>
 .no-box-shadows > .q-btn:before {
    box-shadow: none!important;
 }
</style>
