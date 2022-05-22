<script lang="ts" setup>
import { onBeforeMount, onMounted, onBeforeUnmount, ref, computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useSocket } from './helpers/socket';
import {
  isChapterErrorMessage,
  isChapterPage,
  isChapterPageErrorMessage,
  isManga,
} from './helpers/typechecker';
import showChapter from './showChapter.vue';
import type dayjs from 'dayjs';
import type { socketClientInstance } from '../../../api/src/client/types';
import type { ChapterPage } from '../../../api/src/models/types/chapter';
import type { ChapterPageErrorMessage } from '../../../api/src/models/types/errors';
import type { MangaPage } from '../../../api/src/models/types/manga';

/** quasar */
const $q = useQuasar();
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** dayJS lib */
const dayJS = inject<typeof dayjs>('dayJS');
/** current route */
const route = useRoute();
/** stored settings */
const settings = useSettingsStore();
/** web socket */
let socket: socketClientInstance | undefined;

/** manga infos */
const refs = ref<MangaPage>();
/** manga cover template ref */
const cover = ref<HTMLImageElement | null>(null);
/** height of the cover */
const coverHeight = ref<number>(0);
/** width of the cover */
const coverWidth = ref<number>(0);
/** show/hide the chapter images dialog */
const displayChapter = ref(false);
/** index of the manga.chapter to show */
const chapterSelectedIndex = ref<number | null>(null);
/** number of images to expect from the server */
const nbOfImagesToExpectFromChapter = ref(0);
/** images and/or error messages */
const images = ref<(ChapterPage | ChapterPageErrorMessage)[]>([]);

/** computed manga infos */
const manga = computed<MangaPage | undefined>(() => {
  if (refs.value) {
    const chapters = refs.value.chapters;
    const sorted = chapters.sort((a, b) => b.number - a.number);
    return {
      id: refs.value.id,
      mirrorInfo: refs.value.mirrorInfo,
      url: refs.value.url,
      lang: refs.value.lang,
      name: refs.value.name,
      covers: refs.value.covers,
      synopsis: refs.value.synopsis,
      tags: refs.value.tags,
      authors: refs.value.authors,
      chapters: sorted,
    };
  }
  return undefined;
});

/**
 * Returns an array of pages and pages error sorted by index
 */
const sortedImages = computed(() => {
  if (images.value) {
    return sortImages(images.value);
  }
  return [];
});


const chapterSkeletonWidth = computed(() => {
  if($q.screen.xs) return coverWidth.value + 'px';
  if($q.screen.sm) return coverWidth.value*1.2 + 'px';
  if($q.screen.gt.sm) return coverWidth.value*2 + 'px';
  return '1px';
});
/**
 * Sort the chapters pages and pages errors by their index
 * @param images array including images and error messages
 */
function sortImages(images: (ChapterPage | ChapterPageErrorMessage)[]) {
  return images.sort((a, b) => a.index - b.index);
}

/**
 * Update the height of the cover
 * @param o Object containing the size of the cover
 * @param o.width the width of the cover
 */
function onResize(o: { height: number, width: number }) {
  coverHeight.value = o.height;
  coverWidth.value = o.width;
}

/**
 * Show chapter images dialog
 * @param chapterIndex index of the manga.chapter to show
 */
async function showChapterComp(chapterIndex:number) {
  if(displayChapter.value) cancelChapterFetch();
  if(!manga.value) return; // should not happen
  // prepare the dialog
  images.value = [];
  chapterSelectedIndex.value = chapterIndex;
  displayChapter.value = true;
  nbOfImagesToExpectFromChapter.value = 0;
  startChapterFetch(chapterIndex);
}

/**
 * Hide chapter images dialog
 */
async function hideChapterComp() {
  displayChapter.value = false;
  chapterSelectedIndex.value = null;
  images.value = [];
  nbOfImagesToExpectFromChapter.value = 0;
  cancelChapterFetch();
}

/**
 * Request all images for a given chapter
 * @param chapterIndex index of the manga.chapter to show
 * @see {@link MangaPage}
 */
