<script lang="ts" setup>
import { ChapterImage } from '@api/models/types/chapter';
import type { MangaErrorMessage } from '@api/models/types/errors';
import { ChapterErrorMessage, ChapterImageErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isChapterErrorMessage, isChapterImage, isChapterImageErrorMessage, isManga, isMangaInDB } from '@renderer/components/helpers/typechecker';
import { formatChapterInfoToString, isMouseEvent } from '@renderer/components/reader/helpers';
import ImagesContainer from '@renderer/components/reader/ImagesContainer.vue';
import type ImageStack from '@renderer/components/reader/ImageStack.vue';
import NavOverlay from '@renderer/components/reader/NavOverlay.vue';
import ReaderHeader from '@renderer/components/reader/ReaderHeader.vue';
import RightDrawer from '@renderer/components/reader/RightDrawer.vue';
import { useHistoryStore } from '@renderer/store/history';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { debounce, QVirtualScroll, useQuasar } from 'quasar';
import { computed, nextTick, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  mirror: string,
  lang: mirrorsLangsType,
  id: string,
  chapterId: string,
}>();

/** settings store */
const settings = useSettingsStore();
/** history store */
const historyStore = useHistoryStore();
/** quasar */
const $q = useQuasar();
/** i18n */
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
/** current url */
const currentURL = ref(document.location.href);
/** sidebar */
const rightDrawerOpen = computed({
  get() {
    return settings.readerGlobal.pinRightDrawer;
  },
  set(nval:boolean) {
    settings.readerGlobal.pinRightDrawer = nval;
  },
});
/** loading progress */
const progress = ref(0);
/** loading progress has error? */
const progressError = ref(false);
/** chapters ref */
const chaptersRef = ref<null|HTMLDivElement>(null);
/** chapter id user is currently reading */
const currentChapterId = ref(props.chapterId);
/** display page selector */
const showPageSelector = ref(false);
/** current page */
const currentPage = ref(0);
/** current pages length */
const currentPagesLength = computed(() => {
  if(!currentChapterFormatted.value) return 0;
  return currentChapterFormatted.value.imgsExpectedLength;
});

/** thumbnail scrollbar */
const thumbscroll = ref<null|QVirtualScroll>();
/** image container div */
const virtscroll = ref<null|InstanceType<typeof ImagesContainer>>(null);
/** if this is put to true mousewheel scrolls are ignored */
const ignoreScroll = ref(false);

/** manga data */
const manga = ref<MangaPage|MangaInDB|null>(null);
/** couldn't load manga data */
const error = ref<MangaErrorMessage|ChapterErrorMessage|null>(null);

/** make sure we don't load chapter twice */
const loadingAchapter = ref(false);
/** count double-taps left when first page is onscreen */
const doubleTapLeft = ref(0);
/** count double-taps right when last page is onscreen */
const doubleTapRight = ref(0);
/** reader settings so they don't overwrite global options */
const localReaderSettings = ref(settings.reader);
/** formatted chapters (before sort) */
const RAWchapters = ref<{
  /** chapter id */
  id: string,
  /** chapter index */
  index:number,
  /** expected length of imgs array */
  imgsExpectedLength: number,
  /** chapter images/errors */
  imgs: (ChapterImage | ChapterImageErrorMessage)[]
  }[]
>([]);

/** function to sort RAWchapters by index */
function sortChapters(chapters: typeof RAWchapters.value, reverse = false) {
  if(reverse) return chapters.sort((a, b) => b.index - a.index);
  return chapters.sort((a, b) => a.index - b.index);
}

/** is komga special regex enabled? */
const isKomgaTryingItsBest = computed({
  get() {
    if(!manga.value) return false;
    if(manga.value.mirror.name !== 'komga') return false;
    const id = manga.value.id;
    const find = settings.mangaPage.chapters.KomgaTryYourBest.find(x => x === id);
    return typeof find === 'string';
  },
  set(newValue:boolean) {
    if(!manga.value) return;
    if(manga.value.mirror.name !== 'komga') return false;
    const id = manga.value.id;
    if(newValue) settings.mangaPage.chapters.KomgaTryYourBest.push(id);
    else settings.mangaPage.chapters.KomgaTryYourBest = settings.mangaPage.chapters.KomgaTryYourBest.filter(x => x !== id);
  },
});

