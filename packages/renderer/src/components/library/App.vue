<script lang="ts" setup>
import type { MangaInDB } from '@api/models/types/manga';
import { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import type { MangaGroup, MangaInDBwithLabel } from '@renderer/components/library/@types';
import GroupCard from '@renderer/components/library/GroupCard.vue';
import GroupFilter from '@renderer/components/library/GroupFilter.vue';
import MigrateManga from '@renderer/components/library/migrate/App.vue';
import { chapterLabel } from '@renderer/components/reader/helpers';
import langOptions from '@renderer/components/settings/languageList.vue';
import mirrorsOptions from '@renderer/components/settings/mirrorsOptions.vue';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** router */
router = useRouter(),
/** settings */
settings = useSettingsStore();

// states
const
/** first start stepper */
step = ref(settings.library.firstTimer),
/** are we fetching the api? */
fetching = ref(true),
/** mangas in db */
mangasRAW = ref<MangaGroup[]>([]),
/** mangas in db from dead mirrors */
deadMangas = ref<(MangaInDBwithLabel & { covers: string[], mirrorDisplayName: string, mirrorIcon: string })[]>([]),
/** mirrors */
mirrors = ref<mirrorInfo[]>([]),
/** search */
search = ref<string|null>(null),
/** filters */
filters = ref<{
  mirrors: string[],
  langs: mirrorsLangsType[],
  userCategories: string[]
}>({
  mirrors: [],
  langs: [],
  userCategories: [],
});

// computed
const
/** list of mangas sources */
mirrorList = computed(() => {
  const mangasMirrors = mangasRAW.value.map(m => m.mangas.map(mm => mm.mirror)).flat();
  const deadMangasMirrors = deadMangas.value.map(m => m.mirror);

  return Array.from(
    new Set([...mangasMirrors, ...deadMangasMirrors]),
  )
  .map(m => mirrors.value.find(mir => mir.name === m));
}),
/** list of mangas langs */
langs = computed(() => {
  const set:Set<mirrorsLangsType> = new Set();
  mangasRAW.value.forEach(g => g.mangas.forEach(m => m.langs.forEach(l => set.add(l))));
  return Array.from(set);
}),
/** user categories */
userCategories = computed(() => {
  const set:Set<string> = new Set();
  mangasRAW.value.forEach(g => g.mangas.forEach(m => m.userCategories.forEach(l => set.add(l))));
  return Array.from(set);
}),
/** sorted list of mangas grouped by title */
mangas = computed(() => {
  if(settings.library.sort === 'AZ') return sortByAlphabetical(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'ZA') return sortByUnalphabetical(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'read') return sortByLeastUnread(stackedFilters(mangasRAW.value));
  else if(settings.library.sort === 'unread') return sortByMostUnread(stackedFilters(mangasRAW.value));
  else return filterBySearch(hideUnread(mangasRAW.value));
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
    if (curr.langs.length && !g.mangas.some(m => m.langs.some(l => curr.langs.includes(l)))) {
      return false;
    }
    if (curr.userCategories.length && !g.mangas.some(m => m.userCategories.some(c => curr.userCategories.includes(c)))) {
      return false;
    }
    return true;
  });
}

/** add `filterByMirrorAndLang` filter to `MangaGroup[]` */
function stackedFilters(group: MangaGroup[]) {
  return filterByMirrorAndLang(filterBySearch(hideUnread(group)));
}

/** get list of mirrors */
async function getMirrors() {
  const socket = await useSocket(settings.server);
  socket.emit('getMirrors', true, (m) => mirrors.value = m);
}

/** get the library */
async function fetchLibrary() {
  const socket = await useSocket(settings.server);
  const id = Date.now();
  socket.once('showLibrary', (resid, mangas) => {
    if(resid !== id) return;
    else {
      socket.off('showLibrary');
      parseLibrary(mangas);
    }
  });
  socket.emit('showLibrary', id);
}

