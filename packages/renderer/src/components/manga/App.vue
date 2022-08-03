<script lang="ts" setup>
import { watch, nextTick, inject } from 'vue';
import { onBeforeMount, onBeforeUnmount, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStore as useSettingsStore } from '/@/store/settings';
import { QItem, useQuasar } from 'quasar';
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

import type { ComponentPublicInstance } from 'vue';
import type dayjs from 'dayjs';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { ChapterImage } from '../../../../api/src/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage } from '../../../../api/src/models/types/errors';
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
/** mirror info */
const mirrorinfo = ref<mirrorInfo|undefined>();
/** show/hide the chapter images dialog */
const displayChapter = ref(false);
/** the number of chapters */
const nbOfChapters = ref(0);
/** index of the manga.chapter to show */
const chapterSelectedIndex = ref<number | null>(null);
/** number of images to expect from the server */
const nbOfImagesToExpectFromChapter = ref(0);
/** images and/or error messages */
const images = ref<(ChapterImage | ChapterImageErrorMessage)[]>([]);
/** message if chapter couldn't load */
const chapterError = ref<string|null>(null);
/** next chapter buffer */
const nextChapterBuffer = ref<{ index:number, nbOfImagesToExpectFromChapter:number|undefined, images : (ChapterImage | ChapterImageErrorMessage)[], error?: ChapterErrorMessage } | undefined>();
/** infos template ref */
const content = ref<HTMLElement>();
/** show-chapter template ref */
const chapterRef = ref<ComponentPublicInstance<HTMLInputElement> | null>(null);
/** carrousel slides */
const slide = ref(0);

type Manga = MangaInDB | MangaPage;
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
/** manga infos as retrieved by the server */
const mangaRaw = ref<PartialBy<Manga, 'chapters'>>();

const chapters = computed(() => {
  if (mangaRaw.value && mangaRaw.value.chapters) {
    return mangaRaw.value.chapters;
  }
  return [];
});
/** manga infos */
const manga = computed(() => {
  if(!mangaRaw.value) return undefined;
  return {
    ...mangaRaw.value,
    chapters: chapters.value.map(chapter => {
      const hasNextUnread = unreadChaps.value.filter(search => search.number > chapter.number).length > 0;
      const hasPrevUnread = unreadChaps.value.filter(search => search.number < chapter.number).length > 0;
      return {
        ...chapter,
        hasNextUnread,
        hasPrevUnread,
      };
    }),
  };
});

/** Reader settings */
const localSettings = ref<MangaInDB['meta']['options']>({
  webtoon: (manga.value && isMangaInDb(manga.value)) ? manga.value.meta.options.webtoon : settings.reader.webtoon,
  showPageNumber: (manga.value && isMangaInDb(manga.value)) ? manga.value.meta.options.showPageNumber : settings.reader.showPageNumber,
  zoomMode: (manga.value && isMangaInDb(manga.value)) ? manga.value.meta.options.zoomMode : settings.reader.zoomMode,
  zoomValue: (manga.value && isMangaInDb(manga.value)) ? manga.value.meta.options.zoomValue : settings.reader.zoomValue,
  longStrip: (manga.value && isMangaInDb(manga.value)) ? manga.value.meta.options.longStrip : settings.reader.longStrip,
});

/** unread chapters */
const unreadChaps = computed(() => {
  return chapters.value.filter((c) => !c.read);
});

/** chapter's images sorted by page number */
const sortedImages = computed(() => {
  if (images.value) {
    return sortImages(images.value);
  }
  return [];
});

/** q-virtual-scroll height */
const virtualScrollHeight = computed(() => {
  if(content.value && $q.screen.lg) {
    const size = $q.screen.height - content.value.clientHeight - 100;
    // turn "size" into a multiple of 52
    return Math.floor(size / 52) * 52;
  }
  const size = $q.screen.height - 100;
  // turn "size" into a multiple of 52
  return Math.floor(size / 52) * 52;
});

/** autofocus chapterRef */
watch([manga, chapterSelectedIndex], ([newManga, newIndex]) => {
  if(newManga && newManga.chapters && newManga.chapters.length && newIndex !== null) {
    nextTick(() =>  {
    chapterRef.value?.$el.focus({ preventScroll: true });
    });
  }
});



