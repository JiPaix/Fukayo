<script lang="ts" setup>
import type { ChapterImage } from '@api/models/types/chapter';
import type { ChapterErrorMessage, ChapterImageErrorMessage, MangaErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { useSocket } from '@renderer/components/helpers/socket';
import { isChapterErrorMessage, isChapterImage, isChapterImageErrorMessage, isManga, isMangaInDb } from '@renderer/components/helpers/typechecker';
import chapterScrollBuffer from '@renderer/components/reader/chapterScrollBuffer.vue';
import { isMouseEvent } from '@renderer/components/reader/helpers';
import ImagesContainer from '@renderer/components/reader/ImagesContainer.vue';
import NavOverlay from '@renderer/components/reader/NavOverlay.vue';
import ReaderHeader from '@renderer/components/reader/ReaderHeader.vue';
import RightDrawer from '@renderer/components/reader/RightDrawer.vue';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { scroll, useQuasar } from 'quasar';
import { computed, nextTick, onBeforeMount, onBeforeUnmount, ref } from 'vue';

/** props */
const props = defineProps<{
  mirror?: string,
  lang?: string,
  url?: string,
  id: string,
  parentId: string,
}>();

/** settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();

/** current url */
const currentURL = ref(document.location.href);
/** sidebar */
const rightDrawerOpen = ref(false);
/** chapters ref */
const chaptersRef = ref<null|HTMLDivElement>(null);
/** chapter id user is currently reading */
const currentChapterId = ref(props.id);
/** current page */
const currentPage = ref(0);
/** current pages length */
const currentPagesLength = computed(() => {
  if(!currentChapterFormatted.value) return 0;
  return currentChapterFormatted.value.imgsExpectedLength;
});


/** manga data */
const manga = ref<MangaPage|MangaInDB|null>(null);
/** couldn't load manga data */
const error = ref<MangaErrorMessage|null>(null);

/** make sure we don't load chapter twice */
const loadingAchapter = ref(false);
/** show next chapter div */
const showPrevChapterDiv = ref(false);
/** show previous chapter div */
const showNextChapterDiv = ref(false);

/** count double-taps left when first page is onscreen */
const doubleTapLeft = ref(0);
/** count double-taps right when last page is onscreen */
const doubleTapRight = ref(0);
/** reader settings so they don't overwrite global options */
const localReaderSettings = ref(manga.value && isMangaInDb(manga.value) ? manga.value.meta.options : settings.reader);


/** formatted chapters (before sort) */
const RAWchapters = ref<{
  /** chapter id */
  id: string,
  /** chapter index */
  index:number,
  /** expected length of imgs array */
  imgsExpectedLength: number,
  /** chapter images/errors */
  imgs: (ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage)[]
  }[]
>([]);

/** function to sort RAWchapters by index */
function sortChapters(chapters: typeof RAWchapters.value, reverse = false) {
  if(reverse) return chapters.sort((a, b) => b.index - a.index);
  return chapters.sort((a, b) => a.index - b.index);
}

/** formated chapters sorted by index (DESC) */
const chaptersFormatted = computed(() => {
  return sortChapters(RAWchapters.value);
});

/** current chapter */
const currentChapter = computed(() => {
  if(!manga.value) return;
  return manga.value.chapters.find(c => c.id === currentChapterId.value);
});

/** current formatted chapter */
const currentChapterFormatted = computed(() => {
  return chaptersFormatted.value.find(c => c.id === currentChapterId.value);
});



/** previous chapter */
const prevChapter = computed(() => {
  if(!manga.value) return null;
  const chapter = manga.value.chapters.find(c => c.id === currentChapterId.value);
  if(!chapter) return null;
  const index = manga.value.chapters.indexOf(chapter);
  if(index === manga.value.chapters.length - 1)  return null;
  return manga.value.chapters[index + 1];
});

/** next chapter */
const nextChapter = computed(() => {
  if(!manga.value) return null;
  const chapter = manga.value.chapters.find(c => c.id === currentChapterId.value);
  if(!chapter) return null;
  const index = manga.value.chapters.indexOf(chapter);
  if(index === 0) return null;
  return manga.value.chapters[index - 1];
});


async function loadIndex(index: number) {
  if(!manga.value) return;
  // check if index exists
  const chapter = manga.value.chapters[index];
  if(chapter) getChapter(chapter.id, chapter.url, {});
}

/** load the next chapter in cache */
async function loadNext() {
  if(!manga.value) return;
  if(!currentChapterFormatted.value) return;
  if(currentChapterFormatted.value.index === 0) return;
  // check if next chapter exists
  const chapter = manga.value.chapters[currentChapterFormatted.value.index - 1];
  if(chapter) getChapter(chapter.id, chapter.url, {});
}

/** load previous chapter in cache */
async function loadPrev(scrollup?: boolean) {
  if(!manga.value) return;
  if(!currentChapterFormatted.value) return;
  if(currentChapterFormatted.value.index === 0) return;
  // check if previous chapter exists
  const chapter = manga.value.chapters[currentChapterFormatted.value.index + 1];
  if(chapter) getChapter(chapter.id, chapter.url, {scrollup});
}

function onImageVisible(imageIndex:number, chapterId:string) {
    changeURL(chapterId);
    currentPage.value = imageIndex + 1;

    if(currentChapterFormatted.value) {
      const expected = currentChapterFormatted.value.imgsExpectedLength;
      const chapterId = currentChapterFormatted.value.id;
      if(currentPage.value === expected && chapterId == currentChapterId.value) {
        toggleRead(currentChapterFormatted.value.index, true);
      }
    }
}

/** update the browser history (without reloading page) */
function changeURL(chapterId: string) {
  if(!chapterId) return;
  if(currentChapterId.value === chapterId) return;
  currentChapterId.value = chapterId;
  const url = currentURL.value;
  const newURL = url.replace(currentChapterId.value, chapterId);
  if(newURL !== url) {
    history.pushState({}, '', newURL);
  }
}

/** get manga info: triggered once at page load */
async function getManga():Promise<void> {
  RAWchapters.value = [];
  const socket = await useSocket(settings.server);
  const reqId = Date.now();
  socket.emit('showManga', reqId, {
    id: props.parentId,
  });
  return new Promise(resolve => {
    socket.once('showManga', (id, mg) => {
      if(id === reqId) {
        if(isManga(mg) || isMangaInDb(mg)) {
          manga.value = mg;
          error.value = null;
          resolve();
        } else {
        error.value = mg;
        resolve();
        }
      }
    });
  });
}

/** change current chapter variables and make sure scroll position doesn't mess with UI */
async function chapterTransition(opts: { chapterId:string, PageToShow:number }) {
  currentChapterId.value = opts.chapterId;
  currentPage.value = opts.PageToShow;
  loadingAchapter.value = false;
  await nextTick();
  const pageContainer = document.querySelector(`#page-${opts.PageToShow}`);
  if(pageContainer) pageContainer.scrollIntoView();
}


async function getChapter(chapterId = props.id, url = props.url, opts: { scrollup?: boolean, prefetch?:boolean, reloadIndex?:number, callback?:() => void }):Promise<void> {
  if(!manga.value) return;

  // prepare the requests
  const socket = await useSocket(settings.server);
  const reqId = Date.now();

  // cancel previous requests
  if(loadingAchapter.value) {
    turnOff(false);
  }

  if(!opts.prefetch && !opts.reloadIndex) {
    // show spinner
    loadingAchapter.value = true;
    // reset current page and chapter id
    currentPage.value = 0;
    currentChapterId.value = chapterId;
    // hide previous/next chapter divs
    showPrevChapterDiv.value = false;
    showNextChapterDiv.value = false;
  }

  // if chapter is already in cache and has all its images, just show it
  const alreadyFetched = RAWchapters.value.find(c => c.id === chapterId);
  if(alreadyFetched && !opts.prefetch && typeof opts.reloadIndex === 'undefined') {
    const needToFetch = alreadyFetched.imgsExpectedLength < alreadyFetched.imgs.length;
    chapterTransition({
      chapterId,
      PageToShow: opts.scrollup ? alreadyFetched.imgs.length : 1,
    });
    if(!needToFetch) {
      if(!nextChapter.value) return;
      return getChapter(nextChapter.value.id, nextChapter.value.url, {prefetch: true});
    }
  }

  // ask for the chapter images and get the number of expected images
  let imgsExpectedLength = 0;
  socket.emit('showChapter', reqId, {
    id: chapterId,
    mirror: manga.value.mirror,
    lang: manga.value.lang,
    url: url,
    retryIndex: opts.reloadIndex,
  }, (length) => {
    imgsExpectedLength = length;
  });

  // we need this to know when we receive the first image.
  let firstPage = true;
  // a showChapter event is triggered for each page
  socket.on('showChapter', (id, chapter) => {
    if(id !== reqId) return;
    if(!manga.value) return;
    if(opts.callback) opts.callback();
    const exist = RAWchapters.value.find(c => c.id === chapterId);

    // if entry is new (first page usually), and we aren't reloading/prefetching a page/chapter: add it to cache
    if(!exist) {
      RAWchapters.value.push({
        id: chapterId,
        imgsExpectedLength,
        imgs: [chapter],
        index: manga.value.chapters.findIndex(m => m.id === chapterId ),
      });

      // if it's the first page (and it should be), trigger page transition
      if(firstPage) {
        firstPage = false;
        if(!opts.prefetch && !opts.reloadIndex) {
          chapterTransition({
              chapterId,
              PageToShow: 1,
          });
        }
      }

      // stop listening for events as the API won't return results anymore
      // OR return and wait for the next event
      if(isChapterErrorMessage(chapter) || chapter.lastpage) return socket.off('showChapter');
      else return;
    }

    if(isChapterErrorMessage(chapter)) {
      exist.imgs = [chapter]; // put the error message in the image array
      return socket.off('showChapter'); // stop listening for events as the API won't return results anymore
    }

    // API returs a ChapterImage when an image is found, or ChapterImageErrorMessage when an error occurs
    if(isChapterImage(chapter) || isChapterImageErrorMessage(chapter)) {
      // check if the image exist and is worth replacing
      const toReplace =
        exist.imgs.findIndex(img => (isChapterImage(img) || isChapterImageErrorMessage(img)) && img.index  === chapter.index);

      if(toReplace > -1) {
        // replace error with image
        if(isChapterImageErrorMessage(exist.imgs[toReplace]) && isChapterImage(chapter)) exist.imgs[toReplace] = chapter;
        // replace images with different sources
        else if(isChapterImage(exist.imgs[toReplace]) && isChapterImage(chapter)) {
          if((exist.imgs[toReplace] as ChapterImage).src !== chapter.src) exist.imgs[toReplace] = chapter;
        }
      }
      // add new image
      else exist.imgs.push(chapter);
    }

    // // if this is the first page, trigger the page transition
    if(firstPage) {
      firstPage = false;
      if(!opts.prefetch && !opts.reloadIndex) {
        chapterTransition({
          chapterId,
          PageToShow: opts.scrollup ? exist.imgs.length : 1,
        });
      }
    }

    // if we have all the images, stop listening for events
    if(chapter.lastpage) {
      socket.off('showChapter');
      if(!nextChapter.value) return;
      if(!settings.reader.preloadNext) return;
      if(opts.prefetch) return;
      return getChapter(nextChapter.value.id, nextChapter.value.url, { prefetch: true});
    }

    // if we need to preload next chapter


  });
}

/** add/remove manga from library */
async function toggleInLibrary(mangaSettings:MangaInDB['meta']['options'] = localReaderSettings.value) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  if(isMangaInDb(manga.value)) {
    socket.emit('removeManga', manga.value, () => {
      if(manga.value) manga.value.inLibrary = false;
    });
  }

  else if(isManga(manga.value)) {
    manga.value.inLibrary = true;
    socket.emit('addManga', { manga: manga.value, settings: mangaSettings}, () => {
      if(manga.value) manga.value.inLibrary = true;
    });
  }
}