/** formated chapters sorted by index (DESC) */
const chaptersFormatted = computed(() => {
  return sortChapters(RAWchapters.value);
});

/** current formatted chapter */
const currentChapterFormatted = computed(() => {
  return chaptersFormatted.value.find(c => c.id === currentChapterId.value);
});



/** current chapter */
const currentChapter = computed(() => {
  if(!manga.value) return;
  return manga.value.chapters.find(c => c.id === currentChapterId.value);
});

/** next chapter */
const nextChapter = computed(() => {
  if(!manga.value) return null;
  const chapter = manga.value.chapters.find(c => c.id === currentChapterId.value);
  if(!chapter) return null;
  const index = manga.value.chapters.indexOf(chapter);
  if(index === manga.value.chapters.length - 1)  return null;
  return manga.value.chapters[index + 1];
});

/** previous chapter */
const prevChapter = computed(() => {
  if(!manga.value) return null;
  const chapter = manga.value.chapters.find(c => c.id === currentChapterId.value);
  if(!chapter) return null;
  const index = manga.value.chapters.indexOf(chapter);
  if(index === 0) return null;
  return manga.value.chapters[index - 1];
});

const rtl = computed(() => {
  return localReaderSettings.value.rtl;
});

async function loadIndex(index: number) {
  if(!manga.value) return;
  // check if index exists
  const chapter = manga.value.chapters[index];
  if(chapter) getChapter(chapter.id, {});
}

/** load the next chapter in cache */
async function loadPrev(scrollup?: boolean) {
  if(!manga.value) return;
  if(!currentChapterFormatted.value) return;
  if(currentChapterFormatted.value.index === 0) return;
  // check if next chapter exists
  if(prevChapter.value) getChapter(prevChapter.value.id, {scrollup});
}

/** load previous chapter in cache */
async function loadNext() {
  if(!manga.value) return;
  if(!currentChapterFormatted.value) return;
  if(currentChapterFormatted.value.index === manga.value.chapters.length-1) return;
  // check if previous chapter exists
  if(nextChapter.value) getChapter(nextChapter.value.id, {});
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
  // cancel previous requests
  if(loadingAchapter.value) turnOff(false);
  // remove errors
  error.value = null;
  // show spinner
  loadingAchapter.value = true;
  // reset current page and chapter id
  currentPage.value = 0;
  currentChapterId.value = props.chapterId;
  // hide previous/next chapter divs
  showNextBuffer.value = false;
  showPrevBuffer.value = false;
  progress.value = 0;

  RAWchapters.value = [];
  if(historyStore.manga) {
    if(historyStore.manga.id === props.id) {
      error.value = null;
      manga.value = { ...historyStore.manga, chapters: historyStore.manga.chapters.sort((a, b) => a.number - b.number) };
      if(isMangaInDB(manga.value)) {
        localReaderSettings.value = manga.value.meta.options;
        // hide spinner
        loadingAchapter.value = false;
      }
    } else {
      historyStore.manga = null;
    }
  }
  const socket = await useSocket(settings.server);
  const reqId = Date.now();
  socket.emit('showManga', reqId, {
    mirror: props.mirror,
    id: props.id,
    langs: [props.lang],
  });

  return new Promise(resolve => {
    socket.once('showManga', (id, mg) => {
      if(id === reqId) {
        if(isManga(mg)) {
          if(mg.chapters.some(x => x.lang === props.lang )) {
            mg.chapters = mg.chapters.sort((a, b) => a.number - b.number);
            manga.value = mg;
            error.value = null;
            historyStore.manga = mg;
          } else {
            error.value = { error: 'manga_error', trace: $t('reader.error.chapterLang') };
          }
        if(isMangaInDB(mg)) localReaderSettings.value = mg.meta.options;
        } else {
          error.value = mg;
        }
        // hide spinner
        loadingAchapter.value = false;
        resolve();
      }
    });
  });
}

/** change current chapter variables and make sure scroll position doesn't mess with UI */
async function chapterTransition(opts: { chapterId:string, PageToShow:number }) {

  progress.value = 0;
  showNextBuffer.value = false;
  showPrevBuffer.value = false;

  showPageSelector.value = false;
  currentChapterId.value = opts.chapterId;
  currentPage.value = opts.PageToShow+1;
  loadingAchapter.value = false;
  ignoreScroll.value = true;
  await scrollToPage(opts.PageToShow, true);
  await nextTick();
  setTimeout(() => {
    ignoreScroll.value = false;
  }, 500);
}


