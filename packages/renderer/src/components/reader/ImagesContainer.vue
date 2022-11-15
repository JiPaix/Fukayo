<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { isChapterErrorMessage, isChapterImage, isChapterImageErrorMessage } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { QVirtualScroll, scroll, useQuasar } from 'quasar';
import { computed, nextTick, onBeforeMount, onBeforeUnmount, ref } from 'vue';

const props = defineProps<{
  chapterId: string,
  chapterURL: string,
  pageIndex: number,
  expectedLength: number,
  imgs: (ChapterImage | ChapterImageErrorMessage)[]
  currentPage: number,
  readerSettings: MangaInDB['meta']['options']
  nextChapterString?: string,
  prevChapterString?: string
}>();

const emit = defineEmits<{
  (event: 'changePage', page: number, chapterId: string): void,
  (event: 'reload', pageIndex:number|undefined, chapterId: string, chapterURL:string, callback:() =>void): void
  (event: 'loadPrev'): void
  (event: 'loadNext'): void
}>();

const virtscroll = ref<null|QVirtualScroll>(null);

defineExpose({virtscroll});

const $q = useQuasar();
const settings = useSettingsStore();

/** make sure we get the right url */
function transformIMGurl(url: string) {
  // return the url as is if it's external (http, https)
  if(url.startsWith('http') || url.startsWith('https')) return url;
  // remove leading slash if it's present
  if(url.startsWith('/')) url = url.substring(1);
  // in dev mode the protocol and port of the file server are different from the current page
  if(import.meta.env.PROD) return `/${url}`;
  return `${settings.server.ssl === 'false' ? 'http' : 'https'}://${location.hostname}:${settings.server.port}/${url}`;
}
function imageVisibility(imageIndex:number) {
  if(props.readerSettings.longStrip) emit('changePage', imageIndex, props.chapterId);
}

const style = computed(() => {
  const base = {
    'height': 'auto',
    'width': 'auto',
    'max-width': 'auto',
    'max-height': 'auto',
    'padding': '0',
    'margin-top': '30px',
    'margin-left': '0',
    'vertical-align': 'middle',
  };

  if(!props.readerSettings.longStrip) base['margin-top'] = '0px';

  if(props.readerSettings.longStrip && props.readerSettings.longStripDirection === 'horizontal') {
    base['margin-top'] = '0px';
    base['width'] = 'auto';
    base['height'] = `${$q.screen.height-82-15}px`; //=> -15 to hide to scroll bar
    base['margin-left'] = '30px';


    if(props.readerSettings.zoomMode === 'fit-height') {
      base['width'] = 'auto';
      base['max-width'] = '100%';
      base['max-height'] = `${$q.screen.height-82}px`; // size of screen - header height
    }

    if(props.readerSettings.zoomMode === 'auto') {
      if($q.screen.xl || $q.screen.lg) {
        base['padding'] = '5%';
      }
      if($q.screen.md) {
        base['padding'] = '2%';
      }
      if($q.screen.sm || $q.screen.xs) {
        base['padding'] = '0';
      }
    }
    if(props.readerSettings.webtoon) base['margin-left'] = '0';
    return base;
  }

  if(props.readerSettings.webtoon) base['margin-top'] = '0px';
  if(props.readerSettings.zoomMode === 'custom') {
    base['width'] = `${props.readerSettings.zoomValue}%`;
    base['height'] = 'auto';
  }
  if(props.readerSettings.zoomMode === 'fit-height') {
    base['width'] = 'auto';
    base['max-width'] = '100%';
    base['max-height'] = `${$q.screen.height-82}px`; // size of screen - header height
  }
  if(props.readerSettings.zoomMode === 'fit-width') {
    base['width'] = '100%';
    base['height'] = 'auto';
  }
  if(props.readerSettings.zoomMode === 'auto') {
    base['width'] = '80%';
    base['height'] = '80%';
    if($q.screen.md) {
      base['width'] = '95%';
      base['height'] = '95%';
    }
    if($q.screen.sm || $q.screen.xs) {
      base['width'] = '100%';
      base['height'] = '100%';
    }
  }
  return base;
});

const firstPageStyle = computed(() => {
  return { ...style.value,  'margin-top': '0px', 'margin-left': '0' };
});

