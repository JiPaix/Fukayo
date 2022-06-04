<script lang="ts" setup>
import { watch, nextTick } from 'vue';
import { onBeforeMount, onMounted, onBeforeUnmount, ref, computed, inject } from 'vue';
import { useRoute } from 'vue-router';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useSocket } from '../helpers/socket';
import {
  isChapterErrorMessage,
  isChapterImage,
  isChapterImageErrorMessage,
  isManga,
  isMangaInDb,
} from '../helpers/typechecker';
import showChapter from '../reader/App.vue';
import type dayjs from 'dayjs';
import type { ComponentPublicInstance} from 'vue';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';

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
const manga = ref<MangaPage|MangaInDB>();
/** mirror info */
const mirrorinfo = ref<mirrorInfo|undefined>();
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
const images = ref<(ChapterImage | ChapterImageErrorMessage)[]>([]);
/** next chapter buffer */
const nextChapterBuffer = ref<{ index:number, nbOfImagesToExpectFromChapter:number|undefined, images : (ChapterImage | ChapterImageErrorMessage)[] } | undefined>();
/** show-chapter template ref */
const chapterRef = ref<ComponentPublicInstance<HTMLInputElement> | null>(null);
/** carrousel slides */
const slide = ref(0);

/** autofocus chapterRef */
watch([manga, chapterSelectedIndex], ([newManga, newIndex]) => {
  if(newManga && newManga.chapters && newManga.chapters.length && newIndex !== null) {
    nextTick(() =>  {
    chapterRef.value?.$el.focus({ preventScroll: true });
    });
  }
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

/** width of the chapter list q-skeleton */
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
function sortImages(images: (ChapterImage | ChapterImageErrorMessage)[]) {
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
 * Fetch the chapter images:
 *
 * put them in `images` array and update `nbOfImagesToExpectFromChapter`
 */
async function fetchChapter(/** index of the chapter */ chapterIndex:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit(
    'showChapter',
    id,
    manga.value.mirror,
    manga.value.lang,
    manga.value.chapters[chapterIndex].url,
    (nbOfPagesToExpect) => {
      // callback returns the number of pages to expect
      nbOfImagesToExpectFromChapter.value = nbOfPagesToExpect;
      socket?.on('showChapter', (id, res) => {
        if (id !== id) return; // should not happen
        if (isChapterImage(res) || isChapterImageErrorMessage(res)) {
          images.value.push(res);
          if(res.lastpage) {
            socket?.off('showChapter');
            if(manga.value && manga.value.chapters[chapterIndex-1]) {
              fetchNextChapter(chapterIndex-1);
            }
          }
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

/**
 * Fetch the next chapter:
 *
 * put it in `nextChapterBuffer.images`, updates `nextChapterBuffer.nbOfImagesToExpectFromChapter` and `nextChapterBuffer.index`
 */
async function fetchNextChapter(/** index of the next chapter */ nextIndex:number) {
  if(!settings.reader.preloadNext) return;
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  nextChapterBuffer.value = {
    nbOfImagesToExpectFromChapter: undefined,
    index: nextIndex,
    images: [],
  };
  socket?.emit(
    'showChapter',
    id,
    manga.value.mirror,
    manga.value.lang,
    manga.value.chapters[nextIndex].url,
    (nbOfImagesToExpectFromChapter) => {
      if(nextChapterBuffer.value) nextChapterBuffer.value.nbOfImagesToExpectFromChapter = nbOfImagesToExpectFromChapter;
      socket?.on('showChapter', (id, res) => {
        if (id !== id) return; // should not happen
        if (isChapterImage(res) || isChapterImageErrorMessage(res)) {
          nextChapterBuffer.value?.images.push(res);
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
  if(!nextChapterBuffer.value) fetchChapter(chapterIndex);
  else if(nextChapterBuffer.value.index !== chapterIndex) fetchChapter(chapterIndex);
  else if(nextChapterBuffer.value.nbOfImagesToExpectFromChapter === undefined) fetchChapter(chapterIndex);
  else if(nextChapterBuffer.value.nbOfImagesToExpectFromChapter === nextChapterBuffer.value.images.length) {
    nbOfImagesToExpectFromChapter.value = nextChapterBuffer.value.nbOfImagesToExpectFromChapter;
    const res:(ChapterImage | ChapterImageErrorMessage)[] = [];
    nextChapterBuffer.value.images.forEach((c) => {
      if(isChapterImage(c) || isChapterImageErrorMessage(c)) res.push(c);
    });
    nextChapterBuffer.value = undefined;
    images.value = res;
    fetchNextChapter(chapterIndex+1);
  }
  else fetchChapter(chapterIndex);
}

/**
 * Request a specific image for a given chapter
 */
async function reloadChapterImage(chapterIndex: number, pageIndex: number) {
  if (!manga.value) return; // should not happen
  // prepare and send the request
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket?.emit(
    'showChapter',
    id,
    manga.value.mirror,
    manga.value.lang,
    manga.value.chapters[chapterIndex].url,
    () => {
      socket?.on('showChapter', (id, res) => {
        if (id !== id) return; // should not happen
        if (isChapterImage(res) || isChapterImageErrorMessage(res)) {
          images.value[pageIndex] = res;
        }
        socket?.off('showChapter');
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

function toggleInLibrary() {
  if(!manga.value) return;
  if(isManga(manga.value) && !isMangaInDb(manga.value)) {
    add();
  }
  else if(!isManga(manga.value) && isMangaInDb(manga.value)) {
    remove();
  }
}

async function add() {
  if(!manga.value) return;
  if (!socket) socket = await useSocket(settings.server);
  socket?.emit('addManga', manga.value, (res) => {
    manga.value = {
      ...res,
      covers: manga.value?.covers || [],
    };
  });
}

async function remove() {
  if(!manga.value) return;
  if (!socket) socket = await useSocket(settings.server);
  if(isMangaInDb(manga.value)) {
    socket?.emit('removeManga', manga.value, (res) => {
      manga.value = res;
    });
  }
}

async function updateManga(updatedManga:MangaInDB|MangaPage) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  if(isMangaInDb(manga.value)) {
    socket.emit('addManga', updatedManga, (res) => {
      manga.value = {...res, covers: manga.value?.covers||[] };
    });
  } else {
    manga.value = updatedManga;
  }
}

async function markAsRead(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const updatedManga = manga.value;
  updatedManga.chapters[index].read = true;
  await updateManga(updatedManga);
}

async function markAsUnread(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const updatedManga = manga.value;
  updatedManga.chapters[index].read = false;
  await updateManga(updatedManga);
}

const unreadChaps = computed(() => {
  if(!manga.value) return [];
  return manga.value.chapters.filter((c) => !c.read);
});

function hasPreviousUnread(index: number) {
  if(!manga.value) return false;
  const chapNum = manga.value.chapters[index].number;
  const unreadFromIndex = unreadChaps.value.filter(c => c.number < chapNum);
  if(unreadFromIndex.length > 0) return true;
  return false;
}

function hasNextUnread(index: number) {
  if(!manga.value) return false;
  const chapNum = manga.value.chapters[index].number;
  const unreadFromIndex = unreadChaps.value.filter(c => c.number > chapNum);
  if(unreadFromIndex.length > 0) return true;
  return false;
}

function markPreviousAsRead(index: number) {
  if(!manga.value) return;
  const chapNum = manga.value.chapters[index].number;
  const updatedChapters = manga.value.chapters.map((c) => {
    if(c.number < chapNum) {
      c.read = true;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markPreviousAsUnread(index: number) {
  if(!manga.value) return;
  const chapNum = manga.value.chapters[index].number;
  const updatedChapters = manga.value.chapters.map((c) => {
    if(c.number < chapNum) {
      c.read = false;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markNextAsRead(index: number) {
  if(!manga.value) return;
  const chapNum = manga.value.chapters[index].number;
  const updatedChapters = manga.value.chapters.map((c) => {
    if(c.number > chapNum) {
      c.read = true;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markNextAsUnread(index: number) {
  if(!manga.value) return;
  const chapNum = manga.value.chapters[index].number;
  const updatedChapters = manga.value.chapters.map((c) => {
    if(c.number > chapNum) {
      c.read = false;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
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

  socket?.on('showManga', (id, mg) => {
    if (id === reqId && (isManga(mg) || isMangaInDb(mg))) {
      manga.value = {
        ...mg,
        chapters: mg.chapters.sort((a, b) => b.number - a.number),
      };
    }
    socket?.off('showManga');
  });

  socket.emit('getMirrors', true, (mirrors) => {
    const m = mirrors.find((m) => m.name === mirror);
    if(m) mirrorinfo.value = m;
    socket?.emit('showManga', reqId, mirror, lang, url);
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
    </q-card-section>
    <q-card-section>
      <!-- Mirror and Language -->
      <div class="flex items-center q-mt-md">
        <span class="q-mr-sm">{{ $t("mangas.source") }}: </span>
        <a
          v-if="manga && mirrorinfo"
          class="text-weight-medium text-white"
          style="text-decoration: none"
          :href="mirrorinfo.host + manga.url"
          target="_blank"
        >
          {{ mirrorinfo.displayName }}

          <q-icon name="open_in_new" />
        </a>
        <q-skeleton
          v-else
          type="text"
          width="50px"
        />
        <img
          v-if="manga && mirrorinfo"
          :src="mirrorinfo.icon"
          :alt="mirrorinfo.displayName"
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
      <div
        v-if="manga"
        class="flex items-center"
      >
        <q-btn
          v-if="manga"
          :icon-right="isMangaInDb(manga) ? 'delete_forever': 'library_add'"
          dense
          size="sm"
          :color="isMangaInDb(manga) ? 'negative' : 'accent'"
          @click="toggleInLibrary"
        >
          {{ isMangaInDb(manga) ? $t('reader.manga.remove') : $t('reader.manga.add') }}
        </q-btn>
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
        <div class="w-100">
          <q-carousel
            v-if="manga && manga.covers.length > 0"
            v-model="slide"
            animated
            infinite
            autoplay
          >
            <q-carousel-slide
              v-for="(mangaCover, i) in manga.covers"
              :key="i"
              :name="i"
              :img-src="mangaCover"
            />
          </q-carousel>
          <div v-else>
            <!-- Cover Skeleton -->
            <q-skeleton
              :height="coverHeight + 'px'"
            />
          </div>
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
              <q-item-section :class="item.read ? 'text-grey-9' : ''">
                <q-item-label>
                  <span v-if="item.volume !== undefined">{{ $t("mangas.volume") }} {{ item.volume }}</span>
                  <span v-if="item.volume !== undefined && item.number !== undefined">
                    -
                  </span>
                  <span
                    v-if="item.number !== undefined"
                  >{{ $t("mangas.chapter") }} {{ item.number }}</span>
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
                <q-item-label class="flex justify-between">
                  <q-btn-group
                    flat
                  >
                    <q-btn
                      icon="play_arrow"
                      dense
                      :color="item.read ? 'orange-9' :'orange'"
                      @click="showChapterComp(index)"
                    />
                    <q-btn
                      :icon="item.read ? 'visibility_off' : 'visibility'"
                      dense
                      :color="item.read ? 'orange-9' :'orange'"
                      @click="item.read ? markAsUnread(index) : markAsRead(index)"
                    >
                      <q-tooltip v-if="item.read">
                        {{ $t('mangas.markasread.current_unread', { chapterWord: $t('mangas.chapter').toLocaleLowerCase() } ) }}
                      </q-tooltip>
                      <q-tooltip v-else>
                        {{ $t('mangas.markasread.current', { chapterWord: $t('mangas.chapter').toLocaleLowerCase() } ) }}
                      </q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="index < manga.chapters.length - 1"
                      icon="arrow_downward"
                      dense
                      :color="hasPreviousUnread(index) ? 'orange' : 'orange-9'"
                      @click="hasPreviousUnread(index) ? markPreviousAsRead(index) : markPreviousAsUnread(index)"
                    >
                      <q-tooltip>
                        {{ $t('mangas.markasread.previous', { chapterWord: $t('mangas.chapter', manga.chapters.length).toLocaleLowerCase() }, manga.chapters.length) }}
                      </q-tooltip>
                    </q-btn>
                    <q-btn
                      v-else
                      color="orange"
                    />
                    <q-btn
                      v-if="index > 0"
                      icon="arrow_upward"
                      dense
                      :color="hasNextUnread(index) ? 'orange' : 'orange-9'"
                      @click="hasNextUnread(index) ? markNextAsRead(index) : markNextAsUnread(index)"
                    >
                      <q-tooltip v-if="hasNextUnread(index)">
                        {{ $t('mangas.markasread.next', { chapterWord: $t('mangas.chapter', manga.chapters.length).toLocaleLowerCase() }, manga.chapters.length) }}
                      </q-tooltip>
                      <q-tooltip v-else>
                        {{ $t('mangas.markasread.previous_unread', { chapterWord: $t('mangas.chapter', manga.chapters.length).toLocaleLowerCase() }, manga.chapters.length) }}
                      </q-tooltip>
                    </q-btn>
                    <q-btn
                      v-else
                      color="orange"
                    />
                  </q-btn-group>
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
      ref="dialogRef"
      v-model="displayChapter"
      maximized
      class="bg-dark"
      transition-show="flip-left"
      transition-hide="flip-right"
      transition-duration="300"
      @hide="hideChapterComp"
    >
      <show-chapter
        v-if="manga && manga.chapters && manga.chapters.length && chapterSelectedIndex !== null"
        ref="chapterRef"
        tabindex="0"
        :manga="manga"
        :chapter-selected-index="chapterSelectedIndex"
        :nb-of-images-to-expect-from-chapter="nbOfImagesToExpectFromChapter"
        :sorted-images="sortedImages"
        @hide="hideChapterComp"
        @reload="reloadChapterImage"
        @navigate="showChapterComp($event)"
        @update-manga="updateManga"
      />
    </q-dialog>
  </q-card>
</template>