async function getChapter(chapterId = props.chapterId, opts: { scrollup?: boolean, prefetch?:boolean, reloadIndex?:number, callback?:() => void }):Promise<void> {
  if(!manga.value) return;
  // prepare the requests
  const socket = await useSocket(settings.server);
  const reqId = Date.now();

  // cancel previous requests
  if(loadingAchapter.value) {
    turnOff(false);
  }

  if(!opts.prefetch && !opts.reloadIndex) {
    // remove errors
    error.value = null;
    // show spinner
    loadingAchapter.value = true;
    // reset current page and chapter id
    currentPage.value = 0;
    currentChapterId.value = chapterId;
    // hide previous/next chapter divs
    showNextBuffer.value = false;
    showPrevBuffer.value = false;
  }

  // if chapter is already in cache and has all its images, just show it
  const alreadyFetched = RAWchapters.value.find(c => c.id === chapterId);
  if(alreadyFetched && !opts.prefetch && typeof opts.reloadIndex === 'undefined') {
    const needToFetch = alreadyFetched.imgsExpectedLength < alreadyFetched.imgs.length;
    chapterTransition({
      chapterId,
      PageToShow: opts.scrollup ? alreadyFetched.imgs.length-1 : 0,
    });
    if(!needToFetch) {
      if(!nextChapter.value) return;
      return getChapter(nextChapter.value.id, {prefetch: true});
    }
  }

  // ask for the chapter images and get the number of expected images
  let imgsExpectedLength = 0;
  socket.emit('showChapter', reqId, {
    chapterId: chapterId,
    mangaId: manga.value.id,
    mirror: manga.value.mirror.name,
    url: manga.value.chapters.find(c=>c.id === chapterId)?.url,
    lang: props.lang,
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

    // stop listening for events as the API won't return results anymore
    // OR return and wait for the next event
    if(isChapterErrorMessage(chapter)) {
      error.value = chapter;
      return socket.off('showChapter');
    }
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
              PageToShow: 0,
          });
        }
      }
    } else {
      // API returns a ChapterImage when an image is found, or ChapterImageErrorMessage when an error occurs
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
        else {
          exist.imgs.push(chapter);
        }
      }
      // if this is the first page, trigger the page transition
      if(firstPage) {
        firstPage = false;
        if(!opts.prefetch && !opts.reloadIndex) {
          chapterTransition({
            chapterId,
            PageToShow: opts.scrollup ? exist.imgs.length : 1,
          });
        }
      }
    }
    // if we have all the images, stop listening for events
    if(chapter.lastpage) {
      socket.off('showChapter');
      if(!nextChapter.value) return;
      if(!settings.readerGlobal.preloadNext) return;
      if(opts.prefetch) return;
      return getChapter(nextChapter.value.id, { prefetch: true});
    }
  });
}

