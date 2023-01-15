<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { applyAllFilters, setupMirrorFilters, sortLangs, sortMirrorByNames, toggleAllLanguages, toggleLang } from '@renderer/components/helpers/mirrorFilters';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import type { QCardSection } from 'quasar';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// config
const
/** quasar */
$q = useQuasar(),
/** router */
router = useRouter(),
/** user settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// states
const
/** search filter */
query = ref<string|null>(''),
/** AZ/ZA sorting */
sortAZ = ref(true),
/** list of available languages */
allLangs = ref<mirrorsLangsType[]>([]),
/** languages to includes in the results */
includedLangsRAW = ref<mirrorsLangsType[]>([]),
/** mirrors */
mirrorsRAW = ref<mirrorInfo[]>([]),
/** QForm template ref */
form = ref<InstanceType<typeof QCardSection>>(),
/** QForm size */
formSize = ref(0);

// computed
const
/** mirrors (sorted) */
mirrors = computed(() => {
  return sortMirrorByNames(applyAllFilters(mirrorsRAW.value, query.value, includedLangs.value), sortAZ.value);
}),
/** return the ordered list of includedLangsRAW */
includedLangs = computed(() => {
  return sortLangs(includedLangsRAW.value, $t);
}),
/** returns true if all available languages are included in the filter */
includedAllLanguage = computed(() => {
  if(includedLangsRAW.value.length < allLangs.value.length) {
    if(includedLangsRAW.value.length === 0) return false;
    return null;
  }
  return true;
}),
/** QHeader + QBar size */
headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
});


/** include/exclude all available languages from the filter, also affects the mirror filter */
function pickall() {
  return toggleAllLanguages(includedAllLanguage.value, allLangs.value, includedLangsRAW);
}

/** include/exclude a language from the filter, also affects the mirror filter */
function pick(lang:mirrorsLangsType) {
  return toggleLang(lang, includedLangsRAW, undefined, undefined, settings.i18n.ignored);
}

/** save the QForm size in `formSize` */
function qSectionResize() {
  if(!form.value) return;
  formSize.value = form.value.$el.offsetHeight;
}

/** get available sources and start the search if routes params are present */
async function On() {
  const socket = await useSocket(settings.server);
  socket.emit('getMirrors', false, (m) => {
    m = m.filter(m => !m.selfhosted);
    setupMirrorFilters(m, mirrorsRAW, includedLangsRAW, allLangs, undefined, settings.i18n.ignored);
  });
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.emit('stopShowRecommend');
  socket.off('showRecommend');
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
      <q-page style="overflow:hidden;">
        <q-form
          ref="form"
          class="text-center q-pa-lg"
        >
          <q-input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="$t('explore.placeholder')"
            outlined
            clearable
            autofocus
            :color="$q.dark.isActive ? 'white' : 'primary'"
            :dark="$q.dark.isActive"
            class="q-mb-xs"
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
          <q-btn-group
            :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
            class="q-mt-lg"
          >
            <q-btn
              :ripple="false"
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
                  @click="pickall"
                >
                  <q-checkbox
                    v-model="includedAllLanguage"
                    size="32px"
                    color="primary"
                    class="q-ma-none q-pa-none"
                    toggle-indeterminate
                    :dark="$q.dark.isActive"
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
                    {{ $t('search.all') }}
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item
                  v-for="lang in allLangs"
                  :key="lang"
                  clickable
                  :dark="$q.dark.isActive"
                  @click="pick(lang)"
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
          <q-resize-observer @resize="qSectionResize" />
        </q-form>
        <q-scroll-area
          :style="{ height: `${$q.screen.height-headerSize-formSize}px`, minHeight: '100px' }"
          :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
          :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
          class="q-pa-lg"
        >
          <q-list
            class="w-100 q-mt-md q-pa-lg"
            separator
            :dark="$q.dark.isActive"
          >
            <q-item
              v-for="mirror in mirrors"
              :key="mirror.name"
              v-ripple
              clickable
              class="q-mx-md"
              :dark="$q.dark.isActive"
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
                      v-for="lang in mirror.langs.filter(l => !settings.i18n.ignored.includes(l))"
                      :key="lang"
                      dense
                      size="sm"
                      color="orange"
                      :dark="$q.dark.isActive"
                    >
                      {{ $t(`languages.${lang}`) }}
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
                    {{ $t('explore.meta.quality') }}
                  </div>
                  <div class="col">
                    <q-linear-progress
                      :value="mirror.meta.quality"
                      color="accent"
                      style="width:40px;height:6px;"
                      rounded
                      :dark="$q.dark.isActive"
                    />
                  </div>
                </div>
                <div
                  class="row items-center"
                >
                  <div class="col q-px-md text-caption">
                    {{ $t('explore.meta.speed') }}
                  </div>
                  <q-linear-progress
                    :value="mirror.meta.speed"
                    color="warning"
                    style="width:40px;height:6px;"
                    rounded
                    :dark="$q.dark.isActive"
                  />
                </div>
                <div class="row items-center">
                  <div class="col q-px-md text-caption">
                    {{ $t('explore.meta.popularity') }}
                  </div>
                  <q-linear-progress
                    :value="mirror.meta.popularity"
                    color="info"
                    style="width:40px;height:6px;"
                    rounded
                    :dark="$q.dark.isActive"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style lang="css" scoped>

.q-item__section--main ~ .q-item__section--side {
  padding-left: 0;
}
</style>
