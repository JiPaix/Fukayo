<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import GroupMenu from '@renderer/components/explore/GroupMenu.vue';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

/** quasar */
const $q = useQuasar();
/** router */
const router = useRouter();
/** dialog */
const dialog = ref(false);
/** slider model */
const slide = ref(0);

/** props */
defineProps<{
  covers: string[]
  group: SearchResult
  groupName: string
  mirror: mirrorInfo
}>();

const defaultImageSize = {
    width: 150*1.5,
    height: 235.5*1.5,
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

function showManga(mangaInfo:{ id: string, mirror: string, url:string, lang:SearchResult['langs'][number], chapterindex?: number}) {
  router.push({
    name: 'manga',
    params: {
      id: mangaInfo.id,
      mirror: mangaInfo.mirror,
      url:mangaInfo.url,
      lang: mangaInfo.lang,
      chapterindex: mangaInfo.chapterindex,
    },
  });
}
</script>

<template>
  <q-card
    v-ripple
    class="q-ma-xs q-my-lg"
    @click="mirror.langs.length > 1 ? dialog = !dialog : showManga({ id: group.id, lang: mirror.langs[0], url: group.url, mirror: mirror.name })"
  >
    <group-menu
      :mirror="mirror"
      :sorted-group="group"
      :width="parseInt(size.width.replace('px', ''))"
      :height="parseInt(size.height.replace('px', ''))"
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
