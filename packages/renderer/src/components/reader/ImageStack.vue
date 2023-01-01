<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isChapterImage } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { colors, scroll, useQuasar } from 'quasar';
import type { CSSProperties } from 'vue';
import { computed, ref } from 'vue';

const $q = useQuasar();
const props = defineProps<{
    dir: 'rtl' | 'ltr'
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

/** header + sub-header size */
const headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
});

const cssVars = computed(() => {
  return {
    '--bg-color': $q.dark.isActive ? colors.getPaletteColor('dark') : colors.getPaletteColor('white'),
    '--bg-color-hover': $q.dark.isActive ? colors.getPaletteColor('grey-9') : colors.getPaletteColor('grey-3'),
    '--bg-color-active': $q.dark.isActive ? colors.getPaletteColor('grey-7') : colors.getPaletteColor('grey-5'),
    '--orange': colors.getPaletteColor('orange'),
    height: ($q.screen.height-headerSize.value)+'px',
    direction: props.dir,
  };
});

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
    if(!props.settings.book) {
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
  if(props.settings.zoomMode === 'stretch-height') height = ($q.screen.height-headerSize.value) + 'px';
  if(props.settings.zoomMode === 'stretch-width') width = ($q.screen.width - (props.drawerOpen ? 300 : 0)) + 'px';
  return {
    height,
    width,
    marginBottom,
  };
});

const horizontal = computed<CSSProperties>(() => {
  let maxHeight:CSSProperties['maxHeight'] = ($q.screen.height - headerSize.value)+'px';
  let marginBottom:CSSProperties['marginBottom'] = '-6px';
  let height:CSSProperties['height'] = undefined;
  if(props.settings.zoomMode === 'stretch-height') height = ($q.screen.height - headerSize.value) + 'px';
  return {
    maxHeight,
    marginBottom,
    height,
  };
});

function prevHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadPrev'); console.log('loadprev');
}

function nextHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadNext');
}

const scrollArea = ref<null|HTMLDivElement>(null);

function getScrollPosition(): {top: number, left:number} {
  if(!scrollArea.value) throw Error('scroll area not init');
  const left = scroll.getHorizontalScrollPosition(scrollArea.value);
  const top = scroll.getVerticalScrollPosition(scrollArea.value);
  return {top, left};
}

function getScrollPercentage(): {top: number, left:number} {
  if(!scrollArea.value) throw Error('scroll area not init');

  const height = Math.max(scrollArea.value.scrollHeight, scrollArea.value.offsetHeight);
  const width = Math.max(scrollArea.value.scrollWidth, scrollArea.value.offsetWidth);
  const posH = scrollArea.value.scrollTop;
  const posW = scrollArea.value.scrollLeft;

  const top = Number((posH / height).toFixed(2));
  const left = Number((posW / width * (props.dir === 'rtl' ? -1 : 1)).toFixed(2));
  return {top, left};
}

function setScrollPercentage(dir: 'horizontal'|'vertical', percentage:number) {
  if(!scrollArea.value) throw Error('scroll area not init');
  if(percentage > 1 || percentage < 0) return;

  if(dir === 'vertical') {
    const height = Math.max(scrollArea.value.scrollHeight, scrollArea.value.offsetHeight);
    const pos = height * percentage;
    scrollArea.value.scrollTop = pos;
  } else {
    const width = Math.max(scrollArea.value.scrollWidth, scrollArea.value.offsetWidth);
    const pos = width * percentage;
    scrollArea.value.scrollLeft = pos;
  }
}

function setScrollPosition(dir: 'horizontal'|'vertical', pos:number) {
  if(!scrollArea.value) throw Error('scroll area not init');
  if(dir === 'horizontal') scrollArea.value.scrollLeft = pos;
  else scrollArea.value.scrollTop = pos;
}

defineExpose({
  getScrollPosition, setScrollPercentage, getScrollPercentage, setScrollPosition, indexes: packed,
});
</script>
<template>
  <div
    ref="scrollArea"
    style="overflow:overlay;"
    :style="cssVars"
    class="scrollarea scroll"
  >
    <!-- Vertical long strip -->
    <div v-if="(!settings.longStrip && settings.book) || (settings.longStrip && settings.longStripDirection === 'vertical')">
      <div
        v-if="showPrevBuffer && settings.longStrip"
        v-intersection="{ handler: prevHandler, cfg: { threshold: 0.9 } }"
        class="flex center justify-center items-end"
        :style="{ height: ($q.screen.height/1.5)+'px', marginBottom: '15px'}"
      >
        <slot name="prevBuffer" />
      </div>
      <div
        v-for="(image, i) of packed"
        :key="i"
      >
        <div
          v-if="(!settings.longStrip && settings.book && image.indexes.includes(currentIndex)) || (settings.longStrip && settings.longStripDirection === 'vertical')"
          v-intersection="{ handler: (i:IntersectionObserverEntry) => intersectionHandler(i, image.indexes), cfg: { threshold: 0.2 } }"
          class="flex center justify-center items-center group"
          :data-group="i"
          :data-indexes="image.indexes"
          :style="{ marginTop: props.settings.webtoon ? '-6px' : undefined, direction : props.settings.rtl ? 'rtl' : 'ltr', minHeight: !settings.longStrip && settings.book ? $q.screen.height-headerSize+'px' : undefined }"
        >
          <div
            v-for="(img, ig) of image.group"
            :key="ig"
          >
            <img
              v-if="isChapterImage(img)"
              class="self-center"
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
      </div>
      <div
        v-if="showNextBuffer && settings.longStrip"
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
        :style="{ minWidth: ($q.screen.width/1.5)+'px', marginLeft: '15px', marginRight: '0px' }"
      >
        <slot

          name="prevBuffer"
        />
      </div>
      <div
        v-for="(image, i) of packed"
        :key="i"
        v-intersection="{ handler: (i:IntersectionObserverEntry) => intersectionHandler(i, image.indexes), cfg: { threshold: 0.2 } }"
        :data-group="i"
        :data-indexes="image.indexes"
        class="row no-wrap items-center group"
        :style="{ marginLeft: settings.webtoon ? undefined : '15px', marginRight: '0px', direction : props.settings.rtl ? 'rtl' : 'ltr' }"
      >
        <div
          v-for="(img, ig) of image.group"
          :key="ig"
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
        :style="{ minWidth: ($q.screen.width/1.5)+'px', marginLeft: '15px' }"
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
        :style="{minHeight: ($q.screen.height - headerSize)+'px'}"
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
  </div>
</template>
<style scoped lang="css">
.scrollarea::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.scrollarea:hover::-webkit-scrollbar {
  width: 10px!important;
  height: 10px!important;
}

.scrollarea::-webkit-scrollbar-button {
  width: 0px;
  height: 0px;
}
::-webkit-scrollbar-thumb {
  background: #e1e1e1;
  border: 0px none #ffffff;
  border-radius: 50px;
  height: 50px;
  width: 50px;
}

.scrollarea::-webkit-scrollbar-thumb {
  background: var(--orange)
}


.scrollarea::-webkit-scrollbar-track {
  background: var(--bg-color);
  border: 0px none #ffffff;
  border-radius: 50px;
}

.scrollarea:hover::-webkit-scrollbar-track {
  background: var(--bg-color-hover);
}

.scrollarea::-webkit-scrollbar-track:active {
  background: var(--bg-color-active)
}

.scrollarea::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