/**
 * toggle read status on a chapter
 * @param index index of chapter
 * @param forceTRUE if you want to force read to be true
 */
async function toggleRead(index: number, forceTRUE = false) {
  if(!manga.value) return;
  if(!manga.value.chapters[index]) return;
  if(forceTRUE && manga.value.chapters[index].read === true) return;

  const newReadValue = forceTRUE ? true : !manga.value.chapters[index].read;
  manga.value.chapters[index].read = newReadValue;

  if(!isMangaInDb(manga.value)) return;

  const socket = await useSocket(settings.server);
  /** !! this event only marks as read on the website's source, eg. mangadex */
  socket.emit('markAsRead', {
    mirror: manga.value.mirror,
    lang: manga.value.lang,
    url: manga.value.url,
    chapterUrl: manga.value.chapters[index].url,
    read: newReadValue,
  });

  socket.emit('addManga', { manga: manga.value, settings: settings.reader }, () => {
    // chapter marked as "newReadValue"
  });

}

/** update the reader's settings for this manga */
async function updateReaderSettings(newSettings:MangaInDB['meta']['options'], oldSettings:MangaInDB['meta']['options']) {
  if(!manga.value) return;
  // reset scroll position if the display mode changed
  if(newSettings.zoomMode !== oldSettings.zoomMode || newSettings.webtoon !== oldSettings.webtoon) {
    const index = currentPage.value - 1;
    // using good old timeout because we don't know when changes will be applied
    setTimeout(() => scrollToPage(index), 500);
    // if browser couldn't update within 500ms, the scroll position isn't changed
    // 500ms is a good compromise between responsiveness and performance
  }
  localReaderSettings.value = newSettings;
  if(isMangaInDb(manga.value)) {
    const socket = await useSocket(settings.server);
    socket.emit('addManga', { manga: manga.value, settings: newSettings }, () => {
      // new settings saved
    });
  }
}



