<script lang="ts" setup>
import { isLogChapterError, isLogChapterNew, isLogChapterRead, isLogMangaNewMetadata, isMangaLog } from '@api/db/helpers';
import type { MangaInDB } from '@api/models/types/manga';
import type { mirrorInfo } from '@api/models/types/shared';
import type Scheduler from '@api/server/scheduler';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import type dayjs from 'dayjs';
import { format, useQuasar } from 'quasar';
import { computed, inject, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// config
const
/** quasar */
$q = useQuasar(),
/** vue-router */
router = useRouter(),
/** settings */
settings = useSettingsStore(),
/** dayJS lib */
dayJS = inject<typeof dayjs>('dayJS'),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** quasar format util */
{ humanStorageSize } = format;

// state
const
/** mangas logs */
mangaLogs = ref<Scheduler['logs']['manga']>([]),
/** cache logs */
cacheLogs = ref<Scheduler['logs']['cache']>([]),
/** source list */
mirrors = ref<mirrorInfo[]>([]),
/** mangas */
mangas = ref<MangaInDB[]>([]);

// computed
const
/** parent's QHeader height */
headerSize = computed(() => {
  const div = document.querySelector<HTMLDivElement>('#top-header');
  if(div) return div.offsetHeight;
  else return 0;
}),
/** mangas and cache logs sorted by date */
logs = computed(() => {
    return [...mangaLogs.value, ...cacheLogs.value].sort((a, b) => b.date - a.date);
});

/** Get manga's display name or name for a given manga id */
function getMangaName (mangaId:string) {
  const manga = mangas.value.find(m => m.id === mangaId);
  if(manga) return manga.displayName || manga.name;
  else return '';
}

/** Get manga's cover for a given manga id */
function getMangaCover(mangaId:string) {
  const manga = mangas.value.find(m=> m.id === mangaId);
  if(!manga) return '';
  return manga.covers[0];
}

/** Get the source icon for a given manga id */
function getMirrorIcon(mangaId:string) {
  const manga = mangas.value.find(m=> m.id === mangaId);
  if(!manga) return '';
  const mirror = mirrors.value.find(m => m.name === manga.mirror.name);
  if(mirror) return mirror.icon;
  else return '';
}

/** Get the source name for a given manga id */
function getMirrorName(mangaId: string) {
  const manga = mangas.value.find(m=> m.id === mangaId);
  if(!manga) return '';
  const mirror = mirrors.value.find(m => m.name === manga.mirror.name);
  if(mirror) return mirror.displayName;
  else return '';
}

/** redirect to meaningful page */
function itemClick(log: Scheduler['logs']['manga'][0] | Scheduler['logs']['cache'][0]) {
  if(!isMangaLog(log)) return;
  const manga = mangas.value.find(m => m.id === log.id);
  if(!manga) return;

  let params:ReturnType<typeof routeTypeHelper>|undefined;

  if(isLogChapterNew(log) || isLogChapterRead(log)) {
    params = routeTypeHelper('manga', {
      mirror: manga.mirror.name,
      id: manga.id,
      lang: log.data.lang,
    });
  }

  if(isLogChapterError(log) || isLogMangaNewMetadata(log)) {
    params = routeTypeHelper('manga', {
      mirror: manga.mirror.name,
      id: manga.id,
      lang: manga.langs[0],
    });
  }

  if(params) router.push(params);
}

/** returns a colors matching the log error status  */
function colorSelector(log: Scheduler['logs']['manga'][0] | Scheduler['logs']['cache'][0]) {
    if(isLogChapterNew(log)) return 'positive';
    else if(isLogChapterError(log) || log.message === 'cache_error') return 'negative';
    else return 'secondary';
}

/** return an icon name matching the type of log */
function iconSelector(log: Scheduler['logs']['manga'][0] | Scheduler['logs']['cache'][0]) {
  if(isLogChapterNew(log)) return 'new_releases';
  if(isLogChapterError(log)) return 'personal_injury';
  if(isLogChapterRead(log)) return 'visibility';
  if(isLogMangaNewMetadata(log)) return 'analytics';
  else return 'delete';
}

/** update logs every 5s */
function startTimer() {
  setTimeout(async () => {
    const socket = await useSocket(settings.server);
    socket.emit('schedulerLogs', (l) => {
      if(l.manga.length > mangaLogs.value.length) mangaLogs.value = l.manga;
      if(l.cache.length > cacheLogs.value.length) cacheLogs.value = l.cache;
    });
  }, 5000);
}

/** Gather data from the API */
async function On() {
  const socket = await useSocket(settings.server),
        now = Date.now();
  socket.emit('schedulerLogs', (l)=> {
    mangaLogs.value = l.manga;
    cacheLogs.value = l.cache;
  });
  socket.emit('getMirrors', true, (m) => {
    mirrors.value = m;
  });
  socket.on('showLibrary', (id, mgs) => {
    if(id === now) {
      mangas.value = mgs;
    }
  });
  socket.emit('showLibrary', now);
  startTimer();
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('showLibrary');
}

onBeforeMount(On);
onBeforeUnmount(Off);
</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-headerSize)+'px'"
    class="shadow-2"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-page-container>
      <q-page>
        <q-scroll-area
          :style="{height: `${$q.screen.height-headerSize}px`, minHeight: '100px'}"
          :bar-style="{ borderRadius: '5px', background: 'orange', marginTop: '5px', marginBottom: '5px' }"
          :thumb-style="{ marginTop: '5px', marginBottom: '5px', background: 'orange' }"
          class="q-px-lg"
        >
          <q-list
            :dark="$q.dark.isActive"
            separator
          >
            <q-item
              v-for="(log, index) in logs"
              :key="index"
              clickable
              @click="itemClick(log)"
            >
              <q-item-section
                avatar
              >
                <q-icon
                  :color="colorSelector(log)"
                  :name="iconSelector(log)"
                  size="xl"
                />
              </q-item-section>
              <q-item-section
                v-if="isMangaLog(log)"
                avatar
              >
                <q-img
                  :color="colorSelector(log)"
                  :src="transformIMGurl(getMangaCover(log.id), settings)"
                  size="xl"
                />
              </q-item-section>
              <q-item-section v-if="isMangaLog(log)">
                <q-item-label class="text-weight-bold flex-center">
                  <q-avatar
                    :icon="'img:'+getMirrorIcon(log.id)"
                    size="md"
                  >
                    <q-tooltip>
                      {{ getMirrorName(log.id) }}
                    </q-tooltip>
                  </q-avatar>
                  {{ getMangaName(log.id) }}
                </q-item-label>
                <q-item-label class="text-caption">
                  <div v-if="isLogMangaNewMetadata(log)">
                    {{ $t('logs.new_metadata') }}:
                    <span class="text-weight-bold text-orange ">{{ $t(`logs.${log.data.tag}`) }}</span>
                  </div>
                  <div v-else-if="isLogChapterNew(log)">
                    {{ $t('logs.found_chapter') }}
                    <span
                      v-if="log.data.volume"
                      class="text-weight-bold text-orange"
                    >
                      {{ $t('mangas.volume') }}: {{ log.data.volume }} -
                    </span>
                    <span
                      v-if="log.data.number"
                      class="text-weight-bold text-orange"
                    >
                      {{ $t('mangas.chapter') }}: {{ log.data.number }}
                    </span>
                    <q-chip
                      dense
                      color="orange"
                    >
                      {{ $t('languages.'+log.data.lang) }}
                    </q-chip>
                  </div>
                  <div
                    v-else-if="isLogChapterRead(log)"
                    class="text-orange text-weight-bold"
                  >
                    {{ $t('logs.read_chapter') }}
                  </div>
                  <div
                    v-else
                    class="text-orange text-weight-bold"
                  >
                    {{ $t('logs.error_chapter') }}
                  </div>
                </q-item-label>
              </q-item-section>
              <q-item-section v-else>
                <q-item-label>
                  {{ $t('logs.cache') }}
                </q-item-label>
                <q-item-label
                  v-if="log.message === 'cache'"
                  class="text-caption"
                >
                  {{ $t('logs.cache_delete', {number: log.files }) }}:
                  <span class="text-orange text-weight-bold">{{ humanStorageSize(log.size) }}</span>
                </q-item-label>
                <q-item-label
                  v-else
                  class="text-caption"
                >
                  <span class="text-orange text-weight-bold">
                    {{ $t('logs.cache_error') }}
                  </span>
                </q-item-label>
              </q-item-section>
              <q-item-section
                v-if="dayJS"
                side
              >
                {{ dayJS(log.date).fromNow() }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
