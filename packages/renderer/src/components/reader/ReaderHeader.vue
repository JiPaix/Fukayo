<script lang="ts" setup>
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { focusMode, isFullScreen, notify, toggleFullScreen } from '@renderer/components/helpers/toggleFullScreen';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

/** props */
const props = defineProps<{
  sourceURL?: string
  manga: MangaPage|MangaInDB
  chapter: MangaPage['chapters'][0]|MangaInDB['chapters'][0]
  nbOfPages: number
  page: number
  currentChapterString: string
  progress:number
  progressError: boolean
  drawerOpen: boolean
  headerSize: number
}>();

/** emits */
const emit = defineEmits<{
  (event: 'toggleDrawer'): void
  (event: 'headerResize'): void
}>();

// settings
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** stored settings */
settings = useSettingsStore(),
/** router */
router = useRouter();

/** toggle on/off dark mode */
function toggleDarkMode() {
  if (settings.theme === 'dark') {
    settings.theme = 'light';
    $q.dark.set(false);
  } else {
    settings.theme = 'dark';
    $q.dark.set(true);
  }
}

function fullscreen() {
  toggleFullScreen();
  emit('headerResize');
}
/** open chapter in new tab */
function open() {
  if(!props.sourceURL) return;
  const url = `${props.sourceURL}${props.chapter.url}`;
  window.open(url, '_blank');
}

watch(() => [focusMode.value, isFullScreen.value], val => {
  if(val[0]) notify($t('reader.exit_focusMode'));
  if(val[1]) notify($t('app.exit_fullscreen'));
});
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
    <q-toolbar-title
      v-if="manga"
    >
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
      @click="() => toggleDarkMode()"
    />
    <q-btn
      dense
      flat
      round
      :icon="isFullScreen ? 'close_fullscreen' : 'aspect_ratio'"
      @click="() => fullscreen()"
    >
      <q-tooltip>
        <span class="text-uppercase">
          {{ $t('app.fullscreen') }}
        </span>
      </q-tooltip>
    </q-btn>
    <q-btn
      dense
      flat
      round
      icon="filter_center_focus"
      @click="() => focusMode = !focusMode"
    >
      <q-tooltip>
        <span class="text-uppercase">
          {{ $t('reader.focusMode') }}
        </span>
      </q-tooltip>
    </q-btn>
    <q-btn
      flat
      round
      dense
      icon="menu"
      class="q-mx-sm"
      @click="() => emit('toggleDrawer')"
    />
  </q-toolbar>
  <q-bar
    v-if="chapter && manga"
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? '' : 'bg-grey-4 text-dark'"
    class="text-caption"
  >
    <span
      class="flex cursor-pointer"
      @click="open"
    >
      {{ currentChapterString }}
      <q-icon
        class="q-ml-sm"
        name="open_in_new"
      />
    </span>
  </q-bar>
  <q-linear-progress
    v-if="progress < 1"
    :color="progressError ? 'negative' : 'positive'"
    :value="progress"
    size="xs"
    class="fixed-top"
    :style="{ marginTop: `${headerSize}px`, width: ($q.screen.width - (drawerOpen ? 300 : 0))+'px' }"
    animation-speed="500"
  />
</template>
