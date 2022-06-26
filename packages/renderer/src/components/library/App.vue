<script lang="ts" setup>
import { useQuasar } from 'quasar';
import { onBeforeUnmount, onMounted, ref, computed } from 'vue';
import type { socketClientInstance } from '../../../../api/src/client/types';
import { mirrorInfo } from '../../../../api/src/models/types/shared';
import { useStore as useSettingsStore } from '../../store/settings';
import { useSocket } from '../helpers/socket';
import { chapterLabel } from '../reader/helpers';
import GroupCard from './GroupCard.vue';
import GroupFilter from './GroupFilter.vue';
import type { MangaGroup, MangaInDBwithLabel } from './@types';

/** quasar */
const $q = useQuasar();
defineExpose({ $q });
/** web socket */
let socket: socketClientInstance | undefined;
/** settings */
const settings = useSettingsStore();
/** mangas in db */
const mangasRAW = ref<MangaGroup[]>([]);
/** mirrors */
const mirrors = ref<mirrorInfo[]>([]);
/** search */
const search = ref<string|null>(null);
/** filters */
const filters = ref<{
  mirrors: string[],
  langs: string[],
}>({
  mirrors: [],
  langs: [],
});
// sort groups with most unread first
function sortByMostUnread(group: MangaGroup[]) {
  return group.sort((a, b) => {
    if (a.unread > b.unread) return -1;
    if (a.unread < b.unread) return 1;
    return 0;
  });
}

// sort groups by less unread first
function sortByLeastUnread(group: MangaGroup[]) {
  return group.sort((a, b) => {
    if (a.unread > b.unread) return 1;
    if (a.unread < b.unread) return -1;
    return 0;
  });
}

// sort groups by alphabetical order
function sortByAlphabetical(group: MangaGroup[]) {
  return group.sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

// sort groups by unalphabetical order
function sortByUnalphabetical(group: MangaGroup[]) {
  return group.sort((a, b) => {
    if (a.name < b.name) return 1;
    if (a.name > b.name) return -1;
    return 0;
  });
}

// hide groups with no unread manga if settings.library.showUnread is false
function hideUnread(group: MangaGroup[]) {
  if (settings.library.showUnread) {
    return group;
  }
  return group.filter(g => g.unread > 0);
}

// filter groups by search
function filterBySearch(group: MangaGroup[]) {
  const curr = search.value;
  if (!curr || curr.length === 0) {
    return group;
  }
  return group.filter(g => g.name.toLowerCase().includes(curr.toLowerCase()));
}

// filter by language and mirror
function filterByMirrorAndLang(group: MangaGroup[]) {
  const curr = filters.value;
  if (!curr.mirrors.length && !curr.langs.length) {
    return group;
  }
  return group.filter(g => {
    if (curr.mirrors.length && !g.mangas.some(m => curr.mirrors.includes(m.mirror))) {
      return false;
    }
    if (curr.langs.length && !g.mangas.some(m => curr.langs.includes(m.lang))) {
      return false;
    }
    return true;
  });
}

function stackedFilters(group: MangaGroup[]) {
  return filterByMirrorAndLang(filterBySearch(hideUnread(group)));
}

const mangas = computed(() => {
  if(settings.library.sort === 'AZ') return sortByAlphabetical(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'ZA') return sortByUnalphabetical(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'read') return sortByLeastUnread(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'unread') return sortByMostUnread(stackedFilters(mangasRAW.value));
  else return filterBySearch(hideUnread(mangasRAW.value));
});

const mirrorList = computed(() => {
  return Array.from(
    new Set(
      mangasRAW.value.map(m => m.mangas.map(mm => mm.mirror)).flat(),
    ),
  )
  .map(m => mirrors.value.find(mir => mir.name === m));
});

const langs = computed(() => {
  return Array.from(
    new Set(
      mangasRAW.value.map(m => m.mangas.map(mm => mm.lang)).flat(),
    ),
  );
});

onMounted(async () => {
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket.emit('getMirrors', true, async (m) => {
    mirrors.value = m;
    if (!socket) socket = await useSocket(settings.server);

    socket.on('showLibrary', (resid, manga) => {
      if(resid === id) {
        const mirrorInfo = m.find(mirror => mirror.name === manga.mirror);
        if(mirrorInfo) {
          manga.chapters = manga.chapters.sort((a, b) => b.number - a.number);
          const maxChapter = manga.chapters.reduce((max, chapter) => chapter.read ? Math.max(max, chapter.number) : max, 0);
          let chapterIndex = manga.chapters.findIndex(chapter => chapter.number === maxChapter);
          if(chapterIndex === -1) chapterIndex = manga.chapters.length-1;
          const group = mangasRAW.value.find(group => group.name === manga.displayName || group.name === manga.name);
          const mg:MangaInDBwithLabel = {
            name: manga.name,
            displayName: manga.displayName,
            mirror: mirrorInfo.name,
            url: manga.url,
            unread: manga.chapters.filter(c => !c.read).length,
            chapters: manga.chapters.map((c, i) => {
              return {
                label: chapterLabel(c.number, c.name),
                value: i,
                read: c.read,
              };
            }),
            lang: manga.lang,
          };
          if(!group) {
            mangasRAW.value.push({
              name: manga.displayName || manga.name,
              mangas: [mg as MangaInDBwithLabel],
              covers: manga.covers,
              unread: manga.chapters.filter(c => !c.read).length,
            });
          } else {
            group.mangas.push(mg as MangaInDBwithLabel);
            group.covers = [...new Set([...group.covers, ...manga.covers])];
            group.unread += manga.chapters.filter(c => !c.read).length;
          }
        }
      }
    });
    socket.emit('showLibrary', id);
  });
});

onBeforeUnmount(() => {
  socket?.off('showLibrary');
  socket?.emit('stopShowLibrary');
});
</script>

<template>
  <div
    class="w-100 q-pa-lg"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
    :dark="$q.dark.isActive"
  >
    <group-filter
      v-if="mirrorList.length"
      :mirror-list="(mirrorList as mirrorInfo[])"
      :lang-list="langs"
      @search="(input) => search = input"
      @filter="(mirrors, langs) => filters = {mirrors, langs}"
    />

    <q-infinite-scroll
      class="w-100 q-pa-lg"
    >
      <div
        class="flex items-center"
      >
        <group-card
          v-for="(group, i) in mangas"
          :key="i"
          :group="group.mangas"
          :covers="group.covers"
          :group-name="group.name"
          :mirrors="mirrors"
          :group-unread="group.unread"
        />
      </div>
    </q-infinite-scroll>
  </div>
</template>
<style lang="css">
.q-panel.scroll {
  overflow: hidden!important;
}
.q-field--item-aligned .q-field__before {
  min-width: 0px!important;
}
</style>
