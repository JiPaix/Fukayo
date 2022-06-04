<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { chapterLabel } from './helpers';
import { isChapterImageErrorMessage, isMangaInDb } from '../helpers/typechecker';
import { useStore as useStoreSettings } from '/@/store/settings';
import { useQuasar } from 'quasar';
import ImageViewer from './ImageViewer.vue';
import SideBar from './SideBar.vue';
import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';


/** quasar */
const $q = useQuasar();
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** emit */
const emit = defineEmits<{
  (event: 'hide'): void
  (event: 'reload', chapterIndex:number, pageIndex:number): void
  (event: 'navigate', chapterIndex:number): void
  (event: 'update-manga', manga:MangaInDB|MangaPage): void
}>();

/** props */
const props = defineProps<{
  /** the current manga infos */
  manga: MangaPage|MangaInDB,
  /** manga.chapter index to display on screen */
  chapterSelectedIndex: number
  /** the number of pages expected to receive (1-based) */
  nbOfImagesToExpectFromChapter: number
  /** images sorted by index */
  sortedImages: (ChapterImage | ChapterImageErrorMessage)[]
}>();

/** settings */
const settings = useStoreSettings();

/** displays a progress bar while images are loading */
const showProgressBar = computed(() => {
  return props.sortedImages.length < props.nbOfImagesToExpectFromChapter;
});

/** color of the progress bar, orange = loading, red = has erroneous page */
const progressBarColor = computed(() => {
  if(props.sortedImages.length === props.nbOfImagesToExpectFromChapter) {
    if(props.sortedImages.some(isChapterImageErrorMessage)) {
      return 'negative';
    }
  }
  return 'orange';
});

/** Array that acts as a buffer for props.sortedImages */
const images = computed(() =>
  Array.from({length: props.nbOfImagesToExpectFromChapter}, (k, v) => v)
    .map((k, v) => props.sortedImages[v] || { index: v }),
);

/** Display/Hide the sidebar */
const drawerRight = ref(true);
/** Tell the sidebar if the q-header is revealed or not */
const drawerRightReveal = ref(false);

/** Reader settings */
const localSettings = ref<MangaInDB['meta']['options']>({
  webtoon: settings.reader.webtoon,
  showPageNumber:  settings.reader.showPageNumber,
  zoomMode: settings.reader.zoomMode,
  zoomValue: settings.reader.zoomValue,
  longStrip: settings.reader.longStrip,
});

/**
 * Listen to @update-settings from side-bar and update local settings
 */
async function updateSettings(opts: MangaInDB['meta']['options']) {
  localSettings.value = opts;
  if(isMangaInDb(props.manga)) {
    const toUpdate:MangaInDB = {
      ...props.manga,
      meta: {
        ...props.manga.meta,
        options: opts,
      },
    };
    emit('update-manga', toUpdate);
  }
}

/** Previous Chapter */
const previous = computed(() => {
  const chapterIndex = props.chapterSelectedIndex + 1;
  if(chapterIndex >= props.manga.chapters.length) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});

/** Next Chapter */
const next = computed(() => {
  const chapterIndex = props.chapterSelectedIndex - 1;
  if(chapterIndex < 0) return null;
  return {
    label: props.manga.chapters[chapterIndex].name || props.manga.chapters[chapterIndex].number,
    value: chapterIndex,
  };
});

/** First Chapter */
const first = computed(() => {
  const chapterIndex = props.manga.chapters.length - 1;
  if(!previous.value || chapterIndex < 0) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});

/** Last Chapter */
const last = computed(() => {
  const chapterIndex = 0;
  if(!next.value) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});


/**
 * the current page index
 *
 * `{ from : 'parent' }` => the user actively requested the next/previous page
 *
 * `{ from : 'child' }` => the page component observed a scroll to the next/previous page
 */
const currentPageIndex = ref<{index: number, from: 'child'|'parent'}>({ index: 0, from: 'parent' });
/** how many times the user triggerd a "next-page" event */
const forwardNavCount = ref<0|1|2>(0);
/** when occured the last "next-page" event */
const lastNavForward = ref(Date.now());
/** how many times the user triggered a "previous-page" event */
const backNavCount = ref(Date.now());
/** when occured the last "previous-page" event */
const lastNavBack = ref(0);
/** is the last page of the chapter on screen? */
const lastPageNav = computed(() => currentPageIndex.value.index === images.value.length - 1);
/** is the first page of the chapter on screen? */
const firstPageNav = computed(() => currentPageIndex.value.index === 0);

/**
 * Move user to next page
 *
 * increment "next-page" event count if the user is on the last page
 */
function incrementNav() {
  if(lastPageNav.value) forwardNavCount.value = Math.min(forwardNavCount.value + 1, 2) as 0|1|2;
  else forwardNavCount.value = 0;
  backNavCount.value = 0; // also reset "previous-page" event count
  if(currentPageIndex.value.index < images.value.length - 1) {
    //
    currentPageIndex.value = { index: currentPageIndex.value.index + 1, from: 'parent' };
  }
}
/**
 * Move user to previous page
 *
 * increment "previous-page" event count if the user is on the last page
 */