function listenKeyboardArrows(event: KeyboardEvent|MouseEvent) {
  if(!currentChapterFormatted.value) return;
  const div = document.querySelector('.fit.scroll.chapters');
  if(!div) return;
  if(!isMouseEvent(event)) {
    const pos = scroll.getVerticalScrollPosition(div);
    let index = -1;
    if(event.key === 'ArrowLeft') {
      index = currentPage.value-2; // current page is 1-based while index is 0-based, so previous page is -2
      if(index < 0 || pos <= 0) {
        if(doubleTapLeft.value === 1) {
          doubleTapLeft.value = 0;
          return loadPrev(true);
        }
        doubleTapLeft.value++;
        return;
      }
      return scrollToPage(index);
    }

    if(event.key === 'ArrowRight') {
      index = currentPage.value;
      if(index+1 > currentChapterFormatted.value.imgs.length) {
        if(doubleTapRight.value === 1) {
          doubleTapRight.value = 0;
          return loadNext();
        }
        doubleTapRight.value++;
        return;
      }
      return scrollToPage(index);
    }
  }
}

/** listen to wheel event in order to show <chapter-scroll-buffer> */
function listenScrollBeyondPage(event: WheelEvent) {
  // listening mousewheel events
    const div = document.querySelector('.fit.scroll.chapters');
    if(!div) return;
    const pos = scroll.getVerticalScrollPosition(div);
    /** user at the top of the page scroll up */
    const isUP = pos+event.deltaY < 0;
    /** user at bottom of the page scroll down */
    const isDown = pos+event.deltaY > div.scrollHeight - div.clientHeight;
    if(isUP || isDown) {
      // maintain scroll pos
      const initialHeight = div.scrollHeight;
      // show the right div
      if(isUP) showPrevChapterDiv.value = true;
      if(isDown) showNextChapterDiv.value = true;
      nextTick(() => {
        if(isUP) div.scrollTop = div.scrollHeight - initialHeight;
        const chapterDiv = document.querySelector('#chaploop');
        if(chapterDiv) {
          const y = chapterDiv.getBoundingClientRect().top + window.pageYOffset + 82;
          window.scrollTo({top: y });
        }
      });


    }

}