/**
 * Sort the chapters pages and pages errors by their index
 * @param images array including images and error messages
 */
function sortImages(images: (ChapterImage | ChapterImageErrorMessage)[]) {
  return images.sort((a, b) => a.index - b.index);
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
          chapterError.value = res.trace || res.error;
        } else {
          // unhandled should not happen
          chapterError.value =  $t('reader.error.chapter', {chapterWord: $t('mangas.chapter').toLocaleLowerCase() });
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
    error: undefined,
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
            socket?.off('showChapter');
            nextChapterBuffer.value = { index: nextIndex, images: [], nbOfImagesToExpectFromChapter: undefined, error: res };
        } else {
          socket?.off('showChapter');
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
  chapterError.value = null;
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
  else if(nextChapterBuffer.value.error) {
    chapterError.value = nextChapterBuffer.value.error.trace || nextChapterBuffer.value.error.error;
    nextChapterBuffer.value = undefined;
  }
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
async function reloadChapterImage(chapterIndex: number, pageIndex?: number) {
  if (!manga.value) return; // should not happen
  // prepare and send the request
  if (!socket) socket = await useSocket(settings.server);
  if(!pageIndex) {
    if(chapterSelectedIndex.value) return showChapterComp(chapterSelectedIndex.value);
    return;
  }
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
  socket?.emit('addManga', { manga: manga.value, settings: localSettings.value }, (res) => {
    mangaRaw.value = {
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
      mangaRaw.value = res;
    });
  }
}

async function updateManga(updatedManga:MangaInDB|MangaPage) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  if(isMangaInDb(manga.value)) {
    socket.emit('addManga', { manga: updatedManga }, (res) => {
      mangaRaw.value = {...res, covers: manga.value?.covers||[] };
    });
  } else {
    mangaRaw.value = manga.value;
  }
}

function updateReaderSettings(newSettings:MangaInDB['meta']['options']) {
  if(!manga.value) return;
  localSettings.value = newSettings;
  if(isMangaInDb(manga.value)) {
    updateManga({...manga.value, meta: {...manga.value.meta, options: newSettings}});
  }
}

async function markAsRead(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = true;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang: manga.value.lang, url: manga.value.url, chapterUrl: c.url, read: true});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

