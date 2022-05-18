<script lang="ts" setup>
import { ref, computed, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSocket } from './helpers/socket';
import { useQuasar } from 'quasar';
import { useStore as useSettingsStore } from '/@/store/settings';
import { isSearchResult, isTaskDone } from './helpers/typechecker';
import type { socketClientInstance } from '../../../api/src/client/types';
import type { SearchResult } from '../../../api/src/models/types/search';
import type { mirrorInfo } from '../../../api/src/models/types/shared';

const router = useRouter();
const route = useRoute();
/** quasar */
const $q = useQuasar();
/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;

const mirror = ref<mirrorInfo>();
/** recommendation */
const recommendation = ref<SearchResult[]>([]);
/** loading state */
const loading = ref(true);


onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', (m) => {
    const found = m.find((mirror) => mirror.name === route.params.mirror);
    if(found) mirror.value = found;
  });

  const now = Date.now();
  let name:string;
  if(Array.isArray(route.params.mirror)) {
    name = route.params.mirror[0];
  } else {
    name = route.params.mirror;
  }

  socket.emit('showRecommend', now, name);
    socket.on('showRecommend', (id, result) => {
    if(id === now) {
      if(isSearchResult(result)) {
        if(recommendation.value.length === 0) mirror.value = result.mirrorinfo;
        if(!recommendation.value.some((r) => r.name === result.name)) recommendation.value.push(result);
      }
      if(isTaskDone(result)) {
        loading.value = false;
        socket?.off('showRecommend');
      }
    }
  });
});
/** return an array of css classes depending on the screen size */
const sizes = computed(() => {
  if($q.screen.xs) return 'height:600px;';
  else if($q.screen.sm) return 'height:500px;';
  else if($q.screen.md) return 'height:400px;';
  else return 'height:300px';
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
    },
  });
}
onBeforeUnmount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('stopShowRecommend');
  socket.off('showRecommend');
});

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-50)+'px'"
    class="shadow-2"
  >
    <q-header
      elevated
      class="bg-dark"
    >
      <q-bar
        v-if="mirror"
      >
        <q-icon
          :name="'img:'+mirror.icon"
          left
        />
        <span class="text-caption">{{ mirror.displayName }}</span>
      </q-bar>
    </q-header>
    <q-footer class="bg-dark">
      <q-linear-progress
        v-if="loading"
        size="4px"
        color="orange"
        animation-speed="500"
        indeterminate
      />
    </q-footer>
    <q-page-container>
      <q-page
        class="q-pa-md"
      >
        <div class="q-pa-md row justify-evenly">
          <q-intersection
            v-for="item in recommendation"
            :key="item.url"
            class="col-xs-12 col-sm-6 col-md-3 q-mt-xl col-lg-2"
            margin="500px 500px 500px 500px"
            transition="fade"
            :style="sizes"
          >
            <div
              class="row shadow-5 overflow-hidden q-ma-md"
              :style="sizes"
            >
              <div
                v-if="item.covers.length > 0"
                class="col-12 cover flex cursor-pointer"
                :style="'background-image: url('+item.covers[0]+');'"
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
              </div>
              <q-skeleton
                v-else
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
            </div>
          </q-intersection>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css" scoped>
.cover {
  background-repeat: no-repeat;
  background-size:cover;
  background-position: 50% 10%;
}

</style>
