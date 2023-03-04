<script setup lang="ts">
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterImageErrorMessage } from '@api/models/types/errors';
import { isChapterImage } from '../helpers/typechecker';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { nextTick, ref } from 'vue';
import { QScrollArea } from 'quasar';

const props = defineProps<{
  images:(ChapterImage | ChapterImageErrorMessage)[]
  rtl: boolean
  chapterId: string
}>();

const emit = defineEmits<{
  (eventName: 'scrollToPage', page:number): void
  (event: 'reload', pageIndex:number, chapterId: string, callback:() =>void): void
}>();

// settings
const
/** settings store */
settings = useSettingsStore();

// globals
const
reloadingArray:false[]= Array(props.images.length).fill(false),
reloading = ref<boolean[]>(reloadingArray);

const scrollarea = ref<QScrollArea|null>();

function hoverIN(ev:MouseEvent) {
  const div = ev.target as HTMLDivElement;
  const span = div.children[0]?.children[0];

  div.style.backgroundColor = '#ff9800';
  span.classList.add('text-white');
  span.classList.remove('text-black');
}

function hoverOUT(ev:MouseEvent) {
  const div = ev.target as HTMLDivElement;
  const span = div.children[0]?.children[0];

  div.style.backgroundColor = 'rgba(255,180,0, 0.5)';
  span.classList.add('text-black');
  span.classList.remove('text-white');
}


function scrollTo(index:number) {
  nextTick().then(() => {
    document.querySelector(`#thumb-${index}`)?.scrollIntoView(true);
  });
}

function getScrollPosition() {
  if(!scrollarea.value) return { left: 0, top:0 };
  return scrollarea.value.getScrollPosition();
}

function setScrollPosition(axis: 'horizontal' | 'vertical', offset: number, duration?:number) {
  if(!scrollarea.value) return;
  return scrollarea.value.setScrollPosition(axis, offset, duration);
}

function reload(index:number) {
  reloading.value[index] = true;
  emit('reload', index, props.chapterId, () => {
    console.log('im done');
    reloading.value[index] = false;
  });
}
defineExpose({ scrollTo, getScrollPosition, setScrollPosition });
</script>

<template>
  <q-scroll-area
    ref="scrollarea"
    style="max-width: 498px;height:173px;margin-left:auto;margin-right:auto;border-radius: 10px;border:2px solid black;overflow:hidden;"
    :visible="true"
  >
    <div
      class="row no-wrap"
    >
      <div
        v-for="(image, i) in images"
        :id="`thumb-${i}`"
        :key="i"
        style="max-width: 100px;background-color: rgba(255,180,0, 0.5);"
        :style="{ borderLeft: i === 0 ? undefined : '2px solid black'}"
        class="text-center cursor-pointer flex"
        @mouseenter="$event => hoverIN($event)"
        @mouseleave="$event => hoverOUT($event)"
        @click="() => emit('scrollToPage', i) "
      >
        <div
          class="flex w-100 h-100"
        >
          <span
            class="text-black text-bold q-mx-auto"
          >
            #{{ i+1 }}
          </span>

          <q-img
            v-if="isChapterImage(image)"
            style="opacity:0.9;margin-bottom:auto;"
            :src="transformIMGurl(image.src, settings)"
            width="99px"
            fit="contain"
            loading="lazy"
            img-class="q-px-xs"
            :img-style="{ borderRadius: image.width > image.height ? '8px!important' : '10px!important'}"
          />
          <div
            v-else
            class="flex items-center"
            style="height:140px;"
          >
            <q-btn
              :loading="reloading[i]"
              class="q-mx-sm"
              color="negative"
              size="30px"
              icon="broken_image"
              @click="() => reload(i)"
            />
          </div>
        </div>
      </div>
    </div>
  </q-scroll-area>
</template>
<style lang="css" scoped>
.h-100 {
  height:169px!important;
}
</style>