const reloading = ref(false);

async function reload(pageIndex: number|undefined) {
  const callback = () => {
    reloading.value = false;
  };
  emit('reload', pageIndex, props.chapterId, props.chapterURL, callback);
}

const showPrevBuffer = ref(false);
const showNextBuffer = ref(false);

function listenScrollBeyondPage(detail: WheelEvent) {
  if(!props.readerSettings.longStrip) return;
  const hdiv = virtscroll.value;
  const vdiv = document.querySelector('.fit.scroll.chapters');
  if(!hdiv || !vdiv) return console.log('no div');
  const vpos = scroll.getVerticalScrollPosition(vdiv);
  const hpos = scroll.getHorizontalScrollPosition(hdiv.$el) + scroll.getScrollbarWidth();
  const vsize = scroll.getScrollHeight(vdiv) - vdiv.clientHeight;
  const hsize = scroll.getScrollWidth(hdiv.$el) - (hdiv.$el as HTMLElement).clientWidth;
  let isNext = false;
  let isPrev = false;
  if(props.readerSettings.longStripDirection === 'horizontal') {
    if(props.readerSettings.rtl) {
      isPrev = hpos + detail.deltaY > 0;
      isNext = (hpos*-1) - detail.deltaY > hsize;
    } else {
      isPrev = hpos + detail.deltaY < 0;
      isNext = hpos + detail.deltaY > hsize;
    }
  } else {
    isPrev = vpos + detail.deltaY < 0;
    isNext = vpos + detail.deltaY > vsize;
  }
  const initialHeight = vdiv.scrollHeight;
  const initialWidth = hdiv.$el.scrollWidth;

  console.log({hpos});
  if(!isNext && !isPrev) return;
  if((isPrev && showPrevBuffer.value) || (isNext && showNextBuffer.value)) return load(isPrev, isNext);
  if(isPrev && !showPrevBuffer.value) showPrevBuffer.value = true;
  if(isNext && !showNextBuffer.value) showNextBuffer.value = true;


  nextTick(() => {
    console.log('troll');
    if(props.readerSettings.longStripDirection === 'horizontal') {
      if(isPrev && !props.readerSettings.rtl) {
        hdiv.$el.scrollTo({left: (hdiv.$el.scrollWidth - initialWidth)});
        return;
      }
      if(isPrev && props.readerSettings.rtl) {
        const prevdiv = document.querySelector('#prevBuffer');
        if(!prevdiv) return console.log('not foudn');
        // console.log(prevdiv.clientWidth);
        hdiv.$el.scrollTo({left: 0 - prevdiv.clientWidth });
        return;
      }
    }
    if(isPrev) return vdiv.scrollTop = vdiv.scrollHeight - initialHeight;

  });
}

function load(isPrev:boolean, isNext:boolean) {
  console.log('EMIT', isPrev ? 'loadPrev':'', isNext ? 'loadNext': '');
  if(isPrev) emit('loadPrev');
  else if(isNext) emit('loadNext');
  else return;
}

onBeforeMount(() => {
  window.addEventListener('wheel', listenScrollBeyondPage);
});

onBeforeUnmount(() => {
  window.removeEventListener('wheel', listenScrollBeyondPage);
});
</script>

