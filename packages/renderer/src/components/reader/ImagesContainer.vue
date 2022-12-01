<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import { isChapterErrorMessage, isChapterImageErrorMessage } from '@renderer/components/helpers/typechecker';
import type FImg from '@renderer/components/reader/FImg.vue';
import ImageStack from '@renderer/components/reader/ImageStack.vue';
import { QScrollArea, useQuasar } from 'quasar';
import { ref } from 'vue';

const props = defineProps<{
  drawerOpen: boolean,
  chapterId: string,
  chapterURL: string,
  pageIndex: number,
  expectedLength: number,
  imgs: (ChapterImage | ChapterImageErrorMessage)[]
  currentPage: number,
  readerSettings: MangaInDB['meta']['options']
  showPrevBuffer: boolean
  showNextBuffer: boolean
  nextChapterString?: string,
  prevChapterString?: string
}>();

const emit = defineEmits<{
  (event: 'changePage', page: number, chapterId: string): void,
  (event: 'reload', pageIndex:number|undefined, chapterId: string, chapterURL:string, callback:() =>void): void
  (event: 'loadPrev'): void
  (event: 'loadNext'): void
}>();


/** Quasar */
const $q = useQuasar();
/** image-slot template ref */
const imageslot = ref<InstanceType<typeof FImg>[]|null>(null);

/** expose the scrollArea */
const scrollArea = ref<null|QScrollArea>(null);

const imagestack = ref<InstanceType<typeof ImageStack>|null>(null);

defineExpose({
  scrollArea,
  imageslot,
  imagestack,
});



/** is the image reloading? */
const reloading = ref(false);

/** reload a page */
async function reload(pageIndex: number|undefined) {
  const callback = () => {
    reloading.value = false;
  };
  emit('reload', pageIndex, props.chapterId, props.chapterURL, callback);
}

/** emit to parent when page is on screen */
function imageVisibility(indexes:number[]) {
  if(props.readerSettings.longStrip) emit('changePage', Math.max(...indexes), props.chapterId);
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
  <q-scroll-area
    ref="scrollArea"
    :dir="readerSettings.rtl ? 'rtl': 'ltr'"
    :style="`height: ${$q.screen.height-82}px;width: ${$q.screen.width - (drawerOpen ? 300 : 0)}px;`"
    :vertical-thumb-style="{ backgroundColor: '#ff9800', opacity: '1', width: '4px', right:'2px', marginTop: '5px', marginBottom: '5px', borderRadius: '25px'}"
    :vertical-bar-style="{backgroundColor: `${$q.dark.isActive ? '#616161' : '#eeeeee'}`, opacity: '0.8', width: '8px', marginTop: '3px', marginBottom: '3px', borderRadius: '25px' }"
    :horizontal-thumb-style="{ backgroundColor: '#ff9800', opacity: '1', height: '4px', bottom:'2px', marginRight: '5px', marginLeft: '5px', borderRadius: '25px'}"
    :horizontal-bar-style="{backgroundColor: `${$q.dark.isActive ? '#616161' : '#eeeeee'}`, opacity: '0.8', height: '8px', marginLeft: '3px', marginRight: '3px', borderRadius: '25px' }"
  >
    <image-stack
      ref="imagestack"
      :show-next-buffer="showNextBuffer"
      :show-prev-buffer="showPrevBuffer"
      :current-index="currentPage - 1"
      :sources="imgs"
      :drawer-open="drawerOpen"
      :expected-length="expectedLength"
      :settings="readerSettings"
      @load-next="emit('loadNext')"
      @load-prev="emit('loadPrev')"
      @show-image="imageVisibility"
      @reload="reload"
    >
      <template
        #prevBuffer
      >
        <div
          class="flex flex-center"
        >
          <q-icon
            v-if="prevChapterString"
            :name="readerSettings.longStripDirection === 'vertical' ? 'keyboard_double_arrow_up' : readerSettings.rtl ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'"
            size="lg"
            color="negative"
          />
          <span :class="prevChapterString ? '': 'text-negative'">{{ prevChapterString || $t('reader.no_next_to_read') }}</span>
        </div>
      </template>
      <template
        #nextBuffer
      >
        <div
          v-if="nextChapterString"
        >
          <div
            class="flex flex-center"
            :style="{ direction: readerSettings.rtl ? 'rtl' : 'ltr' }"
          >
            <span :class="prevChapterString ? '': 'text-positive'">{{ nextChapterString || $t('reader.no_next_to_read') }}</span>
            <q-icon
              v-if="nextChapterString"
              :name="readerSettings.longStripDirection === 'vertical' ? 'keyboard_double_arrow_down' : readerSettings.rtl ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'"
              size="lg"
              color="positive"
            />
          </div>
        </div>
      </template>
    </image-stack>
  </q-scroll-area>
</template>