async function startChapterFetch(chapterIndex: number) {
  if (!manga.value) return; // should not happen
  // prepare and send the request
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit(
    'showChapter',
    id,
    manga.value.mirrorInfo.name,
    manga.value.lang,
    manga.value.chapters[chapterIndex].url,
    (nbOfPagesToExpect) => {
      // callback returns the number of pages to expect
      nbOfImagesToExpectFromChapter.value = nbOfPagesToExpect;
      socket?.on('showChapter', (id, res) => {
        if (id !== id) return; // should not happen
        if (isChapterPage(res) || isChapterPageErrorMessage(res)) {
          images.value.push(res);
          if(res.lastpage) socket?.off('showChapter');
        } else if (isChapterErrorMessage(res)) {
          // TODO: show error message
          // at this point either the mirror is down or the chapter is not available on the server (url is wrong?)
        } else {
          // unhandled should not happen
        }
      });
    },
  );
}

async function reloadChapterImage(chapterIndex: number, pageIndex: number) {
  if (!manga.value) return; // should not happen
  // prepare and send the request
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit(
    'showChapter',
    id,
    manga.value.mirrorInfo.name,
    manga.value.lang,
    manga.value.chapters[chapterIndex].url,
    () => {
      socket?.on('showChapter', (id, res) => {
        if (id !== id) return; // should not happen
        if (isChapterPage(res) || isChapterPageErrorMessage(res)) {
          images.value[pageIndex] = res;
        }
      });
    },
    pageIndex,
  );
}

/**
 * Cancel chapter fetching
 */
async function cancelChapterFetch() {
  if (!socket) socket = await useSocket(settings.server);
  socket?.emit('stopShowChapter');
  socket?.off('showChapter');
}

/** fetch manga infos before component is mounted */
onBeforeMount(async () => {
  if (!socket) socket = await useSocket(settings.server);
  const { mirror, lang, url } = route.params as {
    mirror: string;
    lang: string;
    url: string;
  };
  const reqId = Date.now();
  socket?.emit('showManga', reqId, mirror, lang, url);
  socket?.on('showManga', (id, mg) => {
    if (id === reqId && isManga(mg)) {
      refs.value = { ...mg };
    }
  });
});

/**
 * get the height of the cover when the component is mounted
 */
onMounted(() => {
  if (cover.value) {
    coverHeight.value = cover.value.height;
    coverWidth.value = cover.value.width;
  }
});

/**
 * stop fetching manga infos when component is unmounted
 */
