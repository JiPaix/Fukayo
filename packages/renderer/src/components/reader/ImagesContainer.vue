<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { isChapterErrorMessage, isChapterImage, isChapterImageErrorMessage } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';

const props = defineProps<{
  chapterId: string,
  chapterURL: string,
  index: number,
  expectedLength: number,
  imgs: (ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage)[]
  currentPage: number,
  readerSettings: MangaInDB['meta']['options']
}>();

const emit = defineEmits<{
  (event: 'changePage', page: number, chapterId: string): void,
  (event: 'reload', pageIndex:number, chapterId: string, chapterURL:string, callback:() =>void): void
}>();

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

// function getDelta(imageIndex:number) {
//   const pageIndex = props.currentPage - 1;
//   const delta = pageIndex - imageIndex;
//   if((delta < 0 && delta >= -5) || (delta > 0 && delta <= 5)) return true;
//   return false;
// }

function imageVisibility(imageIndex:number) {
  emit('changePage', imageIndex, props.chapterId);
}

const style = computed(() => {
  const base = {
    'vertical-align': 'middle',
    'margin-top': '30px',
    'width': 'auto',
    'height': 'auto',
    'padding-right': '0',
    'padding-left': '0',
  };

  if(props.readerSettings.webtoon) base['margin-top'] = '0px';
  if(props.readerSettings.zoomMode === 'custom') {
    base['width'] = `${props.readerSettings.zoomValue}%`;
    base['height'] = 'auto';
  }
  if(props.readerSettings.zoomMode === 'fit-height') {
    base['width'] = 'auto';
    base['height'] = `${$q.screen.height-82}px`; // size of screen - header height
  }
  if(props.readerSettings.zoomMode === 'fit-width') {
    base['width'] = '100%';
    base['height'] = 'auto';
  }
  if(props.readerSettings.zoomMode === 'auto') {
    base['width'] = '100%';
    base['height'] = 'auto';
    if($q.screen.xl || $q.screen.lg) {
      base['padding-left'] = '10%';
      base['padding-right'] = '10%';
    }
    if($q.screen.md) {
      base['padding-left'] = '5%';
      base['padding-right'] = '5%';
    }
    if($q.screen.sm || $q.screen.xs) {
      base['padding-left'] = '0';
      base['padding-right'] = '0';
    }
  }
  return base;
});

const firstPageStyle = computed(() => {
  return { ...style.value,  'margin-top': '0px' };
});

const reloading = ref(false);

async function reload(pageIndex: number) {
  const callback = () => {
    reloading.value = false;
  };
  emit('reload', pageIndex, props.chapterId, props.chapterURL, callback);
}
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
  <div
    v-for="(img, j) in imgs"
    :id="`page-${j+1}`"
    :key="j"
    v-intersection="{ cfg: { threshold: 0.3 }, handler: (i:IntersectionObserverEntry) => i.isIntersecting ? imageVisibility(j) : null }"
  >
    <div v-if="isChapterImageErrorMessage(img)">
      <div
        class="bg-negative flex flex-center"
        :style="`height:${$q.screen.height-82}px;width:100%;`"
      >
        IMAGE ERROR PLEASE RELOAD
      </div>
    </div>
    <div v-else-if="isChapterImage(img)">
      <div
        class="flex flex-center"
      >
        <img
          :src="transformIMGurl(img.src)"
          :style="j === 0 ? firstPageStyle : style"
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
    <div v-else>
      <div
        class="flex flex-column flex-center"
      >
        <q-btn
          icon-right="broken_image"
          :loading="reloading"
          color="white"
          text-color="black"
          @click="reload(j)"
        >
          {{ $t('reader.reload') }}
        </q-btn>
        <div>
          {{ img.error }}
        </div>
      </div>
    </div>
  </div>
</template>
