<script lang="ts" setup>
import { onBeforeMount, onMounted, onBeforeUnmount, ref, computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useSocket } from './helpers/socket';
import { isChapterErrorMessage, isChapterPage, isChapterPageErrorMessage, isManga } from './helpers/typechecker';
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
let socket:socketClientInstance|undefined;


/** manga infos */
const refs = ref<MangaPage>();
/** manga cover template ref */
const cover = ref<HTMLImageElement | null>(null);
/** height of the cover */
const coverHeight = ref<number>();
/** show/hide the chapter images dialog */
const displayChapter = ref(false);
/** index of the manga.chapter to show */
const chapterSelectedIndex = ref<number|null>(null);
/** number of images to expect from the server */
const nbOfImagesToExpectFromChapter = ref(0);
/** images and/or error messages */
const images = ref<(ChapterPage | ChapterPageErrorMessage)[]>([]);

/** computed manga infos */
const manga = computed<MangaPage | undefined>(() => {
  if(refs.value) {
    const chapters = refs.value.chapters;
    const sorted = chapters.sort((a, b) => b.number - a.number);
    return {
      id: refs.value.id,
      mirrorInfo: refs.value.mirrorInfo,
      url:refs.value.url,
      lang:refs.value.lang,
      name: refs.value.name,
      covers: refs.value.covers,
      synopsis: refs.value.synopsis,
      tags: refs.value.tags,
      chapters: sorted,
    };
  }
  return undefined;
});

/**
 * Returns an array of pages and pages error sorted by index
 */
const sortedImages = computed(() => {
  if(images.value) {
    return sortImages(images.value);
  }
  return [];
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
function onResize(o:{height:number}) {
  coverHeight.value = o.height;
}

/**
 * Show chapter images dialog
 * @param chapterIndex index of the manga.chapter to show
 */
async function showChapterComp(chapterIndex:number) {
  if(!manga.value) return; // should not happen
  // prepare the dialog
  images.value = [];
  chapterSelectedIndex.value = chapterIndex;
  displayChapter.value = true;

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
async function startChapterFetch(chapterIndex:number) {
  if(!manga.value) return; // should not happen
  // prepare and send the request
  if(!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit('showChapter', id, manga.value.mirrorInfo.name, manga.value.lang, manga.value.chapters[chapterIndex].url, (nbOfPagesToExpect) => {
    // callback returns the number of pages to expect
    nbOfImagesToExpectFromChapter.value = nbOfPagesToExpect;
    socket?.on('showChapter', (id, res) => {
      if(id !== id) return; // should not happen
      if(isChapterPage(res) || isChapterPageErrorMessage(res)) {
        images.value.push(res);
      } else if(isChapterErrorMessage(res)) {
        // TODO: show error message
        // at this point either the mirror is down or the chapter is not available on the server (url is wrong?)
      } else {
        // unhandled should not happen
      }
    });
  });
}

async function reloadChapterImage(chapterIndex:number, pageIndex:number) {
  if(!manga.value) return; // should not happen
  // prepare and send the request
  if(!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit('showChapter', id, manga.value.mirrorInfo.name, manga.value.lang, manga.value.chapters[chapterIndex].url, () => {
    socket?.on('showChapter', (id, res) => {
      if(id !== id) return; // should not happen
      if(isChapterPage(res) || isChapterPageErrorMessage(res)) {
        images.value[pageIndex] = res;
      }
    });
  }, pageIndex);
}

/**
 * Cancel chapter fetching
 */
async function cancelChapterFetch() {
  if(!socket) socket = await useSocket(settings.server);
  socket?.emit('stopShowChapter');
}

/** fetch manga infos before component is mounted */
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  const {mirror, lang, url} = route.params as {mirror:string, lang:string, url:string};
  const reqId = Date.now();
  socket?.emit('showManga', reqId, mirror, lang , url);
  socket?.on('showManga', (id, mg) => {
    if(id === reqId && isManga(mg)) {
      refs.value = {...mg};
    }
  });
});

/**
 * get the height of the cover when the component is mounted
 */
onMounted(() => {
  if(cover.value) coverHeight.value = cover.value.height;
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
    v-if="manga"
    class="w-100"
  >
    <q-card-section
      class="text-center"
    >
      <!-- Title -->
      <div>
        <span
          class="text-h3"
        >
          {{ manga.name }}
        </span>
      </div>
      <!-- Tags -->
      <div v-if="manga.tags">
        <q-chip
          v-for="(tag, i) in manga.tags"
          :key="i"
          color="orange"
        >
          {{ tag }}
        </q-chip>
      </div>
      <!-- Tags Skeleton -->
      <div
        v-else
        class="flex justify-center"
      >
        <q-skeleton
          v-for="i in 3"
          :key="i"
          type="QChip"
        />
      </div>
      <!-- Mirror and Language -->
      <div class="flex items-center">
        <span class="q-mr-sm">{{ $t('mangas.source.value') }}: </span>
        <a
          class="text-weight-medium text-white"
          style="text-decoration: none;"
          :href="manga.mirrorInfo.host+manga.url"
          target="_blank"
        >
          {{ manga.mirrorInfo.displayName }}



          <q-icon name="open_in_new" />


        </a>
        <img
          :src="manga.mirrorInfo.icon"
          :alt="manga.mirrorInfo.displayName"
          class="q-ml-sm"
        >
      </div>
      <div class="flex items-center">
        {{ $t('languages.language.value') }}:
        <span class="text-weight-medium q-ml-sm">{{ $t('languages.'+manga.lang+'.value') }}</span>
        <span
          class="fi q-ml-sm"
          :class="'fi-'+$t('languages.'+manga.lang+'.flag')"
        />
      </div>
    </q-card-section>
    <q-card-section>
      <!-- Synopsis -->
      <div v-if="manga.synopsis">
        {{ manga.synopsis }}
      </div>
      <!-- Synopsis Skeleton -->
      <q-skeleton
        v-else
        type="text"
        class="w-100 q-px-xl q-py-lg"
        style="height:180px"
      />
    </q-card-section>

    <div class="row">
      <q-card-section class="col-xs-12 col-sm-5 col-md-4 col-lg-2">
        <div>
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
            height="400px"
          />
          <q-resize-observer @resize="onResize" />
        </div>
      </q-card-section>
      <q-card-section class="col-lg-10 col-sm-7 col-md-8 col-xs-12">
        <!-- Chapters list -->
        <q-virtual-scroll
          v-if="manga.chapters"
          :style="$q.screen.xs ? '': 'height: '+coverHeight+'px'"
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
                  <span v-if="item.volume !== undefined">{{ $t('mangas.volume.value') }} {{ item.volume }}</span>
                  <span v-if="item.volume !== undefined && item.number !== undefined"> - </span>
                  <span v-if="item.number !== undefined">{{ $t('mangas.chapter.value') }} {{ item.number }}</span>
                  <span v-if="item.volume === undefined && item.number === undefined">{{ item.name }}</span>
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
        <q-skeleton
          v-for="i in 20"
          v-else
          :key="i"
          type="text"
          :height="(coverHeight||0)/20+'px'"
          class="q-pa-sm"
        />
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
        :manga="manga"
        :chapter-selected-index="chapterSelectedIndex"
        :nb-of-images-to-expect-from-chapter="nbOfImagesToExpectFromChapter"
        :sorted-images="sortedImages"
        @hide="hideChapterComp"
        @reload="reloadChapterImage"
      />
    </q-dialog>
  </q-card>
</template>
