<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isChapterImage } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { colors, QScrollArea, useQuasar } from 'quasar';
import type { CSSProperties} from 'vue';
import { computed, ref } from 'vue';
import NavOverlay from '@renderer/components/reader/NavOverlay.vue';

/** props */
const props = defineProps<{
    dir: 'rtl' | 'ltr'
    sources: (ChapterImage|ChapterImageErrorMessage)[]
    settings: MangaInDB['meta']['options']
    drawerOpen: boolean,
    expectedLength: number
    currentIndex: number
    showPrevBuffer:boolean
    showNextBuffer:boolean
    showMobileOverlayHint:boolean
  }>();
/** emits */
const emit = defineEmits<{
  (eventName: 'showImage', indexes:number[]): void
  (eventName: 'reload', index: number): void
  (eventName: 'loadPrev'):void
  (eventName: 'loadNext'):void
  (eventName: 'toggleDrawer'):void
  (eventName: 'scrollToNextPage'):void
  (eventName: 'scrollToPrevPage'):void
  (eventName: 'showPrevBuffer'):void
  (eventName: 'showNextBuffer'):void
}>();
/** quasar */
const $q = useQuasar();
/** user's settings */
const storeSettings = useSettingsStore();

/** QScrollArea template ref */
const scrollArea = ref<InstanceType<typeof QScrollArea>>();

/** header + sub-header size */
const headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
});

/** QScrollArea CSS */
const cssVars = computed(() => {
  return {
    '--bg-color': $q.dark.isActive ? colors.getPaletteColor('dark') : colors.getPaletteColor('white'),
    '--bg-color-hover': $q.dark.isActive ? colors.getPaletteColor('grey-9') : colors.getPaletteColor('grey-3'),
    '--bg-color-active': $q.dark.isActive ? colors.getPaletteColor('grey-7') : colors.getPaletteColor('grey-5'),
    '--orange': colors.getPaletteColor('orange'),
    height: ($q.screen.height-headerSize.value)+'px',
  };
});

/** Images grouped in set of 2's, or 1's if their width > height */
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

/** emit which image is on screen */
function intersectionHandler(entry: IntersectionObserverEntry,indexes:number[]) {
  // do not emit if images aren't loaded
  const areLoaded = indexes.every(i => loaded.value[i]);
  if(entry.isIntersecting && areLoaded) {
    emit('showImage', indexes);
  }
}

/** img CSS for vertical display (book mode disabled) */
const verticalNoBook = computed<CSSProperties>(() => {
  let height:CSSProperties['height'] = undefined;
  let width:CSSProperties['width'] = undefined;
  let marginBottom:CSSProperties['marginBottom'] = undefined;
  if(!props.settings.webtoon && props.settings.longStrip) marginBottom = '20px';
  if(props.settings.zoomMode === 'stretch-height') height = ($q.screen.height-headerSize.value) + 'px';
  if(props.settings.zoomMode === 'stretch-width') width = ($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0)) + 'px';
  return {
    height,
    width,
    marginBottom,
  };
});

/** img CSS for horizontal display */
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

/** emit "load previous chapter" event */
function prevHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadPrev');
}

/** emit "load next chapter" event */
function nextHandler(entry: IntersectionObserverEntry) {
  if(entry.isIntersecting) emit('loadNext');
}

/** refactor of QScrollArea.getScrollPosition */
function getScrollPosition(): {top: number, left:number} {
  if(!scrollArea.value) throw Error('scroll area not init');
  const { top, left } = scrollArea.value.getScrollPosition();
  return {top, left};
}
/** refactor of QScrollArea.getScrollPercentage */
function getScrollPercentage(): {top: number, left:number} {
  if(!scrollArea.value) throw Error('scroll area not init');

  let { top, left } = scrollArea.value.getScrollPercentage();
  if(props.dir === 'rtl') left = left*-1;
  return {top, left};
}
/** refactor of QScrollArea.setScrollPercentage */
function setScrollPercentage(dir: 'horizontal'|'vertical', percentage:number) {
  if(!scrollArea.value) throw Error('scroll area not init');
  if(percentage > 1 || percentage < 0) return;

  scrollArea.value.setScrollPercentage(dir, percentage);
}
/** refactor of QScrollArea.setScrollPosition */
function setScrollPosition(dir: 'horizontal'|'vertical', pos:number) {
  if(!scrollArea.value) throw Error('scroll area not init');
  scrollArea.value.setScrollPosition(dir, pos);
}

