<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import type { SearchResult } from '../../../../api/src/models/types/search';

/** router */
const router = useRouter();
/** quasar */
const $q = useQuasar();

/** props */
defineProps<{
  /** mangas infos */
  results: SearchResult[]
}>();

/** return an array of css classes depending on the screen size */
const sizes = computed(() => {
  const classes = [];
  if($q.screen.lt.sm) classes.push('h-xs');
  else classes.push('h-lg');
  if($q.screen.gt.sm) classes.push('q-gutter-x-xl');
  return classes.join(' ');
});

/**
 * Redirect to the manga's page
 * @param item manga infos
 */
function showManga (item:SearchResult) {
  router.push({
    name: 'manga',
    params: {
      mirror: item.mirrorinfo.name,
      url:item.url,
      lang: item.lang,
      id: item.id,
    },
  });

}
</script>
<template>
  <div class="q-pa-md row justify-evenly">
    <q-intersection
      v-for="item in results"
      :key="item.url"
      class="col-xs-12 col-sm-5 q-mt-xl col-lg-3"
      :class="sizes"
      margin="500px 500px 500px 500px"
      transition="fade"
    >
      <div
        class="row shadow-5 overflow-hidden"
        :class="$q.screen.lt.sm ? 'h-xs' : 'h-lg'"
      >
        <div
          v-if="item.covers.length > 0"
          class="col-xs-12 col-sm-6 cover flex cursor-pointer"
          :style="'background-image: url('+item.covers[0]+');'"
          :class="$q.screen.lt.sm ? 'xs-cover' : ''"
          @click="showManga(item)"
        >
          <div
            v-if="item.inLibrary"
            class="absolute-top-right bg-accent q-ma-lg"
          >
            {{ $t('explore.inlibrary') }}
          </div>
          <div
            class="text-center text-white text-body-1 text-weight-medium text-uppercase self-end w-100 ellipsis-3-lines q-px-md"
            style="overflow-hidden;bottom:0;background-color:rgb(29 29 29 / 90%)!important;"
            rounded
            dense
          >
            {{ item.name }}
            <q-tooltip>
              {{ item.name }}
            </q-tooltip>
          </div>
        </div>
        <q-skeleton
          v-else
          :dark="$q.dark.isActive"
          class="col-xs-12 col-sm-6 cover flex cursor-pointer"
          :class="$q.screen.lt.sm ? 'xs-cover' : ''"
          @click="showManga(item)"
        >
          <div
            class="text-center text-white q-pa-md text-h6 self-end w-100 ellipsis"
            style="overflow-hidden;bottom:0;background-color:rgb(29 29 29 / 49%)!important;"
            rounded
            dense
          >
            {{ item.name }}
            <q-tooltip>
              {{ item.name }}
            </q-tooltip>
          </div>
        </q-skeleton>
        <div
          class="flex column justify-between"
          :class="$q.screen.xs ? 'w-100' : 'w-50'"
        >
          <div class="flex column q-pa-sm w-100">
            <div
              class="row q-ma-sm shadow-1 flex items-center bg-white text-black"
              style="border-top-left-radius:3px;border-bottom-left-radius: 3px;border-top-right-radius:3px;border-bottom-right-radius: 3px;"
            >
              <div
                class="col-lg-4 col-xs-2 text-center"
              >
                <q-icon name="translate" />
              </div>
              <div
                class="col-lg-8 col-xs-9 text-right text-uppercase text-caption ellipsis"
              >
                <span class="q-mr-sm">{{ $t('languages.'+item.lang+'.value') }}</span>
              </div>
            </div>
            <div
              class="row q-ma-sm shadow-1 flex items-center bg-white text-black"
              style="border-top-left-radius:3px;border-bottom-left-radius: 3px;border-top-right-radius:3px;border-bottom-right-radius: 3px;"
            >
              <div
                class="col-lg-4 col-xs-2 text-center"
              >
                <q-icon :name="'img:'+item.mirrorinfo.icon" />
              </div>
              <div
                class="col-lg-8 col-xs-9 text-right text-uppercase text-caption ellipsis"
              >
                <span class="q-mr-sm">{{ item.mirrorinfo.displayName }}</span>
              </div>
            </div>
          </div>
          <div
            v-if="item.last_release"
            class="q-pa-sm flex column bottom w-100"
          >
            <div
              v-if="(item.last_release.name !== undefined && item.last_release.chapter === undefined) || $q.screen.lt.sm"
              class="bg-orange text-white text-center q-pa-sm q-mb-sm rounded-borders w-100 text-weight-medium ellipsis"
            >
              <span v-if="item.last_release.chapter !== undefined">
                {{ $t('mangas.chapter').toLocaleUpperCase() }} {{ item.last_release.chapter }}
              </span>
              <span v-if="item.last_release.chapter !== undefined && item.last_release.name !== undefined">
                -
              </span>
              <span
                v-if="item.last_release.name !== undefined"
              >
                {{ item.last_release.name }}
              </span>
            </div>
            <div
              v-if="item.last_release.volume !== undefined && ($q.screen.sm || $q.screen.gt.sm)"
              class="row q-ma-sm shadow-1"
            >
              <div
                class="col-4 q-py-sm bg-orange text-center text-weight-medium text-black"
                style="border-top-left-radius:3px;border-bottom-left-radius: 3px;"
              >
                {{ item.last_release.volume }}
              </div>
              <div class="col-8 q-py-sm bg-white text-dark text-center text-uppercase text-weight-medium ellipsis">
                {{ $t('mangas.volume', item.last_release.volume) }}
              </div>
            </div>

            <div
              v-if="item.last_release.chapter !== undefined && ($q.screen.sm || $q.screen.gt.sm)"
              class="row q-ma-sm shadow-1"
            >
              <div
                class="col-4 q-py-sm bg-orange text-center text-weight-medium"
                style="border-top-left-radius:3px;border-bottom-left-radius: 3px;"
              >
                {{ item.last_release.chapter }}
              </div>
              <div class="col-8 q-py-sm bg-white text-dark  text-center text-uppercase text-weight-medium ellipsis">
                {{ $t('mangas.chapter', item.last_release.chapter === 0 ? 1 : item.last_release.chapter) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </q-intersection>
  </div>
</template>
<style lang="css" scoped>
.cover {
  background-repeat: no-repeat;
  background-size:cover;
  background-position: 50% 50%;
}
.h-lg {
  height: 300px!important;
}
.h-xs {
  height: 560px!important;
}
.xs-cover {
  height:400px!important;
}
</style>
