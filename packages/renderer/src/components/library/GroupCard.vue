<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import type { MangaGroup } from './@types';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';
import { useRouter } from 'vue-router';
import MirrorChips from './MirrorChips.vue';

/** props */
const props = defineProps<{
  covers: string[]
  group: MangaGroup['mangas']
  groupName: MangaGroup['name']
  groupUnread: number
  mirrors: mirrorInfo[]
}>();
/** router */
const router = useRouter();
/** quasar */
const $q = useQuasar();
/** slider model */
const slide = ref(0);

/** most unread first */
function sort(group: typeof props.group) {
  return group.sort((a, b) => {
    if (a.unread > b.unread) return -1;
    if (a.unread < b.unread) return 1;
    return 0;
  });
}
/** sorted group */
const sortedGroup = computed(() => {
  return sort(props.group);
});

/** Card size */
const size = computed(() => {
  return {
    width: '150px',
    height: '235.5px',
  };
});


function getMirror(mirror:string) {
  return props.mirrors.find(m => m.name === mirror);
}

function showManga(mangaInfo:{ mirror: string, url:string, lang:string, chapterindex?: number}) {
  router.push({
    name: 'manga',
    params: {
      mirror: mangaInfo.mirror,
      url:mangaInfo.url,
      lang: mangaInfo.lang,
      chapterindex: mangaInfo.chapterindex,
    },
  });
}

const QMenuColors = {
  dark : {
    bold: {
      some: 'text-orange',
      none: 'text-grey-6',
    },
    some:'text-orange-2',
    none: 'text-grey-6',
  },
  light : {
    bold: {
      some: 'text-orange',
      none: 'text-grey-6',
    },
    some:'text-primary',
    none: 'text-grey-6',
  },
};

function QMenuChapterColor (unread: number) {
  if($q.dark.isActive) {
    if(unread > 0) return QMenuColors.dark.bold.some;
    return QMenuColors.dark.bold.none;
  } else {
    if(unread > 0) return QMenuColors.light.bold.some;
    return QMenuColors.light.bold.none;
  }
}

function QMenuLabelColor (unread:number) {
  if($q.dark.isActive) {
    if(unread > 0) return QMenuColors.dark.some;
    return QMenuColors.dark.none;
  } else {
    if(unread > 0) return QMenuColors.light.some;
    return QMenuColors.light.none;
  }
}

</script>

<template>
  <q-card
    v-ripple
    class="q-ma-xs q-my-lg"
  >
    <q-menu
      anchor="center middle"
      self="center middle"
    >
      <q-list
        :style="'min-width:'+ size.width"
        separator
      >
        <q-item
          v-for="(manga, i) in sortedGroup"
          :key="i"
          v-close-popup
          clickable
          @click="showManga({mirror: manga.mirror, url: manga.url, lang: manga.lang})"
        >
          <q-item-section>
            <q-item-label class="flex items-center">
              <q-img
                :src="getMirror(manga.mirror)?.icon"
                height="16px"
                width="16px"
                class="q-mr-xs bg-white"
              />
              <span class="text-bold">{{ getMirror(manga.mirror)?.displayName }}</span>
              <span
                class="text-caption q-ml-xs"
              >
                ({{ $t(`languages.${manga.lang}.value`) }})
              </span>
            </q-item-label>
            <q-item-label
              caption
              lines="1"
            >
              <span
                class="q-mr-xs"
                :class="QMenuChapterColor(manga.unread)"
              >
                {{ manga.unread }}
              </span>
              <span :class="QMenuLabelColor(manga.unread)">{{ $t('library.left_to_read', {chapterWord: $t('mangas.chapter', manga.unread).toLocaleLowerCase() }, manga.unread) }}</span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
    <q-carousel
      v-model="slide"
      animated
      autoplay
      infinite
      class="cursor-pointer"
      :style="size"
    >
      <q-carousel-slide
        v-for="(cover, i) in covers"
        :key="i"
        :name="i"
        :img-src="cover"
      >
        <div
          class="absolute-top-right q-mr-xs q-mt-xs"
        >
          <mirror-chips
            v-for="(manga, im) in sortedGroup"
            :key="im"
            :icon="getMirror(manga.mirror)?.icon"
            :nb-of-unread="manga.unread"
            :mirror-display-name="getMirror(manga.mirror)?.displayName"
            :lang="manga.lang"
            @show-manga="showManga({mirror: manga.mirror, url: manga.url, lang: manga.lang})"
          />
        </div>
        <div
          class="absolute-bottom w-100 ellipsis text-white text-center q-px-sm"
          style="background-color: rgba(29, 29, 29, 0.49) !important;"
        >
          <span class="text-h6">{{ groupName }}</span>
          <q-tooltip
            anchor="bottom middle"
            self="top middle"
            :offset="[10, 10]"
          >
            {{ groupName }}
          </q-tooltip>
        </div>
      </q-carousel-slide>
    </q-carousel>
  </q-card>
</template>