/** mark group's images as loaded */
function onLoaded(i: number[]) {
  i.forEach(i => loaded.value[i] = true);
}

/** exported members */
defineExpose({
  getScrollPosition, setScrollPercentage, getScrollPercentage, setScrollPosition, indexes: packed,
});

/** dirty trick so RTL+HORIZONTAL isn't messed-up (blank images) */
function groupIntersection() {
  if(!scrollArea.value) return;
  const newVal = ($q.screen.height-headerSize.value-50)+'px';
  (scrollArea.value.$el as HTMLElement).style.height = newVal;
  //=> force re-render & does not apply new height
}

/** touch tracking */
let touchTrack = {screenY: 0, screenX: 0 };
/** update touch tracking */
function setTouch(ev:TouchEvent) {
  touchTrack.screenX = ev.touches[0].screenX;
  touchTrack.screenY = ev.touches[0].screenY;
}
/** reset touch tracking */
function resetTouch() {
  touchTrack.screenX = 0;
  touchTrack.screenY = 0;
}
/** update touch tracking and scroll accordingly (this doesn't simulate natural swiping but is good enough) */
function touch(ev:TouchEvent) {
  if(!scrollArea.value) return;

  const current = ev.changedTouches[0];
  const {left, top} = scrollArea.value.getScrollPosition();

  const addX = (touchTrack.screenX - current.screenX)*2;
  scrollArea.value.setScrollPosition('horizontal', left+addX);

  const addY = (touchTrack.screenY - current.screenY)*2;
  scrollArea.value.setScrollPosition('vertical', top+addY);

  touchTrack.screenX = current.screenX;
  touchTrack.screenY = current.screenY;
}
</script>
<template>
  <q-scroll-area
    ref="scrollArea"
    :style="cssVars"
    :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
    :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
    :dir="settings.rtl ? 'rtl' : 'ltr'"
    :visible="false"
  >
    <nav-overlay
      v-if="settings.overlay"
      :hint-color="settings.overlay ? $q.dark.isActive ? 'warning' : 'dark' : undefined"
      :mobile-hint="showMobileOverlayHint"
      :drawer-open="drawerOpen"
      :rtl="settings.rtl"
      position="left"
      @next-page="emit('scrollToNextPage')"
      @prev-page="emit('scrollToPrevPage')"
      @show-menu="emit('toggleDrawer')"
      @touchstart="setTouch"
      @touchmove="touch"
      @touchend="resetTouch"
    />
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
              :style="{ ...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0))/image.group.length)+'px' }"
              loading="lazy"
              @load="image.indexes.forEach(i => loaded[i] = true)"
            >
            <div
              v-else
              class="bg-negative flex"
              :style="{...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0))/image.group.length)+'px' }"
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
      :dir="settings.rtl ? 'rtl' : 'ltr'"
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
          v-intersection="{ handler: groupIntersection, cfg: { threshold: 0.2 } }"
        >
          <img
            v-if="isChapterImage(img)"
            :key="`${ig}-image`"
            :src="transformIMGurl(img.src, storeSettings)"
            :style="{ ...horizontal }"
            loading="lazy"
            @load="onLoaded(image.indexes)"
          >
          <div
            v-else
            :key="`${ig}-error`"
            class="bg-negative flex"
            :style="{...verticalNoBook, maxWidth: (($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0))/image.group.length)+'px' }"
            @load="onLoaded(image.indexes)"
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
          :style="{...verticalNoBook, maxWidth: ($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0))+'px' }"
          loading="lazy"
          @load="packed[currentIndex].indexes.forEach(i => loaded[i] = true)"
        >
        <div
          v-else
          class="bg-negative flex"
          :style="{...verticalNoBook, maxWidth: ($q.screen.width - (props.drawerOpen && $q.screen.gt.sm ? 300 : 0))+'px' }"
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
  </q-scroll-area>
</template>

