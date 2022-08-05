<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useQuasar, scroll } from 'quasar';
import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import ImageComp from './ImageComp.vue';
import type { ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';

/** quasar */
const $q = useQuasar();
const { getScrollTarget, setVerticalScrollPosition } = scroll;

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
  (event: 'reload', chapterIndex:number, pageIndex:string): void
  (event: 'navigate', chapterIndex:number): void
  (event: 'page-change', payload:{ index: number, from: 'child'}): void
  (event: 'onKey', payload:MouseEvent, imgSize?:number): void
}>();

/** reload a page */
function reload(pageIndex: number) {
  reloaders.value[pageIndex] = true;
  emit('reload', props.chapterSelectedIndex, pageIndex.toString());
}

/** Sates for "reload page" buttons */
const reloaders = ref(Array.from({length: props.nbOfImagesToExpectFromChapter}, () => false));

/** inform parent of current page navigation */
function onIntersection(index:number) {
  emit('page-change', {index, from:'child'});
}

/** scroll to a certain page */
function scrollToPage() {
  const el = document.querySelector<HTMLDivElement>(`#page-${props.currentPage.index}`);
  if(!el) return;
  const target = getScrollTarget(el);
  const offset = el.offsetTop;
  const duration = 350;
  if(target) setVerticalScrollPosition(target, offset, duration);
}

// function shouldPreload(index:number) {
//   if(props.readerSettings.longStrip) {
//     return index === props.currentPage.index || (index >= props.currentPage.index-5 && index <= props.currentPage.index+5);
//   }
//   else return index === props.currentPage.index;
// }

/**
 * watch if the current page has been changed by triggering a "page-change" event
 */
watch(() => props.currentPage, (nval) => {
  if(nval.from === 'parent') {
    scrollToPage();
  }
});
</script>
<template>
  <div
    v-if="props.nbOfImagesToExpectFromChapter > 0"
    tabindex="0"
    class="text-center"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
  >
    <div
      v-for="(img, i) in images"
      :id="'page-'+i"
      :key="i"
    >
      <image-comp
        v-if="(props.readerSettings.longStrip) || (!props.readerSettings.longStrip && i === currentPage.index)"
        :image="img"
        :settings="props.readerSettings"
        :last-page="i === images.length-1"
        @on-display="onIntersection(i)"
        @on-key="(e, imgSize) => emit('onKey', e, imgSize)"
        @reload="reload(i)"
      />
    </div>
    <div
      v-if="props.readerSettings.showPageNumber"
      class="fixed-bottom"
      style="right:300px!important;"
    >
      <q-chip
        color="black"
        text-color="white"
        size="md"
        style="opacity:0.6;"
      >
        {{ props.currentPage.index + 1 }} / {{ props.nbOfImagesToExpectFromChapter }}
      </q-chip>
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
