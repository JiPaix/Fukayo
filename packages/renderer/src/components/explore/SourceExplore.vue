<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { RecommendErrorMessage } from '@api/models/types/errors';
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import GroupCard from '@renderer/components/explore/GroupCard.vue';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isSearchResult, isTaskDone } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';

/** current route */
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
/** error? */
const error = ref<null|RecommendErrorMessage>(null);

const mangaGroups = computed(() => {
  const names = recommendation.value.map(r => r.name);
  return names.map(name => {
    return {
      name,
      manga: recommendation.value.filter(x => x.name === name )[0],
      covers: recommendation.value.filter(x => x.name === name ).map(m => m.covers.flat()).flat(),
    };
  }).filter(f => typeof f.manga !== 'undefined');
});

onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', false, (m) => {
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
      if(Array.isArray(result)){
        result.forEach(ele => {
          if(isSearchResult(ele)) {
            if(recommendation.value.length === 0) mirror.value = ele.mirrorinfo;
            if(!recommendation.value.some((r) => r.name === ele.name)) recommendation.value.push(ele);
          }
          if(isTaskDone(ele)) {
            loading.value = false;
            socket?.off('showRecommend');
          }
        });
      }else {
        if(isSearchResult(result)) {
          if(recommendation.value.length === 0) mirror.value = result.mirrorinfo;
          if(!recommendation.value.some((r) => r.name === result.name)) recommendation.value.push(result);
        }
        else if(isTaskDone(result)) {
          loading.value = false;
          socket?.off('showRecommend');
        }
        else {
          loading.value = false;
          error.value = result;
        }
      }
    }
  });
});

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
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-header
      elevated
      :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
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
        v-if="error && !recommendation.length"
        class="q-pa-md"
      >
        <q-banner
          inline-actions
          class="text-dark bg-grey-5"
        >
          <template #avatar>
            <q-icon
              name="signal_wifi_off"
              color="negative"
            />
          </template>
          <div class="flex">
            <span class="text-bold">{{ $t('error') }}:</span>
          </div>
          <div class="flex">
            <span class="text-caption">{{ error.trace || error.error }}</span>
          </div>
        </q-banner>
      </q-page>
      <q-page
        v-else
        class="q-pa-md"
      >
        <div
          v-if="mirror"
          class="q-pa-md flex flex-center"
        >
          <group-card
            v-for="(group, i) in mangaGroups"
            :key="i"
            :group="group.manga"
            :group-name="group.name"
            :mirror="mirror"
            :covers="group.covers.map(c => transformIMGurl(c, settings))"
            class="q-my-lg"
            :hide-langs="settings.i18n.ignored"
          />
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
