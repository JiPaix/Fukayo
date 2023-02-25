<script lang="ts" setup>
import type SettingsDB from '@api/db/settings';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useStoreSettings } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { transformIMGurl } from '../helpers/transformIMGurl';

/** props */
const props = defineProps<{subHeaderSize?: number}>();

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** settings store */
settings = useStoreSettings();

// globals
const
/** env variables */
env = import.meta.env;

// states
const
/** global settings */
globalSettings = ref<SettingsDB['data'] | undefined>(),
// global settings v-model
waitDay = ref<number|undefined>(),
waitHour = ref<number|undefined>(),
waitMinutes = ref<number|undefined>(),
cacheSizeEnabled = ref<boolean|undefined>(),
cacheGB = ref<number|undefined>(),
cacheAgeEnabled = ref<boolean|undefined>(),
cacheAge = ref<number|undefined>(),
cacheDay = ref<number|undefined>(),
cacheHour = ref<number|undefined>(),
cacheMinutes = ref<number|undefined>(),
globalSettingsChanged = ref(false);


// computed
const
/** is client electron */
isElectron = computed(() => {
  return typeof window.apiServer;
}),
/** waitDay + waitHour + waitMinutes in ms */
 waitupdate = computed(() => {
  if (waitDay.value === undefined || waitHour.value === undefined || waitMinutes.value === undefined) {
    return undefined;
  }
  return (
    waitDay.value * 24 * 60 * 60 * 1000 +
    waitHour.value * 60 * 60 * 1000 +
    waitMinutes.value * 60 * 1000
  );
}),
/** cacheDay + cacheHour + cacheMinutes in ms */
cacheupdate = computed(() => {
  if (cacheAgeEnabled.value === false || cacheDay.value === undefined || cacheHour.value === undefined || cacheMinutes.value === undefined) {
    return undefined;
  }
  return (
    cacheDay.value * 24 * 60 * 60 * 1000 +
    cacheHour.value * 60 * 60 * 1000 +
    cacheMinutes.value * 60 * 1000
  );
}),
/** warning message */
warning = computed(() => {
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
}),
/** dark/light mode icon */
darkIcon = computed(() => {
  return settings.theme === 'dark' ? 'dark_mode' : 'light_mode';
}),
/** cache icon */
cacheIcon = computed(() => {
  return cacheSizeEnabled.value ? 'lock' : 'lock_open';
}),
/** cache age icon */
cacheAgeIcon = computed(() => {
  return cacheAgeEnabled.value ? 'sanitizer' : 'elderly';
}),
/** longstrip icon */
longStripIcon = computed(() => {
  return settings.reader.longStrip ? 'swipe_vertical' : 'queue_play_next';
}),
/** rtl/ltr icon */
rtlIcon = computed(() => {
  return settings.reader.rtl ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r';
}),
/** webtoon icon */
webtoonIcon = computed(() => {
  return settings.reader.webtoon ? 'smartphone' : 'aod';
}),
/** preload icon */
preloadIcon = computed(() => {
  return settings.readerGlobal.preloadNext ? 'signal_cellular_alt' : 'signal_cellular_alt_2_bar';
}),
/** display/hide page number icon */
showPageNumberIcon = computed(() => {
  return settings.reader.showPageNumber ? 'visibility' : 'visibility_off';
}),
/** display/hide navigation overlay icon */
showOverlayIcon = computed(() => {
  return settings.reader.overlay ? 'layers' : 'layers_clear';
}),
/** parent's QHeader size */
headerSize = computed(() => {
  return (props.subHeaderSize || 0) + (document.querySelector<HTMLDivElement>('#top-header')?.offsetHeight || 0);
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

/** get settings from API */
async function getSettings() {
  const socket = await useSocket(settings.server);
  socket.emit('getSettings', (s) => {
    globalSettings.value = s;
    parseSettings(s);
  });
}

/** save settings to the API */
async function saveSettings() {
  if(
    !globalSettings.value
    || typeof cacheSizeEnabled.value === 'undefined'
    || typeof cacheAgeEnabled.value === 'undefined'
    || typeof cacheGB.value === 'undefined'
  ) return;
  const socket = await useSocket(settings.server);
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

/** make sure options are compatible with each others */
async function checkSettingsCompatibilty(key: keyof typeof settings.reader) {

  if(key === 'book' && settings.reader.book) {
    if(settings.reader.zoomMode === 'stretch-height' && settings.reader.longStripDirection === 'vertical') settings.reader.zoomMode = 'auto';
    if(settings.reader.webtoon) settings.reader.webtoon = false;
    if( (!settings.reader.longStrip && settings.reader.book) || (settings.reader.longStrip && settings.reader.longStripDirection === 'vertical')) {
      if(settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
    }
  }

  if(key === 'longStrip' && !settings.reader.longStrip) {
    settings.reader.webtoon = false;
  }

  if(key === 'webtoon' && settings.reader.webtoon) {
    if(settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && settings.reader.longStripDirection === 'vertical') {
    if(settings.reader.book && settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && settings.reader.longStripDirection === 'horizontal') {
    if(settings.reader.zoomMode === 'stretch-width') settings.reader.zoomMode = 'auto';
  }

}

/** show prompt dialog */
function prompt (retry = false) {
      $q.dialog({
        html: true,
        title: $t('settings.app_confirm_quit'),
        message: `${$t('settings.app_ask_password')} ${retry ? '<p class="text-negative">'+$t('settings.app_ask_password_retry')+'</p>' : ''}`,
        prompt: {
          model: '',
          type: 'password', // optional
        },
        cancel: true,
        persistent: true,
      }).onOk(data => {
        if(typeof data === 'string') kill(data);
      });
    }

/** send request to kill server */
async function kill(password:string) {
  fetch(transformIMGurl('kill', settings), {
      method: 'post',
      headers: {
        'Authorization': 'Basic '+btoa(`${settings.server.login}:${password}`),
      },
    }).then((r) => {
      if(!r.ok) throw new Error();
    }).catch(() => {
      prompt(true);
    });
}


/** set globalSettingsChanged if any of the settings have been changed */
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

onBeforeMount(getSettings);
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
          :style="{height: `${$q.screen.height-headerSize}px`, minHeight: '100px'}"
          :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
          :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
          class="q-pa-lg"
        >
          <q-list
            :dark="$q.dark.isActive"
            separator
            bordered
          >
            <q-expansion-item
              :label="$t('settings.server').toLocaleUpperCase()"
              :class="$q.dark.isActive ? '' : 'bg-grey-4'"
              group="global"
              :dark="$q.dark.isActive"
              :dense="$q.screen.gt.md"
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
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.app_version') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <span>{{ env.VITE_APP_VERSION }}</span>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.app_client') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <span>{{ isElectron ? 'Electron':'Browser' }}</span>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.app_env') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <span>{{ env.MODE }}</span>
                  </q-item-section>
                </q-item>
                <q-item
                  v-if="isElectron"
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('app.autostart') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-toggle
                      v-model="settings.server.autostart"
                      :icon="settings.server.autostart ? 'start' : 'stop'"
                      :dark="$q.dark.isActive"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.app_shutdown') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-btn
                      color="negative"
                      size="sm"
                      :label="$t('electron.systemtray.quit')"
                      @click="() => prompt(false)"
                    />
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
              :dense="$q.screen.gt.md"
              :label="$t('settings.global.title').toLocaleUpperCase()"
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
                  :dense="$q.screen.gt.md"
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
                      :dark="$q.dark.isActive"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      @update:model-value="toggleDarkMode"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.update.wait') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section>
                    <div
                      v-if="typeof waitDay !== 'undefined' && typeof waitHour !== 'undefined' && typeof waitMinutes !== 'undefined'"
                      class="flex column q-ml-auto"
                      style="max-width:150px;"
                    >
                      <q-input
                        v-model="waitDay"
                        type="number"
                        :min="0"
                        :label="$t('settings.update.day', waitDay)"
                        :dark="$q.dark.isActive"
                        :dense="$q.screen.gt.md"
                        outlined
                        class="q-my-xs"
                      />
                      <q-input
                        v-model="waitHour"
                        outlined
                        :dense="$q.screen.gt.md"
                        type="number"
                        :min="0"
                        :label="$t('settings.update.hour', waitHour)"
                        :dark="$q.dark.isActive"
                        xlass="q-my-xs"
                      />
                      <q-input
                        v-model="waitMinutes"
                        outlined
                        :dense="$q.screen.gt.md"
                        :min="0"
                        type="number"
                        :label="$t('settings.update.minute', waitMinutes)"
                        :dark="$q.dark.isActive"
                        class="q-my-xs"
                      />
                    </div>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
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
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
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

                  :dense="$q.screen.gt.md"
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
                      style="max-width:150px;"
                    >
                      <q-input
                        v-model="cacheGB"
                        min="1"
                        :dense="$q.screen.gt.md"
                        outlined
                        type="number"
                        :label="$t('settings.scheduler.cache.GB', cacheGB)"
                        :dark="$q.dark.isActive"
                        class="q-my-xs"
                      />
                    </div>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
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
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
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
                      class="flex column q-ml-auto"
                      style="max-width:150px;"
                    >
                      <q-input
                        v-model="cacheDay"
                        :dense="$q.screen.gt.md"
                        outlined
                        class="q-my-xs"
                        type="number"
                        :min="0"
                        :label="$t('settings.update.day', cacheDay)"
                        :dark="$q.dark.isActive"
                      />
                      <q-input
                        v-model="cacheHour"
                        class="q-my-xs"
                        outlined
                        :dense="$q.screen.gt.md"
                        type="number"
                        :min="0"
                        :label="$t('settings.update.hour', cacheHour)"
                        :dark="$q.dark.isActive"
                      />
                      <q-input
                        v-model="cacheMinutes"
                        class="q-my-xs"
                        outlined
                        :dense="$q.screen.gt.md"
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
              :class="$q.dark.isActive ? '' : 'bg-grey-4'"
              group="global"
              :dense="$q.screen.gt.md"
            >
              <q-list
                separator
                :class="$q.dark.isActive ? '' : 'bg-grey-2'"
                :dark="$q.dark.isActive"
              >
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
                  @click="settings.readerGlobal.preloadNext = !settings.readerGlobal.preloadNext"
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
                      v-model="settings.readerGlobal.preloadNext"
                      :icon="preloadIcon"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :dark="$q.dark.isActive"
                    />
                  </q-item-section>
                </q-item>
                <q-item class="bg-primary text-white">
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.reader.info') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
                  @click="settings.reader.longStrip = !settings.reader.longStrip;checkSettingsCompatibilty('longStrip')"
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
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :dark="$q.dark.isActive"
                      @update:model-value="checkSettingsCompatibilty('longStrip')"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  :dense="$q.screen.gt.md"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.longstripDirection') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-btn-group class="q-ml-auto q-mr-auto justify-center q-my-xs">
                      <q-btn
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        icon="swap_vert"
                        :color="settings.reader.longStripDirection === 'vertical' && settings.reader.longStrip ? 'orange' : undefined"
                        @click="settings.reader.longStripDirection = 'vertical';checkSettingsCompatibilty('longStripDirection')"
                      >
                        <q-tooltip>
                          {{ $t('reader.vertical') }}
                        </q-tooltip>
                      </q-btn>
                      <q-btn
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        icon="swap_horiz"
                        :color="settings.reader.longStripDirection === 'horizontal' && settings.reader.longStrip ? 'orange' : undefined"
                        @click="settings.reader.longStripDirection = 'horizontal';checkSettingsCompatibilty('longStripDirection')"
                      >
                        <q-tooltip>
                          {{ $t('reader.horizontal') }}
                        </q-tooltip>
                      </q-btn>
                    </q-btn-group>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  :dense="$q.screen.gt.md"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.bookmode') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-btn-group class="q-ml-auto q-mr-auto justify-center q-my-xs">
                      <q-btn
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        icon="menu_book"
                        :color="settings.reader.book && !settings.reader.bookOffset ? 'orange' : undefined"
                        @click="settings.reader.book = true;settings.reader.bookOffset = false;checkSettingsCompatibilty('book')"
                      >
                        <q-tooltip>
                          {{ $t('reader.book_mode') }}
                        </q-tooltip>
                      </q-btn>
                      <q-btn
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        icon="auto_stories"
                        :color="settings.reader.book && settings.reader.bookOffset ? 'orange':''"
                        @click="settings.reader.book = true;settings.reader.bookOffset = true;checkSettingsCompatibilty('book')"
                      >
                        <q-tooltip>
                          {{ $t('reader.book_mode_offset') }}
                        </q-tooltip>
                      </q-btn>
                      <q-btn
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        :color="!settings.reader.book && !settings.reader.bookOffset && settings.reader.longStrip ? 'orange':''"
                        icon="not_interested"
                        @click="settings.reader.book = false;settings.reader.bookOffset = false;checkSettingsCompatibilty('book')"
                      >
                        <q-tooltip>{{ $t('reader.book_mode_off') }}</q-tooltip>
                      </q-btn>
                    </q-btn-group>
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
                  @click="settings.reader.rtl = !settings.reader.rtl"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('reader.rtl') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-toggle
                      v-model="settings.reader.rtl"
                      color="orange"
                      :icon="rtlIcon"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :dark="$q.dark.isActive"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  :dense="$q.screen.gt.md"
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
                      :disable="settings.reader.book || !settings.reader.longStrip"
                      :color="settings.reader.book || !settings.reader.longStrip ? 'negative' : ''"
                      :keep-color="settings.reader.book || !settings.reader.longStrip"
                      :icon="webtoonIcon"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :dark="$q.dark.isActive"
                      @update:model-value="settings.reader.webtoon = true;checkSettingsCompatibilty('webtoon')"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
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
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                      :dark="$q.dark.isActive"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  clickable
                  :dense="$q.screen.gt.md"
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
                      :dark="$q.dark.isActive"
                      :size="$q.screen.gt.md ? 'md' : 'xl'"
                      :dense="$q.screen.gt.md"
                    />
                  </q-item-section>
                </q-item>
                <q-item
                  style="background:rgba(255, 255, 255, 0.3)"
                  class="flex items-center"
                  :dark="$q.dark.isActive"
                  :dense="$q.screen.gt.md"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ $t('settings.displaymodes') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                  >
                    <q-btn-group class="q-ml-auto q-mr-auto justify-center q-my-xs">
                      <q-btn
                        icon="width_wide"
                        :color="settings.reader.zoomMode === 'auto' ? 'orange' : undefined"
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        @click="settings.reader.zoomMode = 'auto';checkSettingsCompatibilty('zoomMode')"
                      >
                        <q-tooltip>
                          {{ $t('reader.displaymode.auto') }}
                        </q-tooltip>
                      </q-btn>
                      <q-btn
                        icon="fit_screen"
                        :disable="settings.reader.longStrip && settings.reader.longStripDirection === 'horizontal'"
                        :text-color="settings.reader.longStrip && settings.reader.longStripDirection === 'horizontal' ? 'negative' : ''"
                        :color="settings.reader.zoomMode === 'stretch-width' ? 'orange' : undefined"
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        @click="settings.reader.zoomMode = 'stretch-width';checkSettingsCompatibilty('zoomMode')"
                      >
                        <q-tooltip>
                          {{ $t('reader.displaymode.stretch-width') }}
                        </q-tooltip>
                      </q-btn>
                      <q-btn
                        icon="height"
                        :text-color="settings.reader.webtoon || (settings.reader.book && settings.reader.longStripDirection !== 'horizontal') ? 'negative' : undefined"
                        :color="settings.reader.zoomMode === 'stretch-height' ? 'orange' : undefined"
                        :disable="settings.reader.webtoon || (settings.reader.book && settings.reader.longStripDirection !== 'horizontal')"
                        :size="$q.screen.gt.md ? 'md' : 'xl'"
                        :dense="$q.screen.gt.md"
                        @click="settings.reader.zoomMode = 'stretch-height';checkSettingsCompatibilty('zoomMode')"
                      >
                        <q-tooltip>
                          {{ $t('reader.displaymode.stretch-height') }} ({{ settings.reader.webtoon ? $t('reader.displaymode.compatibility') : '' }})
                        </q-tooltip>
                      </q-btn>
                    </q-btn-group>
                    {{ settings.reader.zoomMode }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </q-list>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