/** sort and parse library */
function parseLibrary(mangas:MangaInDB[]) {
  fetching.value = false;
  deadMangas.value = [];
  mangasRAW.value = [];
  mangas.forEach(manga => {
    const mirrorInfo = mirrors.value.find(mirror => mirror.name === manga.mirror.name);
    if(!mirrorInfo) return;
    manga.covers = manga.covers.map(c => transformIMGurl(c, settings));
    manga.chapters = manga.chapters.sort((a, b) => b.number - a.number);
    const maxChapter = manga.chapters.reduce((max, chapter) => chapter.read ? Math.max(max, chapter.number) : max, 0);
    let chapterIndex = manga.chapters.findIndex(chapter => chapter.number === maxChapter);
    if(chapterIndex === -1) chapterIndex = manga.chapters.length-1;
    const group = mangasRAW.value.find(group => group.name === manga.displayName || group.name === manga.name);
    const mg:MangaInDBwithLabel = {
      id: manga.id,
      name: manga.name,
      displayName: manga.displayName,
      synopsis: manga.synopsis,
      tags: manga.tags,
      authors: manga.authors,
      mirror: mirrorInfo.name,
      dead: mirrorInfo.isDead,
      broken: manga.meta.broken,
      url: manga.url,
      meta: manga.meta,
      status: manga.status,
      userCategories: manga.userCategories,
      unread: manga.chapters.filter(c => !c.read).length,
      chapters: manga.chapters.map((c, i) => {
        return {
          ...c,
          label: chapterLabel(c.number, c.name),
          value: i,
        };
      }),
      langs: manga.langs,
    };
    if(mg.dead || mg.broken) deadMangas.value.push({ ...mg, covers: manga.covers, mirrorDisplayName: mirrorInfo.displayName, mirrorIcon: mirrorInfo.icon });
    else if(!group) {
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
  });
}

/** get mirrors and fetch library */
async function On() {
  await getMirrors();
  await fetchLibrary();
  const socket = await useSocket(settings.server);
  socket.on('finishedMangasUpdate', (nbOfUpdates) => {
    if(nbOfUpdates > 0) fetchLibrary();
  });
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('showLibrary');
  socket.off('finishedMangasUpdate');
  socket.emit('stopShowLibrary');
}

onBeforeMount(On);
onBeforeUnmount(Off);
</script>
<template>
  <div
    v-if="fetching"
    class="flex w-100 flex-center items-center justify-center"
  >
    <q-circular-progress
      indeterminate
      size="lg"
    />
  </div>
  <div
    v-else
    class="w-100 q-pa-lg"
  >
    <migrate-manga
      v-if="deadMangas.length"
      :mangas="deadMangas"
      bug
    />
    <group-filter
      v-if="mirrorList.length && mangas.length"
      :mirror-list="(mirrorList as mirrorInfo[])"
      :lang-list="langs"
      :user-categories="userCategories"
      @search="(input) => search = input"
      @filter="(mirrors, langs, userCategories) => filters = {mirrors, langs, userCategories}"
    />
    <q-stepper
      v-if="!mangas.length && !deadMangas.length"
      ref="stepper"
      v-model="step"
      active-color="orange"
      inactive-color="grey-7"
      animated
      header-nav
    >
      <q-step
        :name="1"
        :title="$t('languages.language', 20).toLocaleUpperCase()"
        icon="translate"
        :done="settings.library.firstTimer > 1"
      >
        <lang-options
          :stepper="true"
          @continue="() => { settings.library.firstTimer = 2; step = 2 }"
        />
      </q-step>
      <q-step
        :name="2"
        :title="$t('mangas.source', 20).toLocaleUpperCase()"
        icon="travel_explore"
        :done="settings.library.firstTimer > 2"
      >
        <mirrors-options
          :stepper="true"
          @continue="() => { settings.library.firstTimer = 3; step = 3 }"
        />
      </q-step>
      <q-step
        :name="3"
        :title="$t('library.letsgo', 20).toLocaleUpperCase()"
        icon="explore"
        :done="mirrorList.length > 0 && mangas.length > 0"
      >
        <div class="flex column">
          <span class="text-h5">{{ $t('library.ready') }}</span>
          <div class="flex items-center">
            <span>{{ $t('library.change_settings_anytime') }}</span>
            <q-btn
              class="q-mx-sm"
              push
              :color="$q.dark.isActive ? 'grey-7': ''"
              :text-color="$q.dark.isActive ? 'white': 'dark'"
              icon="settings"
              size="sm"
              @click="router.push({name: 'settings'})"
            >
              {{ $t('settings.tab') }}
            </q-btn>
          </div>
          <div class="flex items-center q-mt-lg">
            <q-btn
              class="q-mx-sm"
              push
              color="orange"
              :text-color="$q.dark.isActive ? 'white': 'black'"
              icon="explore"
              :label="$t('explore.tab')"
              @click="router.push({name: 'explore'})"
            />
            <q-btn
              class="q-mx-sm"
              push
              color="orange"
              :text-color="$q.dark.isActive ? 'white': 'black'"
              icon="o_screen_search_desktop"
              :label="$t('search.tab')"
              @click="router.push({name: 'search'})"
            />
          </div>
        </div>
      </q-step>
    </q-stepper>
    <q-infinite-scroll
      v-if="mangas.length"
      class="w-100 q-pa-lg"
    >
      <div
        class="flex flex-center"
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





  <!-- <div
    v-if="(mirrorList.length && (deadMangas.length || mangas.length))"
    class="w-100 q-pa-lg"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
    :dark="$q.dark.isActive"
  >
    <group-filter
      :mirror-list="(mirrorList as mirrorInfo[])"
      :lang-list="langs"
      :user-categories="userCategories"
      @search="(input) => search = input"
      @filter="(mirrors, langs, userCategories) => filters = {mirrors, langs, userCategories}"
    />
    <migrate-manga
      v-if="deadMangas.length"
      :mangas="deadMangas"
      bug
    />
    <q-infinite-scroll
      class="w-100 q-pa-lg"
    >
      <div
        class="flex flex-center"
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
  <div
    v-else
    class="w-100 q-pa-lg"
  >
    <div class="flex column">
      <span class="text-h4 q-mb-lg">{{ $t('library.setup_preferences') }}</span>
    </div>
    <q-stepper
      ref="stepper"
      v-model="step"
      active-color="orange"
      inactive-color="grey-7"
      animated
      header-nav
    >
      <q-step
        :name="1"
        :title="$t('languages.language', 20).toLocaleUpperCase()"
        icon="translate"
        :done="settings.library.firstTimer > 1"
      >
        <lang-options
          :stepper="true"
          @continue="() => { settings.library.firstTimer = 2; step = 2 }"
        />
      </q-step>
      <q-step
        :name="2"
        :title="$t('mangas.source', 20).toLocaleUpperCase()"
        icon="travel_explore"
        :done="settings.library.firstTimer > 2"
      >
        <mirrors-options
          :stepper="true"
          @continue="() => { settings.library.firstTimer = 3; step = 3 }"
        />
      </q-step>
      <q-step
        :name="3"
        :title="$t('library.letsgo', 20).toLocaleUpperCase()"
        icon="explore"
        :done="mirrorList.length > 0 && mangas.length > 0"
      >
        <div class="flex column">
          <span class="text-h5">{{ $t('library.ready') }}</span>
          <div class="flex items-center">
            <span>{{ $t('library.change_settings_anytime') }}</span>
            <q-btn
              class="q-mx-sm"
              push
              :color="$q.dark.isActive ? 'grey-7': ''"
              :text-color="$q.dark.isActive ? 'white': 'dark'"
              icon="settings"
              size="sm"
              @click="router.push({name: 'settings'})"
            >
              {{ $t('settings.tab') }}
            </q-btn>
          </div>
          <div class="flex items-center q-mt-lg">
            <q-btn
              class="q-mx-sm"
              push
              color="orange"
              :text-color="$q.dark.isActive ? 'white': 'black'"
              icon="explore"
              :label="$t('explore.tab')"
              @click="router.push({name: 'explore'})"
            />
            <q-btn
              class="q-mx-sm"
              push
              color="orange"
              :text-color="$q.dark.isActive ? 'white': 'black'"
              icon="o_screen_search_desktop"
              :label="$t('search.tab')"
              @click="router.push({name: 'search'})"
            />
          </div>
        </div>
      </q-step>
    </q-stepper>
  </div> -->
</template>
<style lang="css">
.q-panel.scroll {
  overflow: hidden!important;
}
.q-field--item-aligned .q-field__before {
  min-width: 0px!important;
}
</style>
