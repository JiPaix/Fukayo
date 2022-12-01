<script lang="ts" setup>
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';

defineProps<{
  manga: MangaPage|MangaInDB
  chapter: MangaPage['chapters'][0]|MangaInDB['chapters'][0]
  nbOfPages: number
  page: number
  currentChapterString: string
}>();

const emit = defineEmits<{
  (event: 'toggleDrawer'): void
}>();

const $q = useQuasar();
const router = useRouter();
const settings = useSettingsStore();
function toggleDarkMode() {
  if (settings.theme === 'dark') {
    settings.theme = 'light';
    $q.dark.set(false);
  } else {
    settings.theme = 'dark';
    $q.dark.set(true);
  }
}
</script>

<template>
  <q-toolbar>
    <q-btn
      flat
      round
      dense
      icon="close"
      class="q-mr-sm"
      @click="router.back()"
    />
    <q-avatar v-if="manga && manga.covers">
      <img :src="transformIMGurl(manga.covers[manga.covers.length-1], settings)">
    </q-avatar>
    <q-skeleton
      v-else
      type="QAvatar"
    />
    <q-toolbar-title v-if="manga">
      <span
        v-if="nbOfPages > 0"
        class="text-subtitle1"
      >
        {{ manga.displayName || manga.name }} {{ `- ${$t('reader.page.count', { current: page, total: nbOfPages })}` }}
      </span>
      <span
        v-else
        class="text-subtitle1"
      >
        {{ manga.displayName || manga.name }} - {{ $t('reader.loading') }}
      </span>
      <q-tooltip>
        {{ manga.name }}
      </q-tooltip>
    </q-toolbar-title>
    <q-btn
      dense
      flat
      round
      icon="contrast"
      @click="toggleDarkMode()"
    />
    <q-btn
      flat
      round
      dense
      icon="menu"
      class="q-mx-sm"
      @click="emit('toggleDrawer')"
    />
  </q-toolbar>
  <q-bar
    v-if="chapter && manga"
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? '' : 'bg-grey-4 text-dark'"
    class="text-caption"
  >
    <span>{{ currentChapterString }}</span>
  </q-bar>
</template>
