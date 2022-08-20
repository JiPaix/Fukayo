<script lang="ts" setup>
import type { MangaPage } from '@api/models/types/manga';


const props = defineProps<{
  type: 'next'|'prev',
  chapter?: MangaPage['chapters'][0]
  show: boolean
}>();

const emit = defineEmits<{
  (event: 'loadNext'):void
  (event: 'loadPrev'): void
}>();

function load() {
  if(props.type === 'next') emit('loadNext');
  else emit('loadPrev');
}

</script>

<template>
  <div
    v-if="chapter && show"
    class="full-width column wrap justify-between items-center content-center text-center"
    :style="`height: ${type === 'prev' ? $q.screen.height + 84 : $q.screen.height}px`"
  >
    <!-- &nbsp is on purpose to trigger event only once user is at the top -->
    <div
      v-if="type==='prev'"
      v-intersection.once="{ handler: (i: IntersectionObserverEntry) => i.isIntersecting ? load() : null}"
    >
      &nbsp;
    </div>
    <div :class="type === 'prev' ? 'q-mt-auto' : null">
      <!-- arrow up icon -->
      <div
        v-if="type === 'prev'"
      >
        <q-btn
          flat
          :icon="'keyboard_double_arrow_up'"
          size="lg"
          round
          @click="load"
        />
      </div>
      <!-- next/previous chapter is: -->
      <span
        v-if="type === 'next' "
        class="text-caption text-positive"
      >
        {{ $t('reader.next_chapter') }}:
      </span>
      <span
        v-else
        class="text-caption text-positive"
      >
        {{ $t('reader.previous_chapter') }}:
      </span>
      <!-- chapter display name -->
      <span
        v-if="chapter.volume !== undefined"
        class="text-caption"
      >
        {{ $t('mangas.volume') }} {{ chapter.volume }}
      </span>
      <span
        v-if="chapter.volume !== undefined && chapter.number !== undefined"
        class="text-caption"
      >
        -
      </span>
      <span
        v-if="chapter.number !== undefined"
        class="text-caption"
      >
        {{ $t('mangas.chapter') }} {{ chapter.number }}
      </span>
      <span
        v-if="chapter.volume === undefined && chapter.number === undefined"
        class="text-caption"
      >
        {{ chapter.name }}
      </span>
      <!-- arrow down icon -->
      <div
        v-if="type === 'next'"
      >
        <q-btn
          flat
          :icon="'keyboard_double_arrow_down'"
          size="lg"
          round
          @click="load"
        />
      </div>
    </div>

    <!-- &nbsp is on purpose to trigger event only once user is at the bottom -->
    <div
      v-if="type==='next'"
      v-intersection.once="{ handler: (i: IntersectionObserverEntry) => i.isIntersecting ? load() : null}"
    >
       &nbsp;
    </div>
  </div>
  <div
    v-else-if="!chapter && show && type === 'next'"
    class="flex flex-center"
  >
    <span class="text-caption q-mt-md text-negative q-mb-xl">
      {{ $t('reader.no_next_to_read') }}
    </span>
  </div>
</template>
