<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isChapterImage } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';

const $q = useQuasar();
const props = defineProps<{
    sources: (ChapterImage|ChapterImageErrorMessage)[]
    settings: MangaInDB['meta']['options']
    drawerOpen: boolean,
    expectedLength: number
    currentIndex: number
    showPrevBuffer:boolean
    showNextBuffer:boolean
  }>();

const emit = defineEmits<{
  (eventName: 'showImage', indexes:number[]): void
  (eventName: 'reload', index: number): void
  (eventName: 'loadPrev'):void
  (eventName: 'loadNext'):void
}>();

const storeSettings = useSettingsStore();

const packed = computed(() => {
  const groupOfgroups = [];
  let group = [];
  let count = 0;
  for(const img of props.sources) {
    if(!isChapterImage(img)) {
      group.push(img);
      groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
      count = 0;
      group = [];
      continue;
    }
    if(img.height < img.width)  {
      group.push(img);
      groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
      count = 0;
      group = [];
      continue;
    }
    if(props.settings.bookOffset && img.index === 0) {
      group.push(img);
      groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
      count = 0;
      group = [];
      continue;
    }
    if(!props.settings.longStrip || (props.settings.longStrip && props.settings.longStripDirection === 'vertical' && !props.settings.book)) {
      group.push(img);
      groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
      count = 0;
      group = [];
      continue;
    }
    if(count > 0) {
      group.push(img);
      groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
      count = 0;
      group = [];
    } else {
      group.push(img);
      count++;
      if(img.lastpage) {
        groupOfgroups.push({indexes: group.map(g=>g.index), group: [...group] });
        count = 0;
        group = [];
      }
    }
  }
  return groupOfgroups;
});

const falseArray:false[] = Array(props.expectedLength).fill(false);
/** keep track of images that are loaded */
const loaded = ref<boolean[]>(falseArray);

function intersectionHandler(entry: IntersectionObserverEntry,indexes:number[]) {
  // do not emit if images aren't loaded
  const areLoaded = indexes.every(i => loaded.value[i]);
  if(entry.isIntersecting && areLoaded) {
    emit('showImage', indexes);
  }
}

const verticalNoBook = computed<CSSProperties>(() => {
  let height:CSSProperties['height'] = undefined;
  let width:CSSProperties['width'] = undefined;
  let marginBottom:CSSProperties['marginBottom'] = undefined;
  if(!props.settings.webtoon && props.settings.longStrip) marginBottom = '20px';
  if(props.settings.zoomMode === 'stretch-height') height = ($q.screen.height-82) + 'px';
  if(props.settings.zoomMode === 'stretch-width') width = ($q.screen.width - (props.drawerOpen ? 300 : 0)) + 'px';
  return {
    height,
    width,
    marginBottom,
  };
});

const horizontal = computed<CSSProperties>(() => {
  let maxHeight:CSSProperties['maxHeight'] = ($q.screen.height - 84)+'px';
  let marginBottom:CSSProperties['marginBottom'] = '-6px';
  let height:CSSProperties['height'] = undefined;
  if(props.settings.zoomMode === 'stretch-height') height = ($q.screen.height - 82) + 'px';
  return {
    maxHeight,
    marginBottom,
    height,
  };
});

function prevHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadPrev');
}

function nextHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadNext');
}
</script>
<template>
  <!-- Vertical long strip -->
  <div v-if="props.settings.longStrip && props.settings.longStripDirection === 'vertical'">
    <div
      v-if="showPrevBuffer"
      v-intersection="{ handler: prevHandler, cfg: { threshold: 0.9 } }"
      class="flex center justify-center items-end"
      :style="{ height: ($q.screen.height/1.5)+'px', marginBottom: '15px'}"
    >
      <slot name="prevBuffer" />
    </div>
    <div
      v-for="(image, i) of packed"
      :key="i"
      class="flex center justify-center items-center group"
      :data-group="i"
      :data-indexes="image.indexes"
      :style="{ marginTop: props.settings.webtoon ? '-6px' : undefined, direction : props.settings.rtl ? 'rtl' : 'ltr' }"
    >
      <div
        v-for="(img, ig) of image.group"
        :key="ig"
        v-intersection="{ handler: (i:IntersectionObserverEntry) => intersectionHandler(i, image.indexes), cfg: { threshold: 0.6 } }"
      >
        <img
          v-if="isChapterImage(img)"
          :src="transformIMGurl(img.src, storeSettings)"
          :style="{...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen ? 300 : 0))/image.group.length)+'px' }"
          @load="image.indexes.forEach(i => loaded[i] = true)"
        >
        <div
          v-else
          class="bg-negative flex"
          :style="{...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen ? 300 : 0))/image.group.length)+'px' }"
          @load="image.indexes.forEach(i => loaded[i] = true)"
        >
          <span>
            {{ img.error }}
          </span>
          <span v-if="img.trace">{{ img.trace }}</span>
          <q-btn
            icon="broken_image"
            :label="$t('reader.reloadImage')"
            @click="emit('reload', img.index)"
          />
        </div>
      </div>
    </div>
    <div
      v-if="showNextBuffer"
      v-intersection="{ handler: nextHandler, cfg: { threshold: 0.9 } }"
      class="flex center justify-center items-start"
      :style="{ height: ($q.screen.height/1.5)+'px', marginTop: '15px' }"
    >
      <slot name="nextBuffer" />
    </div>
  </div>
  <!-- Horizontal longstrip -->
  <div
    v-else-if="props.settings.longStrip && props.settings.longStripDirection === 'horizontal'"
    class="row no-wrap"
  >
    <div
      v-if="showPrevBuffer"
      v-intersection="{ handler: prevHandler, cfg: { threshold: 0.9 } }"
      class="row no-wrap items-center justify-end"
      :style="{ width: ($q.screen.width/1.5)+'px', marginLeft: '15px', marginRight: '0px' }"
    >
      <slot
        name="prevBuffer"
      />
    </div>
    <div
      v-for="(image, i) of packed"
      :key="i"
      :data-group="i"
      :data-indexes="image.indexes"
      class="row no-wrap items-center group"
      :style="{ marginLeft: '15px', marginRight: '0px' }"
    >
      <div
        v-for="(img, ig) of image.group"
        :key="ig"
        v-intersection="{ handler: (i:IntersectionObserverEntry) => intersectionHandler(i, image.indexes), cfg: { threshold: 0.6 } }"
      >
        <img
          v-if="isChapterImage(img)"
          :src="transformIMGurl(img.src, storeSettings)"
          :style="horizontal"
          @load="image.indexes.forEach(i => loaded[i] = true)"
        >
        <div
          v-else
          class="bg-negative flex"
          :style="{...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen ? 300 : 0))/image.group.length)+'px' }"
          @load="image.indexes.forEach(i => loaded[i] = true)"
        >
          <span>
            {{ img.error }}
          </span>
          <span v-if="img.trace">{{ img.trace }}</span>
          <q-btn
            icon="broken_image"
            :label="$t('reader.reloadImage')"
            @click="emit('reload', img.index)"
          />
        </div>
      </div>
    </div>
    <div
      v-if="showNextBuffer"
      v-intersection="{ handler: nextHandler, cfg: { threshold: 0.9 } }"
      class="row no-wrap items-center justify-start"
      :style="{ width: ($q.screen.width/1.5)+'px', marginLeft: '15px' }"
    >
      <slot
        name="nextBuffer"
      />
    </div>
  </div>
  <!-- Single page -->
  <div v-else>
    <div
      v-for="(group, i) of packed[currentIndex].group"
      :key="i"
      class="flex flex-center justify-center items-center group"
      :style="{minHeight: ($q.screen.height - 84)+'px'}"
    >
      <img
        v-if="isChapterImage(group)"
        :src="transformIMGurl(group.src, storeSettings)"
        :style="{...verticalNoBook, maxWidth: ($q.screen.width - (drawerOpen ? 300 : 0))+'px'}"
        @load="packed[currentIndex].indexes.forEach(i => loaded[i] = true)"
      >
      <div
        v-else
        class="bg-negative flex"
        :style="{...verticalNoBook, maxWidth: ($q.screen.width - (props.drawerOpen ? 300 : 0))+'px' }"
        @load="packed[currentIndex].indexes.forEach(i => loaded[i] = true)"
      >
        <span>
          {{ group.error }}
        </span>
        <span v-if="group.trace">{{ group.trace }}</span>
        <q-btn
          icon="broken_image"
          :label="$t('reader.reloadImage')"
          @click="emit('reload', group.index)"
        />
      </div>
    </div>
  </div>
</template>
