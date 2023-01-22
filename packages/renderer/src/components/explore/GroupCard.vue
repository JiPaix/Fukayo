<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n';
import CarouselSlide from '@renderer/components/explore/CarouselSlide.vue';
import GroupMenu from '@renderer/components/explore/GroupMenu.vue';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

/** props */
const props = defineProps<{
  covers: string[]
  group: SearchResult
  groupName: string
  mirror: mirrorInfo
  hideLangs?: mirrorsLangsType[]
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** router */
router = useRouter();

// globals
const
/** default image size */
defaultImageSize = {
    width: 150*1.5,
    height: 235.5*1.5,
};

// states
const
/** dialog */
dialog = ref(false),
/** slider model */
slide = ref(0);

// computed
const
/** Card size */
size = computed(() => {
  if($q.screen.xs || $q.screen.sm) {
    // mobile
    return addPx({
      width: defaultImageSize.width * 1.5,
      height: defaultImageSize.height * 1.5,
    });
  }
  // desktop
  return addPx(defaultImageSize);
});

/** add 'px' to width and height */
function addPx(size: { width: number, height: number }) {
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  };
}

/** redirect to manga page */
function showManga(mangaInfo:{ id: string, mirror: string, url:string, lang:SearchResult['langs'][number], chapterindex?: number}) {
  const opts = routeTypeHelper('manga', {
    id: mangaInfo.id,
    lang: mangaInfo.lang,
    mirror: mangaInfo.mirror,
  });
  router.push(opts);
}

/** open dialog if manga has multiple languages/sources */
function OpenDialogOrRedirect() {
  let langs = props.group.langs;
  if(props.hideLangs && props.hideLangs.length) langs = props.group.langs.filter(l => !props.hideLangs?.includes(l));
  if(langs.length > 1) dialog.value = !dialog.value;
  else showManga({ id: props.group.id, lang: langs[0], url: props.group.url, mirror: props.mirror.name });
}
</script>
<template>
  <q-card
    v-ripple
    class="q-ma-xs q-my-lg"
    @click="OpenDialogOrRedirect"
  >
    <group-menu
      :mirror="mirror"
      :sorted-group="group"
      :width="parseInt(size.width.replace('px', ''))"
      :height="parseInt(size.height.replace('px', ''))"
      :dialog="dialog"
      :hide-langs="hideLangs"
      @show-manga="showManga"
      @update-dialog="dialog = !dialog"
    />
    <q-carousel
      v-if="covers.length"
      v-model="slide"
      animated
      autoplay
      infinite
      class="cursor-pointer"
      :style="size"
    >
      <carousel-slide
        v-for="(cover, i) in covers"
        :key="i"
        :name="i"
        :group-in-library="group.inLibrary"
        :group-name="group.name"
        :mirror-display-name="mirror.displayName"
        :mirror-icon="mirror.icon"
        :cover="cover"
      />
    </q-carousel>
    <q-carousel
      v-else
      v-model="slide"
      class="cursor-pointer"
      :style="size"
      :dark="$q.dark.isActive"
    >
      <carousel-slide
        :name="0"
        :group-in-library="group.inLibrary"
        :group-name="group.name"
        :mirror-display-name="mirror.displayName"
        :mirror-icon="mirror.icon"
      />
    </q-carousel>
  </q-card>
</template>
