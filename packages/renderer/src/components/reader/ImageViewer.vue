<script lang="ts" setup>
import { ComponentPublicInstance } from 'vue';
import { ref, computed, watch } from 'vue';
import { useQuasar, scroll } from 'quasar';
import { isChapterImage, isChapterImageErrorMessage } from '../helpers/typechecker';
import { useStore as useSettingsStore } from '/@/store/settings';
import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';

/** quasar */
const $q = useQuasar();
const { getScrollTarget, setVerticalScrollPosition } = scroll;

/** settings */
const settings = useSettingsStore();

/** props */
const props = defineProps<{
  images: (ChapterImage | ChapterImageErrorMessage)[]
  nbOfImagesToExpectFromChapter: number,
  chapterSelectedIndex: number,
  readerSettings: MangaInDB['meta']['options'],
  manga: MangaPage|MangaInDB,
  currentPage: { index:number, from:'child'|'parent' },
}>();

/** emit */
const emit = defineEmits<{
  (event: 'reload', chapterIndex:number, pageIndex:number): void
  (event: 'navigate', chapterIndex:number): void
  (event: 'page-change', payload:{ index: number, from: 'child'}): void
  (event: 'onKey', payload:MouseEvent, imgSize?:number): void
}>();

/** reload a page */
function reload(pageIndex: number) {
  reloaders.value[pageIndex] = true;
  emit('reload', props.chapterSelectedIndex, pageIndex);
}

/** Sates for "reload page" buttons */
const reloaders = ref(Array.from({length: props.nbOfImagesToExpectFromChapter}, () => false));

/** image tempalte refs */
const imgRefs = ref<{ ref:ComponentPublicInstance, id: number }[]>([]);

/** computed css for q-img */
const imageStyle = computed(() => {
  let width = '100%';
  if(props.readerSettings.zoomMode === 'fit-height') width = 'auto';
  else if(props.readerSettings.zoomMode === 'auto') {
    if($q.screen.xs || $q.screen.sm) width = '100%';
    else if($q.screen.md || $q.screen.lg) width = '80%';
    else width = '60%';
  }
  else if(props.readerSettings.zoomMode === 'fit-width') {
    width = '100%';
  }
  else if(props.readerSettings.zoomMode === 'custom') {
    width = `${props.readerSettings.zoomValue}%`;
  }
  return {
    'width': width,
    'margin-left': 'auto',
    'margin-right': 'auto',
  };
});

/** computed height for q-img */
const imageHeight = computed(() => {
  if(props.readerSettings.zoomMode === 'fit-height') {
    if(props.readerSettings.longStrip) return $q.screen.height;
    else return $q.screen.height-82;
  }
  return undefined;
});

/** inform parent of current page navigation */
function onIntersection(i:IntersectionObserverEntry) {
  if(i.isIntersecting && i.target.parentElement) {
    const nb = parseInt(i.target.parentElement.id.replace('page-', ''));
    if(!isNaN(nb)) {
      emit('page-change', {index: nb, from: 'child'});
    }
  }
}

/** scroll to a certain page */
function scrollToPage(forward:boolean) {
  const el = document.querySelector<HTMLDivElement>(`#page-${props.currentPage.index}`);
  if(!el) return;
  const target = getScrollTarget(el);
  const offset = el.offsetTop + (forward ? 82 : 0);
  const duration = 350;
  if(target) setVerticalScrollPosition(target, offset, duration);
}

function shouldPreload(index:number) {
  if(props.readerSettings.longStrip) {
    return index === props.currentPage.index || (index >= props.currentPage.index-3 && index <= props.currentPage.index+3);
  }
  else return index === props.currentPage.index;
}
/** copy to clipboard for electron users */
function copyToClipboard(src: string) {
  if(!window.apiServer) return;
  window.apiServer.copyImageToClipboard(src);
}

function findSource(src: string) {
  if(window.apiServer) {
    const protocol = settings.server.ssl === 'false' ? 'http' : 'https';
    return `${protocol}://127.0.0.1:${settings.server.port}${src}`;
  }
  return src;
}

/**
 * watch if the current page has been changed by triggering a "page-change" event
 */
watch(() => props.currentPage, (nval, oldval) => {
  const forward = nval.index > oldval.index;
  if(nval.from === 'parent') {
    scrollToPage(forward);
  }
});
</script>
<template>
  <div
    v-if="props.nbOfImagesToExpectFromChapter > 0"
    ref="content"
    tabindex="0"
    class="text-center"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
  >
    <div
      v-for="(img, i) in images"
      :id="'page-'+i"
      :key="i"
      :style="{
        'margin-bottom': props.readerSettings.webtoon
          || !props.readerSettings.longStrip
          || (props.readerSettings.longStrip && i === (images.length-1))
          ? '0' : '20px'
      }"
    >
      <q-img
        v-show="props.readerSettings.longStrip ? true : i === props.currentPage.index"
        :ref="(el) => el !== null ? imgRefs.push({ref: el as ComponentPublicInstance, id: i}) : undefined"
        v-intersection="{ handler: onIntersection, cfg: { threshold: 0.6 } }"
        :src="img && !isChapterImageErrorMessage(img) && isChapterImage(img) && shouldPreload(i) ? findSource(img.src) : 'undefined'"
        :style="props.readerSettings.zoomMode === 'fit-height' ? undefined : imageStyle"
        :height="imageHeight ? imageHeight + 'px': undefined"
        :fit="props.readerSettings.zoomMode === 'fit-height' ? 'scale-down' : undefined"
        @click="emit('onKey', $event, imgRefs.find(r => r.id === i)?.ref.$el.clientWidth)"
      >
        <template #error>
          <div
            v-if="isChapterImageErrorMessage(img)"
            class="absolute-full flex flex-center bg-negative text-white"
          >
            <div>
              <q-btn
                icon-right="broken_image"
                :loading="reloaders[img.index]"
                color="white"
                text-color="black"
                @click="reload(img.index)"
              >
                {{ $t('reader.reload') }}
              </q-btn>
              <div
                class="text-center"
              >
                {{ img.error }}
              </div>
            </div>
          </div>
          <div
            v-else
            class="absolute-full flex flex-center bg-dark text-white"
          >
            <div class="flex column items-center">
              <q-spinner-box
                size="10em"
                color="orange"
              />
            </div>
          </div>
        </template>
        <q-menu
          v-if="isChapterImage(img) && $q.platform.is.electron"
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
              @click="copyToClipboard(img.src)"
            >
              <q-item-section>{{ $t('reader.copytoclipboard') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-img>
    </div>
  </div>
  <div
    v-else
    class="absolute-full flex flex-center bg-dark text-white"
  >
    <div class="flex column items-center">
      <q-spinner-radio
        size="10em"
        color="orange"
      />
    </div>
  </div>
</template>
