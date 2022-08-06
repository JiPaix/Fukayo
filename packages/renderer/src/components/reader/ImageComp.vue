<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { isChapterImage, isChapterImageErrorMessage } from '../helpers/typechecker';
import type { ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
import { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { MangaInDB } from '../../../../api/src/models/types/manga';

/** props */
const props = defineProps<{
  image: ChapterImage | ChapterImageErrorMessage
  settings: MangaInDB['meta']['options']
  lastPage: boolean
}>();

/** emit */
const emit = defineEmits<{
  (event: 'onDisplay'): void
  (event: 'reload'): void
  (event: 'onKey', payload:MouseEvent, imgSize?:number): void
  (event: 'copy-to-clipboard', payload:string): void
}>();

/** quasar */
const $q = useQuasar();
/** image tempalte ref */
const img = ref<HTMLDivElement>();
/** error loading image */
const error = ref(false);
/** reload spinner */
const reloading = ref(false);

const style = computed(() => {
  const base = {
    'vertical-align': 'middle',
    'margin-bottom': '20px',
    'width': 'auto',
    'height': 'auto',
    'padding-right': '0',
    'padding-left': '0',
  };

  if(props.lastPage) base['margin-bottom'] = '0px';
  if(props.settings.webtoon) base['margin-bottom'] = '0px';
  if(!props.settings.longStrip) base['margin-bottom'] = '0px';

  if(props.settings.zoomMode === 'custom') {
    base['width'] = `${props.settings.zoomValue}%`;
    base['height'] = 'auto';
  }

  if(props.settings.zoomMode === 'fit-height') {
    base['width'] = 'auto';
    base['height'] = `${$q.screen.height-82}px`; // size of screen - header height
  }

  if(props.settings.zoomMode === 'fit-width') {
    base['width'] = '100%';
    base['height'] = 'auto';
  }

  if(props.settings.zoomMode === 'auto') {
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

function errorHandler() {
  error.value = true;
  reloading.value = false;
  setTimeout(() => {
    reloading.value = false;
  }, 15000);
}

function loadHandler() {
  error.value = false;
  reloading.value = false;
}
function onIntersection(i: IntersectionObserverEntry) {
  if(i.isIntersecting) {
    emit('onDisplay');
  }
}

</script>

<template>
  <div
    ref="img"
    @click="emit('onKey', $event, img?.clientWidth)"
  >
    <div
      v-if="isChapterImage(image) && !error"
    >
      <img
        v-intersection="{ handler: onIntersection, cfg: { threshold: 0.5 } }"
        :src="image.src"
        :style="style"
        @error="errorHandler"
        @load="loadHandler"
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
            @click="emit('copy-to-clipboard', (image as ChapterImage).src)"
          >
            <q-item-section>{{ $t('reader.copytoclipboard') }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </div>
    <div
      v-if="isChapterImageErrorMessage(image) || error"
      class="flex flex-center bg-negative text-white"
      :style="'min-height: ' + ($q.screen.height-82)+ 'px'"
    >
      <div>
        <q-btn
          icon-right="broken_image"
          :loading="reloading"
          color="white"
          text-color="black"
          @click="reloading = true;emit('reload')"
        >
          {{ $t('reader.reload') }}
        </q-btn>
        <div
          v-if="isChapterImageErrorMessage(image)"
          class="text-center"
        >
          {{ image.error }}
        </div>
      </div>
    </div>
  </div>
</template>
