<script lang="ts" setup>
import { ref, onBeforeMount, inject, computed } from 'vue';
import { useSocket } from '../helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { format, useQuasar } from 'quasar';
import type { Scheduler } from '../../../../api/src/server/helpers/scheduler';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type dayjs from 'dayjs';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';
import type { MangaInDB } from '../../../../api/src/models/types/manga';

/** quasar */
const $q = useQuasar();
/** quasar format util */
const { humanStorageSize } = format;
/** settings */
const settings = useSettingsStore();
/** vue-router */
const router = useRouter();
/** socket */
let socket:socketClientInstance|undefined;
/** dayJS lib */
const dayJS = inject<typeof dayjs>('dayJS');
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
const mangaLogs = ref<typeof Scheduler['logs']['manga']>([]);

const cacheLogs = ref<typeof Scheduler['logs']['cache']>([]);

const logs = computed(() => {
    return [...mangaLogs.value, ...cacheLogs.value].sort((a, b) => b.date - a.date);
});

function isMangaLog(res:typeof Scheduler['logs']['manga'][0] | typeof Scheduler['logs']['cache'][0]): res is typeof Scheduler['logs']['manga'][0] {
  return res.message === 'chapter' || res.message === 'chapter_error' || res.message === 'chapter_read';
}

const mirrors = ref<mirrorInfo[]>([]);
const mangas = ref<MangaInDB[]>([]);

function getMangaName (mangaId:string) {
  const manga = mangas.value.find(m => m.id === mangaId);
  if(manga) return manga.displayName || manga.name;
  else return '';
}

function getMangaLang (mangaId:string) {
  const manga = mangas.value.find(m => m.id === mangaId);
  if(!manga) return '';
  return $t(`languages.${manga.lang}.value`);
}

function getMirror(name:string) {
  const mirror = mirrors.value.find(m => m.name === name);
  if(mirror) return mirror.displayName || mirror.name;
  else return '';
}

function itemClick(log: typeof Scheduler['logs']['manga'][0] | typeof Scheduler['logs']['cache'][0]) {
  if(isMangaLog(log)) {
    const manga = mangas.value.find(m => m.id === log.id);
    if(!manga) return;
    router.push({ name: 'manga', params: { mirror: manga.mirror, lang: manga.lang, url: manga.url } });
  }
}

function colorSelector(log: typeof Scheduler['logs']['manga'][0] | typeof Scheduler['logs']['cache'][0]) {
  if(log.message === 'chapter') return 'positive';
  if(log.message === 'chapter_error' || log.message === 'cache_error') return 'negative';
  if(log.message === 'chapter_read' || log.message === 'cache' || log.message === 'manga_metadata') return 'secondary';
}

function iconSelector(log: typeof Scheduler['logs']['manga'][0] | typeof Scheduler['logs']['cache'][0]) {
  if(log.message === 'chapter') return 'new_releases';
  if(log.message === 'chapter_error') return 'personal_injury';
  if(log.message === 'chapter_read') return 'visibility';
  if(log.message === 'cache') return 'recycling';
  if(log.message === 'cache_error') return 'dangerous';
  if(log.message === 'manga_metadata') return 'analytics';
}

onBeforeMount(async () => {
  const now = Date.now();
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('schedulerLogs', (l)=> {
    mangaLogs.value = l.manga;
    cacheLogs.value = l.cache;
  });
  socket.emit('getMirrors', true, (m) => {
    mirrors.value = m;
  });
  socket.on('showLibrary', (id, manga) => {
    if(id === now) {
      mangas.value.push(manga);
    }
  });
  socket.emit('showLibrary', now);
});

</script>
<template>
  <div
    class="w-100 q-ma-sm"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
  >
    <q-infinite-scroll :offset="250">
      <q-list
        v-for="(log, index) in logs"
        :key="index"
        :dark="$q.dark.isActive"
      >
        <q-item
          clickable
          class="q-py-md"
          :dark="$q.dark.isActive"
          @click="itemClick(log)"
        >
          <q-item-section avatar>
            <q-icon
              :color="colorSelector(log)"
              :name="iconSelector(log)"
              size="lg"
            />
          </q-item-section>
          <q-item-section v-if="isMangaLog(log)">
            <q-item-label
              lines="1"
              class="flex items-center"
            >
              <span class="text-weight-bold">{{ getMangaName(log.id) }} <i>({{ getMangaLang(log.id) }})</i></span>
              <q-tooltip>
                <img
                  :src="mangas.find(m => m.id === log.id )?.covers[0]"
                >
              </q-tooltip>
            </q-item-label>
            <q-item-label
              caption
              lines="1"
            >
              <div class="flex">
                <span v-if="log.message === 'chapter'">{{ $t('logs.found_chapter', {number: log.nbOfUpdates}, log.nbOfUpdates) }}</span>
                <span v-else-if="log.message === 'chapter_error'">{{ $t('logs.error_chapter') }}</span>
                <span v-else-if="log.message === 'chapter_read'">{{ $t('logs.read_chapter', {number: log.nbOfUpdates}, log.nbOfUpdates) }}</span>
                <span v-else-if="log.message === 'manga_metadata'">{{ $t('logs.new_metadata') }}</span>
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section v-else>
            <q-item-label
              lines="1"
              class="flex items-center"
            >
              <span> {{ $t('settings.cache') }} </span>
            </q-item-label>
            <q-item-label
              caption
              lines="1"
            >
              <span v-html="$t('logs.cache', {size: humanStorageSize(log.size), files: log.files }, log.files)" />

              <!-- <span class="text-weight-bold">{{ getMangaName(log.) }} <i>({{ getMangaLang(log.id) }})</i></span>
              {{ $t('logs.found_chapter', {number: log.chapter}, log.chapter) }} -->
            </q-item-label>
          </q-item-section>
          <q-item-section
            side
            top
          >
            {{ dayJS ? dayJS(log.date).fromNow() : log.date }}
            <div
              v-if="isMangaLog(log)"
              class="flex items-center"
            >
              <img
                :src="mirrors.find(m => m.name === log.mirror)?.icon"
                width="16"
                height="16"
                class="q-mr-xs"
              >
              <span> {{ getMirror(log.mirror) }} </span>
            </div>
          </q-item-section>
        </q-item>
        <q-separator
          v-if="index < (logs.length-1)"
          :dark="$q.dark.isActive"
        />
      </q-list>
    </q-infinite-scroll>
  </div>
</template>
