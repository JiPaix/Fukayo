<script lang="ts" setup>
import { ref, onBeforeMount, onBeforeUnmount } from 'vue';
import { useSocket } from '../helpers/socket';
import { useStore as useSettingsStore } from '../../store/settings';
import { useRouter } from 'vue-router';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { MangaInDB } from '../../../../api/src/models/types/manga';

/** router */
const router = useRouter();
/** web socket */
let socket: socketClientInstance | undefined;
/** settings */
const settings = useSettingsStore();
/** mangas in db */
const mangas = ref<MangaInDB[]>([]);

function showManga(manga:MangaInDB) {
  router.push({
            name: 'manga',
            params: {
              mirror: manga.mirror,
              url:manga.url,
              lang: manga.lang,
            },
          });
}

onBeforeMount(async () => {
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket.on('showLibrary', (resid, manga) => {
    if(resid === id) {
      mangas.value.push(manga);
    }
  });
  socket.emit('showLibrary', id);
});

onBeforeUnmount(() => {
  socket?.off('showLibrary');
  socket?.emit('stopShowLibrary');
});
</script>

<template>
  <q-card
    class="w-100"
  >
    <q-card-section
      class="text-center"
    >
      <h2>mangalist (wip)</h2>
      <div>
        <span
          v-for="(manga, i) in mangas"
          :key="i"
          @click="showManga(manga)"
        >
          {{ manga.name }}
        </span>
      </div>
    </q-card-section>
  </q-card>
</template>