/** add/remove manga from library */
async function toggleInLibrary(mangaSettings:MangaInDB['meta']['options'] = localReaderSettings.value) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  if(isMangaInDB(manga.value)) {
    socket.emit('removeManga', manga.value, props.lang, () => {
      if(manga.value) {
        manga.value.inLibrary = false;
        historyStore.manga = manga.value;
      }
    });
  }

  else if(isManga(manga.value)) {
    manga.value.inLibrary = true;
    socket.emit('addManga', { manga: manga.value, settings: mangaSettings}, () => {
      if(manga.value) {
        manga.value.inLibrary = true;
        historyStore.manga = manga.value;
      }
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
  historyStore.manga = manga.value;

  const socket = await useSocket(settings.server);
  /** !! this event only marks as read on the website's source, eg. mangadex */
  socket.emit('markAsRead', {
    mirror: manga.value.mirror.name,
    lang: props.lang,
    url: manga.value.url,
    chapterUrls: [manga.value.chapters[index].url],
    read: newReadValue,
    mangaId: manga.value.id,
  });

}

/** update the reader's settings for this manga */
async function updateReaderSettings(newSettings:MangaInDB['meta']['options'], oldSettings:MangaInDB['meta']['options']) {
  if(!manga.value) return;
  // reset scroll position if the display mode changed
  if(newSettings.zoomMode !== oldSettings.zoomMode || newSettings.webtoon !== oldSettings.webtoon || newSettings.longStrip) {
    const index = currentPage.value - 1;
    // using good old timeout because we don't know when changes will be applied
    // if browser couldn't update within 500ms, the scroll position isn't changed
    // 500ms is a good compromise between responsiveness and performance
    ignoreScroll.value = true;
    await scrollToPage(index, true);
    await nextTick();
    setTimeout(() => {
      ignoreScroll.value = false;
     }, 500);
  }
  localReaderSettings.value = { ...localReaderSettings.value, ...newSettings };
  historyStore.manga = manga.value;
  saveSettings(manga.value, newSettings);
}

const saveSettings = debounce(async(manga: MangaInDB | MangaPage | null, newSettings: typeof localReaderSettings.value) => {
  if(!manga || !isMangaInDB(manga)) return;
  const socket = await useSocket(settings.server);
  socket.emit('addManga', { manga: manga, settings: newSettings }, () => {
    // new settings saved
  });
});


function listenKeyboardArrows(event: KeyboardEvent|MouseEvent) {
  if(!currentChapterFormatted.value) return;
  if(isMouseEvent(event)) return;
  if(rtl.value && event.key === 'ArrowRight') {
    return scrollToPrevPage();
  }
  else if(rtl.value && event.key === 'ArrowLeft') {
    return scrollToNextPage();
  }
  else if(event.key === 'ArrowLeft') {
    return scrollToPrevPage();
  }
  else if(event.key === 'ArrowRight') {
    return scrollToNextPage();
  }
}

function scrollToPrevPage() {
  if(!virtscroll.value?.imagestack) return;

  const currentIndex = currentPage.value - 1;

  if(!localReaderSettings.value.longStrip && !localReaderSettings.value.book) {
    const min = currentPage.value - 1 < 1;
    if(!min) return currentPage.value--;
  }

  const currentGroup = document.querySelector(`[data-indexes*="${currentIndex}"]`);
  if(!currentGroup) return;
  const currentStack = currentGroup.getAttribute('data-indexes')?.split(',');
  if(!currentStack) return;
  const lastPageOfCurrentStack = Math.max(...currentStack.map(o => parseInt(o)));
  const indexOfStack = virtscroll.value.imagestack.indexes.findIndex(i => i.indexes.includes(lastPageOfCurrentStack));
  const targetStack = virtscroll.value.imagestack.indexes[indexOfStack-1];
  if(!targetStack) {
      doubleTapLeft.value++;
      if(doubleTapLeft.value <= 1) return;
      doubleTapLeft.value = 0;
      return loadPrev();
  }
  const target = Math.max(...targetStack.indexes);
  const div = document.querySelector(`[data-indexes*="${target}"]`);
  if(div) div.scrollIntoView({ behavior: 'smooth' });
  currentPage.value = target+1;

}

function scrollToNextPage() {
  if(!currentChapterFormatted.value) return;
  if(!virtscroll.value?.imagestack) return;

  const currentIndex = currentPage.value - 1;

  if(!localReaderSettings.value.longStrip && !localReaderSettings.value.book) {
    const max = currentPage.value + 1 > currentChapterFormatted.value.imgsExpectedLength;
    if(!max) return currentPage.value++;
  }

  const currentGroup = document.querySelector(`[data-indexes*="${currentIndex}"]`);
  if(!currentGroup) return;
  const currentStack = currentGroup.getAttribute('data-indexes')?.split(',');
  if(!currentStack) return;
  const lastPageOfCurrentStack = Math.max(...currentStack.map(o => parseInt(o)));
  const indexOfStack = virtscroll.value.imagestack.indexes.findIndex(i => i.indexes.includes(lastPageOfCurrentStack));
  const targetStack = virtscroll.value.imagestack.indexes[indexOfStack+1];
  if(!targetStack) {
    doubleTapRight.value++;
      if(doubleTapRight.value <= 1) return;
      doubleTapRight.value = 0;
      return loadPrev();
  }
  const target = Math.max(...targetStack.indexes);
  const div = document.querySelector(`[data-indexes*="${target}"]`);
  if(div) div.scrollIntoView({ behavior: 'smooth' });
  currentPage.value = target+1;
}

const prevNavDisabled = computed(() => {
  if(!currentPage.value || !virtscroll.value?.imagestack) return true;
  if(!localReaderSettings.value.book && !localReaderSettings.value.longStrip) return currentPage.value === 1;

  const current = virtscroll.value.imagestack.indexes.find(i => i.indexes.includes(currentPage.value-1));
  if(current?.group.some(c => c.index === 0)) return true;
  return false;
});

const nextNavDisabled = computed(() => {
  const expectedLength = currentChapterFormatted.value?.imgsExpectedLength;

  if(!currentChapterFormatted.value || !virtscroll.value?.imagestack || !expectedLength || !currentPage.value) return true;
  if(!localReaderSettings.value.book && !localReaderSettings.value.longStrip) return currentPage.value === expectedLength;

  const current = virtscroll.value.imagestack.indexes.find(i => i.indexes.includes(currentPage.value-1));

  if(current?.group.some(c => c.lastpage)) return true;
  return false;
});

function thumbnailScroll(evt:WheelEvent) {
  if(thumbscroll.value) thumbscroll.value.$el.scrollLeft += evt.deltaY;
}

async function turnOn() {
  await getManga();
  await getChapter(props.chapterId, { });
  window.addEventListener('keyup', listenKeyboardArrows, { passive: true });
}

async function turnOff(removeListeners = true) {
  const socket = await useSocket(settings.server);
  socket.emit('stopShowChapter');
  socket.emit('stopShowManga');
  if(removeListeners) {
    socket.off('showChapter');
    window.removeEventListener('keyup', listenKeyboardArrows);
  }
}

async function restart() {
  await turnOff();
  await turnOn();
}

onBeforeMount(turnOn);
onBeforeUnmount(turnOff);

async function scrollToPage(index: number, fastforward?:boolean) {
  if(!localReaderSettings.value.longStrip) {
    const target = virtscroll.value?.imagestack?.indexes.find(i => i.indexes.includes(index));
    if(target) {
      currentPage.value = Math.max(...target.indexes) + 1;
    }
    return;
  }

  if(index === 0) {
    virtscroll.value?.imagestack?.setScrollPercentage('horizontal', 0);
    virtscroll.value?.imagestack?.setScrollPercentage('vertical', 0);
    return;
  }

  const div = document.querySelector(`.group[data-indexes*="${index}"]`);

  // in order for scroll to happen the thumbnail previews must be closed first.
  showPageSelector.value = false;
  await nextTick();


  if(div) {
    setTimeout(() => {
      div.scrollIntoView({behavior: fastforward ? undefined : 'smooth'});
    }, 200);

  }
}

const showPrevBuffer = ref(false);
const showNextBuffer = ref(false);

async function useWheelToScrollHorizontally(ev: {deltaY : WheelEvent['deltaY'] }, fromTouch = false) {
  if(ignoreScroll.value) return;
  if(!virtscroll.value) return;
  if(!currentPage.value || !currentChapterFormatted.value) return;

  const scrollArea = virtscroll.value.$refs['imagestack'] as InstanceType<typeof ImageStack>;
  const add=ev.deltaY;
  let pos = scrollArea.getScrollPosition();

  if(localReaderSettings.value.longStrip && localReaderSettings.value.longStripDirection === 'horizontal') {

    if(!fromTouch) {
      if(localReaderSettings.value.rtl) scrollArea.setScrollPosition('horizontal', (pos.left-add));
      else scrollArea.setScrollPosition('horizontal', (pos.left+add));
    }

    pos = scrollArea.getScrollPosition();
    const percentage = scrollArea.getScrollPercentage();

    if(percentage.left === 0 && add < 0) {
      if(!showPrevBuffer.value) {
        const multiplier = localReaderSettings.value.rtl ? -1 : 1;
        showPrevBuffer.value = true;
        await nextTick();
        scrollArea.setScrollPosition('horizontal', ($q.screen.width/1.5)*multiplier);
      }
    }

    const imagesAreAllLoaded = currentChapterFormatted.value.imgs.length === currentChapterFormatted.value.imgsExpectedLength;
    const currentPageIsLastPage = currentPage.value === currentChapterFormatted.value.imgsExpectedLength;

    if(imagesAreAllLoaded || currentPageIsLastPage) {
      if(percentage.left >= 0.8) showNextBuffer.value = true;
    }

  } else {
    scrollArea.setScrollPosition('vertical', pos.top+add);
    if(!localReaderSettings.value.longStrip) return;

    if(pos.top+add < 0) {
      if(!showPrevBuffer.value) {
        showPrevBuffer.value = true;
        await nextTick();
        scrollArea.setScrollPosition('vertical', ($q.screen.height/1.5));
      }
    }
    if(scrollArea.getScrollPercentage().top >= 0.9 && currentPage.value === currentChapterFormatted.value.imgsExpectedLength) showNextBuffer.value = true;
  }
}

let touchTrack = {screenY: 0, screenX: 0 };

function setTouch(ev:TouchEvent) {
  touchTrack.screenX = ev.touches[0].screenX;
  touchTrack.screenY = ev.touches[0].screenY;
}

function resetTouch() {
  touchTrack.screenX = 0;
  touchTrack.screenY = 0;
}

function touch(ev:TouchEvent) {
  const current = ev.changedTouches[0];

  if(current.screenX !== touchTrack.screenX) {
    if(localReaderSettings.value.longStripDirection === 'horizontal' || !localReaderSettings.value.longStrip) return;
    const add = touchTrack.screenX - current.screenX;
    useWheelToScrollHorizontally({ deltaY: add }, true);
  }

  if(current.screenY !== touchTrack.screenY) {
    if(localReaderSettings.value.longStripDirection === 'horizontal') return;
    const add = touchTrack.screenY - current.screenY;
    useWheelToScrollHorizontally({ deltaY: add }, true);
  }
  touchTrack.screenX = current.screenX;
  touchTrack.screenY = current.screenY;
}

watch(() => localReaderSettings.value, (nval, oval) => {
  let worthReloading = false;
  if(nval.book !== oval.book) worthReloading = true;
  if(nval.bookOffset !== oval.bookOffset) worthReloading = true;
  if(nval.longStripDirection !== oval.longStripDirection) worthReloading = true;
  if(nval.longStrip !== oval.longStrip) worthReloading = true;
  if(nval.webtoon !== oval.webtoon) worthReloading = true;
  if(nval.zoomMode !== oval.zoomMode) worthReloading = true;

  if(worthReloading) {
    nextTick(() => {
      scrollToPage(currentPage.value-1, true);
    });
  }
}, {deep: true});
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
        :drawer-open="rightDrawerOpen"
        :progress="progress"
        :progress-error="progressError"
        :current-chapter-string="formatChapterInfoToString(isKomgaTryingItsBest, $t, currentChapter)"
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
      no-swipe-open
      no-swipe-close
      side="right"
    >
      <right-drawer
        v-if="manga"
        style="background:rgba(255, 255, 255, 0.15);"
        :open="rightDrawerOpen"
        :dark="$q.dark.isActive"
        :chapters="manga.chapters.filter(c => c.lang === lang)"
        :current-chapter-id="currentChapterId"
        :in-library="manga.inLibrary"
        :reader-settings="isMangaInDB(manga) ? manga.meta.options : settings.reader"
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
        class="bg-negative fit flex flex-center"
        style="height:100%;width:100%"
      >
        <div
          v-if="error.error.startsWith('chapter') && isChapterErrorMessage(error as ChapterImage | ChapterImageErrorMessage | ChapterErrorMessage)"
          class="flex flex-center column"
        >
          <div class="text-white text-bold">
            {{ error.error.toLocaleUpperCase() }}
          </div>
          <div
            v-if="error.trace"
            class="text-caption"
          >
            {{ error.trace }}
          </div>
          <q-btn
            class="q-mt-lg"
            size="lg"
            @click="getChapter(currentChapter ? currentChapter.id : props.chapterId, {})"
          >
            {{ $t('reader.reload_chapter') }}
          </q-btn>
        </div>
        <div
          v-else
          class="flex flex-center column"
        >
          <div class="text-white text-bold">
            {{ error.error }}
          </div>
          <div
            v-if="error.trace"
            class="text-caption"
          >
            {{ error.trace }}
          </div>
          <q-btn
            class="q-mt-lg"
            size="lg"
            @click="restart"
          >
            {{ $t('reader.reload_chapter') }}
          </q-btn>
        </div>
      </div>
      <div
        v-else-if="currentChapterFormatted && currentChapter && !loadingAchapter"
        ref="chaptersRef"
        class="fit chapters zoom"
        @touchstart="setTouch"
        @touchend="resetTouch"
        @touchmove="touch"
      >
        <div @wheel.stop="useWheelToScrollHorizontally">
          <images-container
            ref="virtscroll"
            :drawer-open="rightDrawerOpen"
            :show-next-buffer="showNextBuffer"
            :show-prev-buffer="showPrevBuffer"
            :next-chapter-string="formatChapterInfoToString(isKomgaTryingItsBest, $t, nextChapter)"
            :prev-chapter-string="formatChapterInfoToString(isKomgaTryingItsBest, $t, prevChapter)"
            :chapter-id="currentChapterFormatted.id"
            :chapter-u-r-l="currentChapter.url"
            :page-index="currentChapterFormatted.index"
            :expected-length="currentChapterFormatted.imgsExpectedLength"
            :imgs="currentChapterFormatted.imgs"
            :current-page="currentPage"
            :reader-settings="localReaderSettings"
            @progress="(n) => progress = n"
            @progress-error="() => progressError = true"
            @load-next="loadNext"
            @load-prev="loadPrev(true)"
            @change-page="onImageVisible"
            @reload="(reloadIndex, id, url, callback) => getChapter(id, { reloadIndex, callback})"
          />
          <nav-overlay
            v-if="!$q.platform.has.touch"
            :hint-color="localReaderSettings.overlay ? $q.dark.isActive ? 'warning' : 'dark' : undefined"
            :drawer-open="rightDrawerOpen"
            position="left"
            @click="localReaderSettings.rtl ? scrollToNextPage() : scrollToPrevPage()"
          />
          <nav-overlay
            v-if="!$q.platform.has.touch"
            :drawer-open="rightDrawerOpen"
            position="center"
            @click="rightDrawerOpen = !rightDrawerOpen"
          />
          <nav-overlay
            v-if="!$q.platform.has.touch"
            :hint-color="localReaderSettings.overlay ? $q.dark.isActive ? 'warning' : 'dark' : undefined"
            :drawer-open="rightDrawerOpen"
            position="right"
            @click="localReaderSettings.rtl ? scrollToPrevPage() : scrollToNextPage()"
          />
        </div>

        <div
          v-if="currentChapterFormatted"
          class="absolute-bottom"
          style="margin-bottom:15px;"
        >
          <q-slide-transition>
            <div
              v-show="showPageSelector"
              class="q-mb-xs"
              :style="rightDrawerOpen ? 'margin-right:300px;': 'margin-right:0px'"
              style="opacity:0.9;"
            >
              <q-virtual-scroll
                ref="thumbscroll"
                v-slot="{ item, index }"
                :items="currentChapterFormatted.imgs"
                virtual-scroll-horizontal
                class="q-ml-auto q-mr-auto rounded-borders"
                style="max-width:500px;max-height:250px;"
                :dir="rtl ? 'rtl':'ltr'"
              >
                <div
                  :key="index"
                  class="row items-center"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
                  @wheel="thumbnailScroll"
                >
                  <q-item

                    clickable
                  >
                    <q-item-section>
                      <q-item-label>
                        #{{ index+1 }}
                      </q-item-label>
                      <q-item-label>
                        <img
                          v-if="isChapterImage(item)"
                          :src="transformIMGurl(item.src, settings)"
                          style="max-height:200px;max-width:160px"
                          loading="lazy"
                          @click="scrollToPage(item.index)"
                        >
                        <q-card
                          v-else
                          class="bg-negative"
                          @click="scrollToPage(item.index)"
                        >
                          <q-card-section>
                            <q-icon
                              name="o_broken_image"
                              size="lg"
                            />
                          </q-card-section>
                        </q-card>
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-separator
                    vertical
                    spaced
                  />
                </div>
              </q-virtual-scroll>
            </div>
          </q-slide-transition>
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
                :disabled="localReaderSettings.rtl ? nextNavDisabled : prevNavDisabled"
                @click="localReaderSettings.rtl ? scrollToNextPage() : scrollToPrevPage()"
              />
              <q-btn
                rounded
                @click="showPageSelector = !showPageSelector;thumbscroll && showPageSelector ? thumbscroll.scrollTo(currentPage-2, 'start') : null"
              >
                {{ currentPage }} / {{ currentPagesLength }}
              </q-btn>
              <q-btn
                rounded
                icon="arrow_forward_ios"
                :disabled="localReaderSettings.rtl ? prevNavDisabled : nextNavDisabled"
                @click="localReaderSettings.rtl ? scrollToPrevPage() : scrollToNextPage() "
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