async function markAsUnread(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = false;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang: manga.value.lang, url: manga.value.url, chapterUrl: c.url, read: false});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markPreviousAsRead(index: number) {
  if(!manga.value) return;
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = true;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang: manga.value.lang, url: manga.value.url, chapterUrl: c.url, read: true});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markPreviousAsUnread(index: number) {
  if(!manga.value) return;
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = false;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang: manga.value.lang, url: manga.value.url, chapterUrl: c.url, read: false});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function markNextAsRead(index: number) {
  if(!manga.value) return;
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map((c) => {
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
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map((c) => {
    if(c.number > chapNum) {
      c.read = false;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

function changeDisplayName() {
      $q.dialog({
        title: $t('mangas.displayname.title'),
        message: $t('mangas.original_title', {title: manga.value?.name || ''}),
        prompt: {
          model:  manga.value?.displayName || manga.value?.name || '',
          type: 'text',
        },
        cancel: true,
        persistent: false,
      }).onOk(async data => {
        if(!manga.value) return;
        const displayName = data as string;
        const updatedManga:MangaInDB|MangaPage = {...manga.value, displayName };
        await updateManga(updatedManga);
      });
}

async function autoShowManga() {
  const { chapterindex } = route.params as { chapterindex: string|undefined };
  if(!chapterindex) return;
  const index = parseInt(chapterindex);
  if(isNaN(index)) return;
  await showChapterComp(index);
}

function getMirrorInfoUrl(link:string) {
  if(!mirrorinfo.value) return;
  let url = '';
  if(mirrorinfo.value.options.protocol) url += mirrorinfo.value.options.protocol + '://';
  if(mirrorinfo.value.options.host) url += mirrorinfo.value.options.host;
  if(mirrorinfo.value.options.port) url += ':' + mirrorinfo.value.options.port;
  url += link;
  return url;
}

/**
 * fetch manga infos
 */
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
      nbOfChapters.value = mg.chapters.length;
      mangaRaw.value = mg;
      autoShowManga();
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
    id="manga-page"
    class="w-100 q-pa-lg"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark'"
    :dark="$q.dark.isActive"
  >
    <div
      ref="content"
      class="row"
    >
      <div
        class="col-12"
      >
        <!-- Manga name -->
        <div
          v-if="manga"
          class="flex flex-center"
        >
          <span
            class="text-h3"
            style="cursor:pointer"
            @click="changeDisplayName"
          >
            {{ manga.displayName || manga.name }}
            <q-menu
              touch-position
              context-menu
            >
              <q-list dense>
                <q-item
                  v-close-popup
                  clickable
                  @click="changeDisplayName"
                >
                  <q-item-section>
                    {{ $t('mangas.displayname.title') }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </span>
        </div>
        <div
          v-else
          class="flex flex-center"
        >
          <span class="text-h3">
            <q-skeleton
              :dark="$q.dark.isActive"
              type="rect"
              height="57px"
              width="300px"
              class="q-mb-sm"
            />
          </span>
        </div>
        <div
          v-if="manga && manga.displayName"
          class="flex flex-center"
        >
          <span class="text-caption">
            ({{ manga.name }})
          </span>
        </div>
        <!-- Tags -->
        <div
          v-if="manga"
          class="text-center q-mt-md"
        >
          <q-chip
            v-for="(tag, i) in manga.tags"
            :key="i"
            color="orange"
            text-color="white"
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
            :dark="$q.dark.isActive"
            type="QChip"
            class="q-mx-sm q-mb-md"
          />
        </div>
        <div class="row">
          <!-- Cover -->
          <div
            class="col-sm-3 col-xs-8 col-lg-2 q-my-lg"
            :class="$q.screen.lt.lg ? 'q-ml-auto q-mr-auto' : undefined"
          >
            <q-carousel
              v-if="manga && manga.covers.length > 0"
              v-model="slide"
              class="shadow-5 rounded-borders"
              autoplay
              animated
              infinite
            >
              <q-carousel-slide
                v-for="(mangaCover, i) in manga.covers"
                :key="i"
                :name="i"
                :img-src="mangaCover"
              />
            </q-carousel>
            <q-skeleton
              v-else
              style="width:100%;height: 400px;"
            />
          </div>
          <!-- Manga info -->
          <div
            class="col-sm-9 col-xs-12 q-px-lg q-my-lg"
          >
            <!-- Manga source & language -->
            <div class="q-mb-lg">
              <div class="flex items-center">
                <span class="q-mr-sm">{{ $t('global.colon_word', {word: $t("mangas.source")}) }}</span>
                <a
                  v-if="manga && mirrorinfo"
                  class="text-weight-medium"
                  :class="$q.dark.isActive ? 'text-white' : 'text-dark'"
                  style="text-decoration: none"
                  :href="getMirrorInfoUrl(manga.url)"
                  target="_blank"
                >
                  {{ mirrorinfo.displayName }}
                  <q-icon name="open_in_new" />
                </a>
                <q-skeleton
                  v-else
                  :dark="$q.dark.isActive"
                  type="text"
                  width="50px"
                  class="text-weight-medium"
                />
                <img
                  v-if="manga && mirrorinfo"
                  :src="mirrorinfo.icon"
                  :alt="mirrorinfo.displayName"
                  class="q-ml-sm"
                >
                <q-skeleton
                  v-else
                  :dark="$q.dark.isActive"
                  height="16px"
                  width="16px"
                  type="rect"
                  class="q-ml-sm"
                />
              </div>
              <div
                class="flex items-center"
              >
                {{ $t('global.colon_word', {word: $t("languages.language.value") }) }}
                <span
                  v-if="manga"
                  class="text-weight-medium q-ml-sm"
                >
                  {{ $t("languages." + manga.lang + ".value") }}
                </span>
                <q-skeleton
                  v-else
                  :dark="$q.dark.isActive"
                  type="text"
                  class="text-weight-medium q-ml-sm q-my-none"
                  width="50px"
                />
              </div>
              <div
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
                <q-skeleton
                  v-else
                  :dark="$q.dark.isActive"
                  style="width:150px;height:23px;"
                />
              </div>
            </div>
            <!-- Manga description -->
            <div v-if="manga">
              {{ manga?.synopsis }}
            </div>
            <div v-else>
              <q-skeleton
                v-for="i in 5"
                :key="i"
                :dark="$q.dark.isActive"
                type="text"
                width="100%"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- Chapters list -->
    </div>
    <div class="row">
      <q-virtual-scroll
        v-slot="{ item, index }"
        :items="chapters"
        :style="'max-height: '+virtualScrollHeight+'px;'"
        :items-size="nbOfChapters"
        :virtual-scroll-item-size="62"
        separator
        class="w-100"
      >
        <q-item
          :key="index"
          :dark="$q.dark.isActive"
          clickable
          style="max-height:62px;"
        >
          <!-- Chapter name, volume, number -->
          <q-item-section
            :class="item.read ? 'text-grey-9' : ''"
            @click="showChapterComp(index)"
          >
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
              lines="1"
            >
              <span class="text-grey-6">{{ item.name }}</span>
            </q-item-label>
          </q-item-section>
          <q-item-section
            side
          >
            <!-- Chapter Date -->
            <q-item-label caption>
              {{ dayJS ? dayJS(item.date).fromNow() : item.date }}
              <q-btn-dropdown
                dropdown-icon="more_vert"
                flat
              >
                <q-list separator>
                  <q-item
                    v-if="index > 0 && item.hasNextUnread"
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markNextAsRead(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_up"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.next', { chapterWord: $t('mangas.chapter', nbOfChapters).toLocaleLowerCase() }, nbOfChapters) }}
                  </q-item>
                  <q-item
                    v-else-if="index > 0"
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markNextAsUnread(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_up"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility_off"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.next_unread', { chapterWord: $t('mangas.chapter', nbOfChapters).toLocaleLowerCase() }, nbOfChapters) }}
                  </q-item>
                  <q-item
                    v-if="item.read"
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markAsUnread(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_right"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility_off"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.current_unread', { chapterWord: $t('mangas.chapter').toLocaleLowerCase() } ) }}
                  </q-item>
                  <q-item
                    v-else
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markAsRead(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_right"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.current', { chapterWord: $t('mangas.chapter').toLocaleLowerCase() } ) }}
                  </q-item>
                  <q-item
                    v-if="index < nbOfChapters - 1 && item.hasPrevUnread"
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markPreviousAsRead(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_down"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.previous', { chapterWord: $t('mangas.chapter', nbOfChapters).toLocaleLowerCase() }, nbOfChapters) }}
                  </q-item>
                  <q-item
                    v-else-if="index < nbOfChapters - 1"
                    v-close-popup
                    class="flex items-center"
                    clickable
                    @click="markPreviousAsUnread(index)"
                  >
                    <q-icon
                      left
                      name="keyboard_double_arrow_down"
                      size="sm"
                      class="q-mx-none"
                    />
                    <q-icon
                      left
                      name="visibility_off"
                      size="sm"
                      class="q-ml-none"
                    />
                    {{ $t('mangas.markasread.previous_unread', { chapterWord: $t('mangas.chapter', nbOfChapters).toLocaleLowerCase() }, nbOfChapters) }}
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </q-item-label>
          </q-item-section>
        </q-item>
        <!-- <chapter-item
          :chapter="item"
          :length="nbOfChapters"
          :index="index"
          @mark-as-read="markAsRead"
          @mark-as-unread="markAsUnread"
          @mark-next-as-read="markNextAsRead"
          @mark-next-as-unread="markNextAsUnread"
          @mark-previous-as-read="markPreviousAsRead"
          @mark-previous-as-unread="markPreviousAsUnread"
          @show-chapter-comp="showChapterComp"
        /> -->
      </q-virtual-scroll>
    </div>
  </q-card>
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
      :chapter-error="chapterError"
      :display-settings="localSettings"
      @hide="hideChapterComp"
      @reload="reloadChapterImage"
      @navigate="showChapterComp($event)"
      @update-manga="updateManga"
      @update-settings="updateReaderSettings"
    />
  </q-dialog>
</template>