<template>
  <q-linear-progress
    v-if="imgs.length !== expectedLength"
    :dark="$q.dark.isActive"
    class="fixed-bottom"
    style="margin-left: 0;"
    size="4px"
    :color="imgs.some(img => isChapterErrorMessage(img) || isChapterImageErrorMessage(img)) ? 'negative' : 'positive'"
    :value="imgs.length/expectedLength"
    animation-speed="500"
  />

  <q-virtual-scroll
    ref="virtscroll"
    v-slot="{ item }"
    :dir="props.readerSettings.longStrip && props.readerSettings.longStripDirection === 'horizontal' && props.readerSettings.rtl ? 'rtl':'ltr'"
    :items="imgs"
    :virtual-scroll-horizontal="props.readerSettings.longStrip && props.readerSettings.longStripDirection === 'horizontal'"
    :items-size="props.imgs.length"
  >
    <!-- previous chapter buffer: LTR + Long Strip (both direction) -->
    <div
      v-if="showPrevBuffer && item.index === 0 && props.readerSettings.longStrip"
      id="prevBuffer"
      :class="props.readerSettings.longStripDirection === 'horizontal' ? `${props.readerSettings.rtl ? 'text-left q-ml-lg self-center' : 'text-right q-mr-lg self-center'}`: 'q-mt-auto q-mb-sm items-end justify-center flex'"
      :style="props.readerSettings.longStripDirection === 'horizontal' ? `width:${$q.screen.width}px;` : `height:${$q.screen.height+82}px;`"
    >
      <div
        v-if="props.readerSettings.longStripDirection !== 'horizontal'"
        class="flex flex-center"
      >
        <q-icon
          v-if="props.prevChapterString"
          name="keyboard_double_arrow_up"
          size="lg"
          color="negative"
        />
        <span :class="props.prevChapterString ? '': 'text-negative'">{{ props.prevChapterString || $t('reader.no_prev_to_read') }}</span>
      </div>
      <div
        v-else
      >
        <span :class="props.prevChapterString ? '': 'text-negative'">{{ props.prevChapterString || $t('reader.no_prev_to_read') }}</span>
        <q-icon
          v-if="props.prevChapterString"
          :name="props.readerSettings.rtl ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'"
          size="lg"
          color="negative"
        />
      </div>
    </div>
    <div
      :id="`#page-${item.index+1}`"
      :ref="`page-${item.index+1}`"
      v-intersection="{ cfg: { threshold: 0.3 }, handler: (i:IntersectionObserverEntry) => i.isIntersecting ? imageVisibility(item.index) : null }"
    >
      <div v-if="!props.readerSettings.longStrip && currentPage === item.index+1 || props.readerSettings.longStrip">
        <div v-if="isChapterImageErrorMessage(item)">
          <div
            class="bg-negative flex flex-center"
            :style="`height:${$q.screen.height-82}px;width:100%;`"
            @click="reload(item.index)"
          >
            {{ $t('reader.reloadImage') }}
          </div>
        </div>
        <div v-else-if="isChapterImage(item)">
          <div
            class="flex flex-center"
            :class="readerSettings.zoomMode ? 'q-ml-auto q-mr-auto' : undefined"
            :style="readerSettings.zoomMode ? { width: style.width } : undefined"
          >
            <img
              :src="transformIMGurl(item.src)"
              :style="item.index === 0 ? firstPageStyle : style"
              loading="lazy"
            >
            <q-menu
              v-if="$q.platform.is.electron"
              touch-position
              context-menu
            >
              <q-list
                dense
                style="min-width: 100px"
              >
                <q-item
                  v-close-popup
                  clickable
                >
                  <q-item-section>{{ $t('reader.copytoclipboard') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </div>
        </div>
      </div>
    </div>
    <!-- next chapter buffer: LTR + Long Strip (both direction) -->
    <div
      v-if="showNextBuffer && item.index === expectedLength-1 && props.readerSettings.longStrip"
      :class="props.readerSettings.longStripDirection === 'horizontal' ? `${props.readerSettings.rtl ? 'text-right q-mr-lg self-center' : 'text-left q-ml-lg self-center'}`: 'q-mt-auto q-mb-sm items-start justify-center flex'"
      :style="props.readerSettings.longStripDirection === 'horizontal' ? `width:${$q.screen.width}px;` : `height:${$q.screen.height+82}px;`"
    >
      <div
        v-if="props.readerSettings.longStripDirection !== 'horizontal'"
        class="flex flex-center"
      >
        <q-icon
          v-if="props.nextChapterString"
          name="keyboard_double_arrow_down"
          size="lg"
          color="positive"
        />
        <span :class="props.prevChapterString ? '': 'text-positive'">{{ props.nextChapterString || $t('reader.no_next_to_read') }}</span>
      </div>
      <div
        v-else
      >
        <q-icon
          v-if="props.nextChapterString"
          :name="props.readerSettings.rtl ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'"
          size="lg"
          color="positive"
        />
        <span :class="props.prevChapterString ? '': 'text-positive'">{{ props.nextChapterString || $t('reader.no_next_to_read') }}</span>
      </div>
    </div>
  </q-virtual-scroll>
</template>