onBeforeUnmount(() => {
  socket?.emit('stopShowManga');
  socket?.off('showChapter');
  socket?.off('showManga');
});
</script>
<template>
  <q-card
    class="w-100"
  >
    <q-card-section
      class="text-center"
    >
      <div v-if="manga">
        <span class="text-h3">
          {{ manga.name }}
        </span>
      </div>
      <div v-else>
        <span class="text-h3">
          <q-skeleton
            type="rect"
            height="57px"
            class="q-mb-sm"
          />
        </span>
      </div>
      <!-- Tags -->
      <div v-if="manga">
        <q-chip
          v-for="(tag, i) in manga.tags"
          :key="i"
          color="orange"
        >
          {{ tag }}
        </q-chip>
      </div>
      <div
        v-else
        class="flex justify-center"
      >
        <q-skeleton
          v-for="i in 4"
          :key="i"
          type="QChip"
        />
      </div>
      <!-- Mirror and Language -->
      <div class="flex items-center">
        <span class="q-mr-sm">{{ $t("mangas.source.value") }}: </span>
        <a
          v-if="manga"
          class="text-weight-medium text-white"
          style="text-decoration: none"
          :href="manga.mirrorInfo.host + manga.url"
          target="_blank"
        >
          {{ manga.mirrorInfo.displayName }}

          <q-icon name="open_in_new" />
        </a>
        <q-skeleton
          v-else
          type="text"
          width="50px"
        />
        <img
          v-if="manga"
          :src="manga.mirrorInfo.icon"
          :alt="manga.mirrorInfo.displayName"
          class="q-ml-sm"
        >
        <q-skeleton
          v-else
          height="16px"
          width="16px"
          type="rect"
          class="q-ml-sm"
        />
      </div>
      <div
        class="flex items-center"
      >
        {{ $t("languages.language.value") }}:
        <span
          v-if="manga"
          class="text-weight-medium q-ml-sm"
        >
          {{ $t("languages." + manga.lang + ".value") }}
        </span>
        <q-skeleton
          v-else
          type="text"
          class="text-weight-medium q-ml-sm"
          width="50px"
        />
      </div>
    </q-card-section>
    <q-card-section v-if="manga">
      <!-- Synopsis -->
      <div v-if="manga.synopsis">
        {{ manga.synopsis }}
      </div>
    </q-card-section>
    <q-card-section v-else>
      <!-- Synopsis Skeleton (42px = 2 lines) -->
      <q-skeleton
        type="rect"
        style="height: 42px"
      />
    </q-card-section>
    <div
      class="row"
    >
      <q-card-section class="col-xs-12 col-sm-5 col-md-4 col-lg-2">
        <div v-if="manga">
          <!-- Cover -->
          <img
            v-if="manga.covers && manga.covers.length > 0"
            ref="cover"
            class="rounded-borders w-100"
            :src="manga.covers[0]"
          >
          <!-- Cover Skeleton -->
          <q-skeleton
            v-else
            :height="coverHeight + 'px'"
          />
          <q-resize-observer @resize="onResize" />
        </div>
        <div v-else>
          <!-- Cover Skeleton -->
          <q-skeleton
            :height="coverHeight + 'px'"
          />
          <q-resize-observer @resize="onResize" />
        </div>
      </q-card-section>
      <q-card-section
        v-if="manga && manga.chapters && manga.chapters.length"
        class="col-lg-10 col-sm-7 col-md-8 col-xs-12"
      >
        <!-- Chapters list -->
        <q-virtual-scroll
          :style="$q.screen.xs ? '' : 'height: ' + coverHeight + 'px'"
          :items="manga.chapters"
          separator
        >
          <template #default="{ item, index }">
            <q-item
              :key="index"
              @click="showChapterComp(index)"
            >
              <!-- Chapter name, volume, number -->
              <q-item-section>
                <q-item-label>
                  <span v-if="item.volume !== undefined">{{ $t("mangas.volume.value") }} {{ item.volume }}</span>
                  <span v-if="item.volume !== undefined && item.number !== undefined">
                    -
                  </span>
                  <span v-if="item.number !== undefined">{{ $t("mangas.chapter.value") }} {{ item.number }}</span>
                  <span v-if="item.volume === undefined && item.number === undefined">{{
                    item.name
                  }}</span>
                </q-item-label>
                <q-item-label
                  v-if="item.number !== undefined"
                  caption
                >
                  {{ item.name }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
                top
              >
                <!-- Chapter Date -->
                <q-item-label caption>
                  {{ dayJS ? dayJS(item.date).fromNow() : item.date }}
                </q-item-label>
                <!-- Chapter Action Buttons -->
                <q-item-label>
                  <q-btn
                    icon="play_arrow"
                    round
                    color="orange"
                    size="xs"
                    @click="showChapterComp(index)"
                  />
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-virtual-scroll>
        <!-- Chapters list Skeleton -->
      </q-card-section>
      <q-card-section v-else>
        <div
          class="flex column"
          :style="'max-height: ' + coverHeight + 'px'"
          style="overflow: hidden"
        >
          <q-skeleton
            v-for="i in 60"
            :key="i"
            type="text"
            :width="chapterSkeletonWidth"
          />
        </div>
      </q-card-section>
    </div>
    <!-- show Chapter Dialog -->
    <q-dialog
      v-if="chapterSelectedIndex !== null"
      ref="dialogRef"
      v-model="displayChapter"
      maximized
      class="bg-dark"
      @hide="hideChapterComp"
    >
      <showChapter
        v-if="manga && manga.chapters && manga.chapters.length"
        :manga="manga"
        :chapter-selected-index="chapterSelectedIndex"
        :nb-of-images-to-expect-from-chapter="nbOfImagesToExpectFromChapter"
        :sorted-images="sortedImages"
        @hide="hideChapterComp"
        @reload="reloadChapterImage"
        @navigate="showChapterComp($event)"
      />
    </q-dialog>
  </q-card>
</template>
