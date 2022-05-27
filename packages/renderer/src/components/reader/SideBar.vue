<script lang="ts" setup>
import { ref, watch, onUpdated } from 'vue';
import { chapterLabel } from './helpers';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';
import type { ReaderSettings } from './@types';

/** props */
const props = defineProps<{
  drawer:boolean,
  drawerReveal:boolean,
  chapterSelectedIndex: number,
  manga: MangaPage|MangaInDB,
  readerSettings: ReaderSettings
  first: {
    label: string | number;
    value: number;
  } | null
  previous: {
    label: string | number;
    value: number;
  } | null
  next: {
    label: string | number;
    value: number;
  } | null
  last: {
    label: string | number;
    value: number;
  } | null
}>();

/** emit */
const emit = defineEmits<{
  (event: 'navigate', chapterIndex:number): void
  (event: 'toggleDrawer'): void
  (event: 'updateSettings', settings: typeof localSettings.value): void
}>();

/** ref-ing the readerSettings props */
const localSettings = ref<ReaderSettings>({
  webtoon: props.readerSettings.webtoon,
  showPageNumber: props.readerSettings.showPageNumber,
  zoomMode: props.readerSettings.zoomMode,
  zoomValue: props.readerSettings.zoomValue,
  longStrip: props.readerSettings.longStrip,
});

/** make sure user can't use webtoon + screen mode 'fit-height' */
watch(localSettings, (nval) => {
  if(nval.webtoon && nval.zoomMode === 'fit-height') {
    console.log('fit-height is not supported for webtoon');
    nval.zoomMode = 'fit-width';
  }
  console.log('updating settings', nval);
  emit('updateSettings', nval);
}, {deep: true});

/** Current chapter */
const selectedChap = ref({label: chapterLabel(props.manga.chapters[props.chapterSelectedIndex].number, props.manga.chapters[props.chapterSelectedIndex].name), value: props.chapterSelectedIndex });

/** update the q-select menu if navigation is triggered from an outside element */
onUpdated(() => {
  selectedChap.value.label = chapterLabel(props.manga.chapters[props.chapterSelectedIndex].number, props.manga.chapters[props.chapterSelectedIndex].name);
  selectedChap.value.value = props.chapterSelectedIndex;
});

/** move to `manga.chapters[o.value]` */
function navigate(o: {label: string|number, value: number}) {
  selectedChap.value = o;
  emit('navigate', o.value);
}

</script>
<template>
  <q-drawer
    :model-value="drawer"
    side="right"
    :width="300"
    class="bg-grey-9"
    @update:model-value="emit('toggleDrawer')"
  >
    <q-bar
      v-if="drawerReveal"
      class="w-100 flex bg-grey-10 items-center justify-between cursor-pointer"
      @click="emit('toggleDrawer')"
    >
      <span class="ellipsis q-pr-sm"> {{ manga.displayName || manga.name }} </span>
      <q-tooltip>
        {{ manga.name }}
      </q-tooltip>
      <q-icon
        flat
        dense
        name="close"
      />
    </q-bar>
    <q-select
      v-model="selectedChap"
      hide-bottom-space
      item-aligned
      popup-content-style="width: 300px"
      :options="manga.chapters.map((chapter, index) => ({
        label: chapterLabel(chapter.number, chapter.name),
        value: index,
      }))"
      color="orange"
      @update:model-value="emit('navigate', $event.value)"
    >
      <template #selected-item>
        <div class="ellipsis">
          {{ selectedChap.label }}
        </div>
      </template>
      <template #option="scope">
        <q-item
          v-bind="scope.itemProps"
        >
          <q-item-section>
            <q-item-label>
              <div class="ellipsis">
                {{ scope.opt.label }}
              </div>
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
    <div class="flex flex-center">
      <q-btn-group>
        <q-btn
          :disable="!first"
          @click="first ? navigate(first) : null"
        >
          <q-icon name="first_page" />
          <q-tooltip v-if="first">
            <span>{{ $t('reader.first') }}</span>
            <br>
            <span>{{ first.label }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :disable="!previous"
          @click="previous ? navigate(previous): null"
        >
          <q-icon name="navigate_before" />
          <q-tooltip v-if="previous">
            <span>{{ $t('reader.previous') }}</span>
            <br>
            <span>{{ previous.label }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :disable="!next"
          @click="next ? navigate(next): null"
        >
          <q-icon name="navigate_next" />
          <q-tooltip v-if="next">
            <span>{{ $t('reader.next') }}</span>
            <br>
            <span>{{ next.label }}</span>
          </q-tooltip>
        </q-btn>

        <q-btn
          :disable="!last"
          @click="last ? navigate(last) : null"
        >
          <q-icon name="last_page" />
          <q-tooltip v-if="last">
            <span>{{ $t('reader.last') }}</span>
            <br>
            <span>{{ last.label }}</span>
          </q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
    <div class="q-mt-lg flex">
      <q-toggle
        v-model="localSettings.longStrip"
        :label="$t('reader.longstrip')"
        color="orange"
      />
      <q-toggle
        v-model="localSettings.webtoon"
        :label="$t('reader.webtoon')"
        color="orange"
      />
      <q-toggle
        v-model="localSettings.showPageNumber"
        :label="$t('reader.showpagenumber')"
        color="orange"
      />
      <q-btn-group class="q-ml-auto q-mr-auto q-mt-lg">
        <q-btn
          icon="width_wide"
          :color="localSettings.zoomMode === 'auto' ? 'orange' : undefined"
          @click="localSettings.zoomMode = 'auto'"
        >
          <q-tooltip>
            {{ $t('reader.displaymode.auto') }}
          </q-tooltip>
        </q-btn>
        <q-btn
          icon="fit_screen"
          :color="localSettings.zoomMode === 'fit-width' ? 'orange' : undefined"
          @click="localSettings.zoomMode = 'fit-width'"
        >
          <q-tooltip>
            {{ $t('reader.displaymode.fit-width') }}
          </q-tooltip>
        </q-btn>

        <q-btn
          icon="height"
          :text-color="localSettings.webtoon ? 'negative' : undefined"
          :color="localSettings.zoomMode === 'fit-height' ? 'orange' : undefined"
          :disable="localSettings.webtoon"
          @click="localSettings.zoomMode = 'fit-height'"
        >
          <q-tooltip>
            {{ $t('reader.displaymode.fit-height') }}
          </q-tooltip>
        </q-btn>
        <q-btn
          icon="pageview"
          :color="localSettings.zoomMode === 'custom' ? 'orange' : undefined"
          @click="localSettings.zoomMode = 'custom'"
        >
          <q-tooltip>
            {{ $t('reader.displaymode.fit-custom') }}
          </q-tooltip>
        </q-btn>
      </q-btn-group>
      <div
        v-if="localSettings.zoomMode === 'custom'"
        class="w-100 q-pa-lg q-mt-lg q-ml-auto q-mr-auto text-center"
      >
        <q-knob
          v-if="$q.platform.has.touch"
          v-model="localSettings.zoomValue"
          :step="5"
          :min="5"
          :max="500"
          size="90px"
          :thickness="0.2"
          color="orange"
          center-color="grey-8"
          track-color="dark"
          show-value
          class="q-ma-md"
        >
          {{ localSettings.zoomValue }}%
        </q-knob>
        <q-slider
          v-else
          v-model="localSettings.zoomValue"
          dense
          label-always
          :label-value="localSettings.zoomValue + '%'"
          :step="5"
          :min="5"
          :max="500"
          color="orange"
          label
          class="w-100"
        />
      </div>
    </div>
  </q-drawer>
</template>
