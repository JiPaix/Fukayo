<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import GroupMenu from '@renderer/components/explore/GroupMenu.vue';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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
router = useRouter(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

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
          class="absolute-top-left w-100 text-white q-px-sm"
          style="background-color: rgba(29, 29, 29, 0.8) !important;"
        >
          <div class="flex justify-between items-center ellipsis">
            <div class="flex flex-center">
              <q-img
                :src="mirror.icon"
                width="16px"
                height="16px"
              />
              <span class="text-caption q-ml-sm">
                {{ mirror.displayName }}
              </span>
            </div>
            <q-badge
              v-if="group.inLibrary"
              color="red"
            >
              {{ $t('mangas.inlibrary') }}
            </q-badge>
          </div>
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
