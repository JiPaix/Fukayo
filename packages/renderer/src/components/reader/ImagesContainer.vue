<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB } from '@api/models/types/manga';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { isChapterErrorMessage, isChapterImageErrorMessage } from '@renderer/components/helpers/typechecker';
import type FImg from '@renderer/components/reader/FImg.vue';
import ImageStack from '@renderer/components/reader/ImageStack.vue';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
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
  showMobileOverlayHint: boolean
}>();

/** emits */
const emit = defineEmits<{
  (event: 'progress', percentage:number):void,
  (event: 'progressError'):void,
  (event: 'changePage', page: number, chapterId: string): void,
  (event: 'reload', pageIndex:number, chapterId: string, callback:() =>void): void
  (event: 'loadPrev'): void
  (event: 'loadNext'): void
  (event: 'toggleDrawer'):void
  (event: 'scrollToNextPage'):void
  (event: 'scrollToPrevPage'):void
}>();

// settings
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// states
const
/** image-slot template ref */
imageslot = ref<InstanceType<typeof FImg>[]|null>(null),
/** image-stack template ref */
imagestack = ref<InstanceType<typeof ImageStack>|null>(null);

/** reload a page */
function reload(pageIndex: number, callback:() => void) {
  emit('reload', pageIndex, props.chapterId, callback);
}

/** emit to parent when page is on screen */
function imageVisibility(indexes:number[]) {
  if(props.readerSettings.longStrip) emit('changePage', Math.max(...indexes), props.chapterId);
}

/** emit progress while props.imgs is filled */
watch(() => props.imgs, (nval) => {
    emit('progress', nval.length/props.expectedLength);
    if(nval.some(img => isChapterErrorMessage(img) || isChapterImageErrorMessage(img))) emit('progressError');
}, { deep: true });

/** exported members */
defineExpose({
  imageslot,
  imagestack,
});
</script>

<template>
  <image-stack
    ref="imagestack"
    :dir="readerSettings.rtl ? 'rtl' : 'ltr'"
    :show-next-buffer="showNextBuffer"
    :show-prev-buffer="showPrevBuffer"
    :current-index="currentPage - 1"
    :sources="imgs"
    :drawer-open="drawerOpen"
    :expected-length="expectedLength"
    :settings="readerSettings"
    :show-mobile-overlay-hint="showMobileOverlayHint"
    @load-next="() => emit('loadNext')"
    @load-prev="() => emit('loadPrev')"
    @toggle-drawer="() => emit('toggleDrawer')"
    @scroll-to-next-page="() => emit('scrollToNextPage')"
    @scroll-to-prev-page="() => emit('scrollToPrevPage')"
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
        <span :class="prevChapterString ? '': 'text-negative'">{{ prevChapterString || $t('reader.no_prev_to_read') }}</span>
      </div>
    </template>
    <template
      #nextBuffer
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
    </template>
  </image-stack>
</template>