async function turnOn() {
  await getManga();
  await getChapter(props.id, props.url, { });
  window.addEventListener('wheel', listenScrollBeyondPage, { passive: true });
  window.addEventListener('keyup', listenKeyboardArrows, { passive: true });
}

async function turnOff(removeListeners = true) {
  const socket = await useSocket(settings.server);
  socket.emit('stopShowChapter');
  socket.emit('stopShowManga');
  if(removeListeners) {
    socket.off('showChapter');
    window.removeEventListener('wheel', listenScrollBeyondPage);
    window.removeEventListener('keyup', listenKeyboardArrows);
  }
}

onBeforeMount(turnOn);
onBeforeUnmount(turnOff);


let scrollInterval: ReturnType<typeof setInterval> | null = null;

function scrollToPage(index: number) {
    if(scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    const container = document.querySelector('.fit.scroll.chapters') as HTMLElement | null;
    const upward = index <= currentPage.value-2;
    if(container) {
      scrollInterval = setInterval(async () => {
        if(!scrollInterval) return;

        const page = document.querySelector(`#page-${index+1}`) as HTMLElement | null;
        if(!page) return;
        const margin = localReaderSettings.value.webtoon ? 0 : 30;
        const offset = upward ? page.getBoundingClientRect().top + margin : page.getBoundingClientRect().top - 82 + margin;

        if(upward) {
          if(offset >= 82) return clearInterval(scrollInterval);
          else container.scrollBy(0, upward ? -20 : 20);

        } else {
          if(offset <= 0) return clearInterval(scrollInterval);
          else container.scrollBy(0, upward ? -20 : 20);
        }
      },1);
    }
}

</script>
<template>
  <q-layout
    view="lHh lpR lFf"
  >
    <q-header
      elevated
      class="bg-dark"
    >
      <reader-header
        v-if="manga && currentChapter"
        :manga="manga"
        :chapter="currentChapter"
        :nb-of-pages="currentPagesLength"
        :page="currentPage"
        @toggle-drawer="rightDrawerOpen = !rightDrawerOpen"
      />
    </q-header>
    <q-drawer
      v-model="rightDrawerOpen"
      :dark="$q.dark.isActive"
      :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-4'"
      :bordered="$q.dark.isActive"
      show-if-above
      no-swipe-open
      no-swipe-close
      side="right"
    >
      <right-drawer
        v-if="manga"
        style="background:rgba(255, 255, 255, 0.15);"
        :open="rightDrawerOpen"
        :dark="$q.dark.isActive"
        :chapters="manga.chapters"
        :current-chapter-id="currentChapterId"
        :in-library="manga.inLibrary"
        :reader-settings="isMangaInDb(manga) ? manga.meta.options : settings.reader"
        @load-index="loadIndex"
        @toggle-in-library="toggleInLibrary"
        @toggle-read="toggleRead"
        @update-settings="updateReaderSettings"
      />
    </q-drawer>

    <q-page-container
      class="absolute-full"
      :class="$q.dark.isActive ? '' : 'bg-white'"
    >
      <div
        v-if="error"
        class="bg-negative"
      >
        {{ error }}
      </div>
      <div
        v-else-if="currentChapterFormatted && currentChapter && !loadingAchapter"
        ref="chaptersRef"
        class="fit scroll chapters"
      >
        <div v-if="isChapterErrorMessage(currentChapterFormatted.imgs[0])">
          <div
            class="bg-negative flex flex-center"
            :style="`height:${$q.screen.height-82}px;width:100%;`"
          >
            <div class="flex-column">
              <div>
                {{ $t(
                  'global.colon_word' ,
                  {
                    word: $t(
                      'reader.error.chapter',
                      {
                        chapterWord: $t('mangas.chapter').toLocaleLowerCase()
                      }
                    )
                  }
                ) }}
              </div>
              <div class="text-caption text-yellow-8">
                {{ currentChapterFormatted.imgs[0].trace || currentChapterFormatted.imgs[0].error }}
              </div>
              <q-btn
                icon-right="broken_image"
                color="white"
                text-color="black"
                class="w-100"
                @click.once="getChapter(currentChapter!.id, currentChapter!.url, { })"
              >
                {{ $t('reader.error.reload') }}
              </q-btn>
            </div>
          </div>
        </div>
        <div v-else>
          <chapter-scroll-buffer
            v-if="prevChapter"
            type="prev"
            :chapter="prevChapter"
            :show="showPrevChapterDiv"
            @load-next="loadNext"
            @load-prev="loadPrev(true)"
          />
          <div
            id="chaploop"
            style="position:relative;height:100%;"
          >
            <images-container
              :chapter-id="currentChapterFormatted.id"
              :chapter-u-r-l="currentChapter.url"
              :index="currentChapterFormatted.index"
              :expected-length="currentChapterFormatted.imgsExpectedLength"
              :imgs="currentChapterFormatted.imgs"
              :current-page="currentPage"
              :reader-settings="localReaderSettings"
              @change-page="onImageVisible"
              @reload="(reloadIndex, id, url, callback) => getChapter(id, url, { reloadIndex, callback})"
            />
            <nav-overlay
              :hint-color="localReaderSettings.overlay ? $q.dark.isActive ? 'warning' : 'dark' : undefined"
              :drawer-open="rightDrawerOpen"
              position="left"
              :current-page="currentPage"
              :total-pages="currentChapterFormatted.imgs.length"
              @scroll-to-page="scrollToPage"
              @load-previous="loadPrev"
            />
            <nav-overlay
              :drawer-open="rightDrawerOpen"
              position="center"
              :current-page="currentPage"
              :total-pages="currentChapterFormatted.imgs.length"
              @toggle-drawer="rightDrawerOpen = !rightDrawerOpen"
            />
            <nav-overlay
              :hint-color="localReaderSettings.overlay ? $q.dark.isActive ? 'warning' : 'dark' : undefined"
              :drawer-open="rightDrawerOpen"
              position="right"
              :current-page="currentPage"
              :total-pages="currentChapterFormatted.imgs.length"
              @scroll-to-page="scrollToPage"
              @load-next="loadNext"
            />
            <q-linear-progress
              v-if="currentChapterFormatted.imgs.length !== currentChapterFormatted.imgsExpectedLength"
              :dark="$q.dark.isActive"
              class="absolute absolute-bottom q-mx-sm"
              style="margin-left: 0;"
              size="4px"
              :color="currentChapterFormatted.imgs.some(img => isChapterErrorMessage(img) || isChapterImageErrorMessage(img)) ? 'negative' : 'positive'"
              :value="currentChapterFormatted.imgs.length/currentChapterFormatted.imgsExpectedLength"
              animation-speed="500"
            />
          </div>
        </div>
        <chapter-scroll-buffer
          v-if="nextChapter"
          type="next"
          :chapter="nextChapter"
          :show="showNextChapterDiv"
          @load-next="loadNext"
          @load-prev="loadPrev"
        />
        <div
          v-if="currentChapterFormatted"
          class="absolute-bottom"
        >
          <div
            class="flex flex-center"
            :style="rightDrawerOpen ? 'margin-right:300px;': 'margin-right:0px;'"
          >
            <q-btn-group
              v-if="localReaderSettings.showPageNumber"
              class="bg-dark q-mb-sm text-white"
              rounded
              style="opacity:0.7"
            >
              <q-btn
                rounded
                icon="arrow_back_ios"
                :disabled="currentPage === 1"
                @click="scrollToPage(currentPage-2)"
              />
              <q-btn
                rounded
              >
                {{ currentPage }} / {{ currentPagesLength }}
              </q-btn>
              <q-btn
                rounded
                icon="arrow_forward_ios"
                :disabled="currentPage === currentChapterFormatted.imgsExpectedLength"
                @click="scrollToPage(currentPage)"
              />
            </q-btn-group>
          </div>
        </div>
      </div>
      <div
        v-else-if="!currentChapterFormatted || loadingAchapter"
        class="flex flex-center"
        :style="`height:${$q.screen.height-82}px;width:100%;`"
      >
        <q-spinner size="10vw" />
      </div>
    </q-page-container>
  </q-layout>
</template>
<style lang="css">
.chapters::-webkit-scrollbar {
    display: none;
}
.chapters {
    scrollbar-width: none;
}

</style>
