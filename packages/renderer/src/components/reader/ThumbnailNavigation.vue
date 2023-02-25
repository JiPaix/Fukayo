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
  div.classList.add('bg-orange-3');
  div.classList.remove('bg-orange');
}

function hoverOUT(ev:MouseEvent) {
  const div = ev.target as HTMLDivElement;
  div.classList.add('bg-orange');
  div.classList.remove('bg-orange-3');
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
    style="width: 498px;height:160px;margin-left:auto;margin-right:auto;"
    :visible="true"
    class="rounded-borders"
    :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '0px', marginBottom: '0px', marginLeft: '8px', marginRight: '10px' }"
    :thumb-style="{ marginTop: '0px', marginBottom: '1px', background: 'orange', marginLeft: '2px', marginRight: '4px' }"
  >
    <div
      class="row no-wrap"
    >
      <div
        v-for="(image, i) in images"
        :id="`thumb-${i}`"
        :key="i"
        style="max-width: 100px;border-right:2px solid black"
        class="text-center bg-orange cursor-pointer flex"
        @mouseenter="$event => hoverIN($event)"
        @mouseleave="$event => hoverOUT($event)"
        @click="() => emit('scrollToPage', i) "
      >
        <span class="text-bold text-caption text-black">#{{ i+1 }}</span>
        <q-img
          v-if="isChapterImage(image)"
          class="self-center"
          :src="transformIMGurl(image.src, settings)"
          width="99px"
          loading="lazy"
        />
        <div
          v-else
          class="bg-white flex items-center"
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
  </q-scroll-area>
</template>