function decrementNav() {
  if(firstPageNav.value) backNavCount.value = Math.min(backNavCount.value + 1, 2);
  else backNavCount.value = 0;
  forwardNavCount.value = 0; // also reset "next-page" event count
  if(currentPageIndex.value.index > 0) {
    currentPageIndex.value = { index: currentPageIndex.value.index - 1, from: 'parent' };
  }
}

/** listening to keyup events */
function onKey(event: KeyboardEvent) {
  if(event.key === 'ArrowRight') {
    incrementNav(); // move to next page
    const delta = Date.now() - lastNavForward.value;
    if(delta < 300) {
      // if the user is rapidly pressing the arrow key and he is on the last page move to the next chapter
      if(next.value !== null && lastPageNav.value) return navigation(next.value.value);
    }
    // in other case, update the "next-page" event count
    lastNavForward.value = Date.now();
  }
  else if(event.key === 'ArrowLeft') {
    decrementNav(); // move to previous page
    const delta = Date.now() - lastNavBack.value;
    console.log('d', delta, 'back', backNavCount.value);
    if(delta < 300) {
      // if the user is rapidly pressing the arrow key and he is on the first page move to the previous chapter
      if(previous.value !== null && firstPageNav.value) return navigation(previous.value.value);
    }
    // in other case, update the "previous-page" event count
    lastNavBack.value = Date.now();
  }
}

/** move to `manga.chapters[index]` */
function navigation(index:number) {
  // we need to reset all the navigation events count first
  forwardNavCount.value = 0;
  backNavCount.value = 0;
  lastNavBack.value = 0;
  lastNavForward.value = 0;
  currentPageIndex.value = { index: 0, from: 'parent' };
  //=> move to the next chapter
  emit('navigate', index);
}

async function markAsRead() {
  if(lastPageNav.value) {
    const chapter = props.manga.chapters[props.chapterSelectedIndex];
    const toUpdate = {
      ...props.manga,
      chapters : props.manga.chapters.map(c => {
        if(c.id === chapter.id) {
          return {
            ...c,
            read: true,
          };
        }
        return c;
      }),
    };
    emit('update-manga', toUpdate);
  }
}

</script>
<template>
  <q-layout
    view="lHh lpR lFf"
    container
    class="shadow-2 rounded-borders"
    @keyup="onKey"
  >
    <q-header
      elevated
      class="bg-dark"
      reveal
      @reveal="drawerRightReveal = !drawerRightReveal"
    >
      <q-toolbar>
        <q-btn
          flat
          round
          dense
          icon="close"
          class="q-mr-sm"
          @click="emit('hide')"
        />
        <q-avatar v-if="manga.covers">
          <img :src="manga.covers[0]">
        </q-avatar>
        <q-skeleton
          v-else
          type="QAvatar"
        />
        <q-toolbar-title>
          <span class="text-subtitle1">{{ manga.displayName || manga.name }}  - {{ currentPageIndex.index }}</span>
          <q-tooltip>
            {{ manga.name }}
          </q-tooltip>
        </q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="menu"
          class="q-mx-sm"
          @click="drawerRight = !drawerRight"
        />
      </q-toolbar>
      <q-bar
        :dark="$q.dark.isActive"
        :class="$q.dark.isActive ? '' : 'bg-grey-4 text-dark'"
      >
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume !== undefined"
          class="text-caption"
        >
          {{ $t('mangas.volume') }} {{ manga.chapters[chapterSelectedIndex].volume }}
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume !== undefined && manga.chapters[chapterSelectedIndex].number !== undefined"
          class="text-caption"
        >
          -
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].number !== undefined"
          class="text-caption"
        >
          {{ $t('mangas.chapter') }} {{ manga.chapters[chapterSelectedIndex].number }}
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume === undefined && manga.chapters[chapterSelectedIndex].number === undefined"
          class="text-caption"
        >
          {{ manga.chapters[chapterSelectedIndex].name }}
        </span>
      </q-bar>
    </q-header>
    <q-footer>
      <q-linear-progress
        v-if="showProgressBar"
        :dark="$q.dark.isActive"
        class="absolute absolute-bottom"
        style="margin-left: 0"
        size="4px"
        :color="progressBarColor"
        :value="sortedImages.length/nbOfImagesToExpectFromChapter"
        animation-speed="500"
      />
    </q-footer>
    <side-bar
      :drawer="drawerRight"
      :drawer-reveal="drawerRightReveal"
      :manga="manga"
      :chapter-selected-index="chapterSelectedIndex"
      :reader-settings="isMangaInDb(manga) ? manga.meta.options : localSettings"
      :first="first"
      :previous="previous"
      :next="next"
      :last="last"
      @toggle-drawer="drawerRight = !drawerRight"
      @navigate="navigation"
      @update-settings="updateSettings"
    />
    <q-page-container>
      <q-page>
        <image-viewer
          :images="images"
          :nb-of-images-to-expect-from-chapter="props.nbOfImagesToExpectFromChapter"
          :chapter-selected-index="chapterSelectedIndex"
          :reader-settings="isMangaInDb(manga) ? manga.meta.options : localSettings"
          :manga="manga"
          :current-page="currentPageIndex"
          @page-change="currentPageIndex = $event; markAsRead()"
          @reload="(chapterIndex, pageIndex) => emit('reload', chapterIndex, pageIndex)"
          @navigate="navigation"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css" scoped>
:focus-visible {
    outline: -webkit-focus-ring-color auto 0px;
}
</style>

