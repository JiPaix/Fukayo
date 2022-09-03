<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n/availableLangs';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import type { MangaGroup } from '@renderer/components/library/@types';
import GroupMenu from '@renderer/components/library/GroupMenu.vue';
import MirrorChips from '@renderer/components/library/MirrorChips.vue';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

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
/** dialog */
const dialog = ref(false);

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

const defaultImageSize = {
    width: 150,
    height: 235.5,
};
// add 'px' to width and height
function addPx(size: { width: number, height: number }) {
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  };
}

/** Card size */
const size = computed(() => {
  if($q.screen.xs) {
    // mobile
    return addPx({
      width: defaultImageSize.width * 2,
      height: defaultImageSize.height * 2,
    });
  }
  if($q.screen.sm) {
    // tablet
    return addPx({
      width: defaultImageSize.width * 1.5,
      height: defaultImageSize.height * 1.5,
    });
  }
  // desktop
  return addPx(defaultImageSize);
});


function getMirror(mirror:string) {
  return props.mirrors.find(m => m.name === mirror);
}

function showManga(mangaInfo:{ id: string, mirror: string, url:string, lang:string, chapterindex?: number}) {

  const opts = routeTypeHelper('manga', {
    id: mangaInfo.id,
    url: mangaInfo.url,
    lang: mangaInfo.lang as mirrorsLangsType,
    mirror: mangaInfo.mirror,
  });
  router.push(opts);
}
</script>

<template>
  <q-card
    v-ripple
    class="q-ma-xs q-my-lg"
    @click="sortedGroup.length === 1 && sortedGroup[0].langs.length === 1 ? showManga({ mirror: sortedGroup[0].mirror, url: sortedGroup[0].url, lang: sortedGroup[0].langs[0], id:sortedGroup[0].id }) : dialog = !dialog"
  >
    <group-menu
      :mirrors="props.mirrors"
      :sorted-group="sortedGroup"
      :width="size.width"
      :dialog="dialog"
      @show-manga="showManga"
      @update-dialog="dialog = !dialog"
    />
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
            :langs="manga.langs"
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
