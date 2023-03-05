<script lang="ts" setup>
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import {
isManga,
// eslint-disable-next-line comma-dangle
isMangaInDB
} from '@renderer/components/helpers/typechecker';
import { useHistoryStore } from '@renderer/stores/history';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import type dayjs from 'dayjs';
import type { QSelectOption } from 'quasar';
import { useQuasar } from 'quasar';
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type OptionLanguage = QSelectOption<mirrorsLangsType>
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** props */
const props = defineProps<{
  id: string,
  url?: string,
  lang: mirrorsLangsType
  mirror: string,
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** vue-router */
router = useRouter(),
/** settings */
settings = useSettingsStore(),
/** dayJS lib */
dayJS = inject<typeof dayjs>('dayJS'),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** stored history */
historyStore = useHistoryStore();

// globals
const
/** header */
top = document.querySelector<HTMLDivElement>('#top-header');

// states
const
/** manga infos as retrieved by the server */
mangaRaw = ref<PartialBy<(MangaInDB | MangaPage), 'chapters'>>(),
/** manga failed to load*/
nodata = ref<string[]|null>(null),
/** selected language */
selectedLanguage = ref(props.lang),
/** ignored langs */
ignoredLangs = ref(mirrorsLang as unknown as mirrorsLangsType[]),
/** mirror info */
 mirrorinfo = ref<mirrorInfo|undefined>(),
/** carrousel slides */
slide = ref(0),
/** filter dialog */
filterDialog = ref(false);

// computed
const
/** height of the carrousel */
thumbnailHeight = computed(() => {
  if($q.screen.xs) return '400px';
  else if($q.screen.sm) return '400px';
  else if($q.screen.md) return '500px';
  return '400px';
}),
/** manga infos */
manga = computed(() => {
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
    })
    .filter(x => x.lang === selectedLanguage.value)
    .sort((a, b) => settings.mangaPage.chapters.sort === 'DESC' ? a.number - b.number : b.number - a.number)
    ,
  };
}),
/** the manga name OR display name */
displayName = computed<string>({
  get() {
    if(!manga.value) return '';
    return manga.value.displayName || manga.value.name;
  },
  set(newValue: string | number | null) {
    if(!manga.value) return;
    if(typeof newValue !== 'string') return;
    const trimmed = newValue.trim();
    if(trimmed.length < 1) return;
    const updatedManga:MangaInDB|MangaPage = { ...manga.value, displayName: trimmed };
    updateManga(updatedManga);
  },
}),
/** url pointing to the manga */
mirrorInfoURL = computed(() => {
  if(!mirrorinfo.value || !manga.value) return '';
  let url = '';
  const { protocol, host, port} = mirrorinfo.value.options;
  if(protocol && host && port) {
    url += protocol + '://' + host + ':' + port;
  }
  else url += mirrorinfo.value.host;
  url += manga.value.url;
  return url;
}),
/** user-defined categories */
userCategories = computed({
  get() {
    if(!mangaRaw.value) return [];
    return mangaRaw.value.userCategories;
  },
  set(newValue:string[]) {
    if(!mangaRaw.value || !mangaRaw.value.chapters) return;
    newValue = newValue.sort();
    mangaRaw.value = {...mangaRaw.value, userCategories: newValue};
    updateManga(mangaRaw.value as MangaInDB | MangaPage);
  },
}),
/** return the color class for the manga's publication status */
statusClass = computed(() => {
  if(!manga.value) return 'white';
  switch(manga.value.status) {
    case 'cancelled':
      return 'negative';
    case 'completed':
      return 'primary';
    case 'hiatus':
      return 'accent';
    case 'ongoing':
      return 'positive';
    case 'unknown':
      return 'accent';
    default:
      return 'white';
  }
}),
/** manga's chapters */
chapters = computed(() => {
  if (mangaRaw.value && mangaRaw.value.chapters) {
    let chap = sortChapter(mangaRaw.value.chapters).filter(c => !ignoredScanlators.value.includes(c.group || '')).filter(ch => {
      if(hideReadChapters.value && ch.read) return false;
      return true;
    });
    // komga specific
    if(mangaRaw.value.mirror.name === 'komga' && settings.mangaPage.chapters.KomgaTryYourBest.find(x => x === mangaRaw.value?.id)) {
      const mg = mangaRaw.value;
      chap = chap.map(c => {
        let volume:RegExpMatchArray | null | undefined | string | number = c.name ? /(v\d{2,3})/gi.exec(c.name) : undefined;
        if(volume) volume = parseFloat(volume[1].replace('v', ''));
        else volume = undefined;
        if(!c.name) return { ...c };
        const chapterName = c.name.replace(mg.name, '').replace(mg.displayName ? mg.displayName : '', '');
        const regexp = new RegExp('^\\s(\\d{1,4}(\\.\\d{1,4})?)', 'gi');
        let number:RegExpMatchArray | null | string = c.name ? regexp.exec(chapterName) : null;
        if(number) c.number = parseFloat(number[1]);
        return {
          ...c,
          number: volume ? -1 : c.number,
          volume: volume,
        };
      });
    }
    return chap;
  }
  return [];
}),
resume = computed(() => {
  if(!chapters.value || !chapters.value.length) return { label:  $t('mangas.start_reading') };

  const hasRead = chapters.value.filter(c => c.read).length > 0;
  const chapterToRead = chapters.value.reduce((prev, curr) => {
    if(!curr.read) return prev;
    if(curr.number > prev.number) return curr;
    return prev;
  });

  const label = hasRead ? $t('mangas.resume_reading') : $t('mangas.start_reading');
  return { label, value: chapterToRead };

}),
/** the number of chapters */
nbOfChapters = computed(() => {
  if(!mangaRaw.value) return 0;
  if(!mangaRaw.value.chapters) return 0;
  return mangaRaw.value.chapters.filter(c => c.lang === props.lang).length;
}),
/** list of ignored scanlator for this entry */
ignoredScanlators = computed({
  get() {
    if(!mangaRaw.value) return [];
    const id = mangaRaw.value.id;
    return settings.mangaPage.chapters.scanlators.ignore.filter(s => s.id === id).map(s => s.name);
  },
  set(newValue:string[]) {
    if(!mangaRaw.value) return;
    const id = mangaRaw.value.id;
    const scanlatorsMapped = newValue
      .map(s => { return { id:id, name: s }; });
    settings.mangaPage.chapters.scanlators.ignore = settings.mangaPage.chapters.scanlators.ignore.filter(s=>s.id !== s.id);
    scanlatorsMapped.forEach(m => settings.mangaPage.chapters.scanlators.ignore.push(m));
  },
}),
/** is komga special regex enabled? */
isKomgaTryingItsBest = computed({
  get() {
    if(!mangaRaw.value) return false;
    if(mangaRaw.value.mirror.name !== 'komga') return false;
    const id = mangaRaw.value.id;
    const find = settings.mangaPage.chapters.KomgaTryYourBest.find(x => x === id);
    return typeof find === 'string';
  },
  set(newValue:boolean) {
    if(!mangaRaw.value) return;
    if(mangaRaw.value.mirror.name !== 'komga') return false;
    const id = mangaRaw.value.id;
    if(newValue) settings.mangaPage.chapters.KomgaTryYourBest.push(id);
    else settings.mangaPage.chapters.KomgaTryYourBest = settings.mangaPage.chapters.KomgaTryYourBest.filter(x => x !== id);
  },
}),
/** toggle hide read chapters */
hideReadChapters = computed({
  get() {
    return settings.mangaPage.chapters.hideRead;
  },
  set(newValue:boolean) {
    settings.mangaPage.chapters.hideRead = newValue;
  },
}),
/** list of unread chapters */
unreadChaps = computed(() => {
  return chapters.value.filter((c) => !c.read);
}),
routeLang = computed<OptionLanguage>({
  get() {
    return { value: selectedLanguage.value, label: $t(`languages.${selectedLanguage.value}`) };
  },
  /** current language (read-write) */
  set(lang:OptionLanguage) {
    selectedLanguage.value = lang.value;
    const newURL = window.location.href.replace(/\/\w+$/gi, `/${lang.value}`);
    history.pushState({}, '', newURL);
  },
});

/** hide caret in <select> language */
function hideCaret() {
  const style = document.querySelector('#hidecaret') as HTMLStyleElement || document.createElement('style');
  style.id = '#hidecaret';
  style.textContent = '.q-icon.notranslate.material-icons.q-select__dropdown-icon { display: none; }';
  document.body.appendChild(style);
}

/** show caret in <select> language */
function showCaret() {
  const style = document.getElementById('#hidecaret') as HTMLStyleElement || null;
  if(style) style.textContent = '';
}

/** add manga to library */
async function add() {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);
  socket.emit('addManga', { manga: manga.value }, (res) => {
    mangaRaw.value = {
      ...res,
      covers: manga.value?.covers || [],
    };
    if(res.langs.length === 1) hideCaret();
    else showCaret();
  });
}

/** remove manga from library */
async function remove() {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);
  // get the language index
  const langIndex = manga.value.langs.findIndex(i => i === selectedLanguage.value);

  if(isMangaInDB(manga.value)) {
    socket.emit('removeManga', manga.value, selectedLanguage.value, (res) => {
      mangaRaw.value = { ...res, covers: res.covers.map(c => transformIMGurl(c, settings)) };
      // automatically select another language when current is deleted
      const lang = langIndex < 0 || res.langs.length-1 < langIndex ? res.langs[0] : res.langs[langIndex];
      routeLang.value = { label: $t(`languages.${lang}`), value: lang};
      if(res.langs.length === 1) hideCaret();
    });
  }
}

/** upserts manga in database, also updates `mangaRaw` */
async function updateManga(updatedManga:MangaInDB|MangaPage) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);
  if(isMangaInDB(manga.value)) {
    socket.emit('addManga', { manga: updatedManga }, (res) => {
      mangaRaw.value = {...res, covers: manga.value?.covers||[] };
    });
  } else {
    mangaRaw.value = updatedManga;
  }
}

/** toggle manga in and out of library */
function toggleInLibrary() {
  if(!manga.value) return;
  if(!isMangaInDB(manga.value)) {
    add();
  } else {
    remove();
  }
}

/** sort chapters */
function sortChapter(chapters:MangaInDB['chapters']|MangaPage['chapters']) {
  if(settings.mangaPage.chapters.sort === 'ASC') {
    return chapters.sort((a, b) => {
      if(a.volume && b.volume) {
        const diff = a.volume - b.volume;
        if (diff) return diff;
      }
      return a.number - b.number;
    });
  }
  return chapters.sort((a, b) => {
    if(a.volume && b.volume) {
      const diff = b.volume - a.volume;
      if (diff) return diff;
    }
    return b.number - a.number;
  });
}

/** redirect to the reader */
function showChapter(chapter:MangaInDB['chapters'][0] | MangaPage['chapters'][0]) {
  if(!mirrorinfo.value || !manga.value) return;

  if(mangaRaw.value && mangaRaw.value.chapters) {
    // chapters needs to use the default sorting
    historyStore.manga = { ...mangaRaw.value, chapters: chapters.value.sort((a, b) => a.number - b.number) };
  }

  const params = routeTypeHelper('reader', {
    mirror: mirrorinfo.value.name,
    lang: chapter.lang,
    id: manga.value.id,
    chapterId: chapter.id,
  });
  router.push(params);
}

/** Mark a chapter as read */
async function markAsRead(index:number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = true;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
  console.log('marked as read');
}

/** Mark a chapter as unread */
async function markAsUnread(index:number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = false;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** Mark all previous chapters as read */
async function markPreviousAsRead(index: number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = true;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** Mark all previous chapters as unread */
async function markPreviousAsUnread(index: number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = false;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** Mark all next chapters as read */
async function markNextAsRead(index: number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map((c) => {
    if(c.number > chapNum && c.lang === lang) {
      c.read = true;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  console.log('marked as read');
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** Mark all next chapters as unread */
async function markNextAsUnread(index: number) {
  if(!manga.value) return;
  const socket = await useSocket(settings.server);

  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const chapterUrls:string[] = [];

  const updatedChapters = chapters.value.map((c) => {
    if(c.number > chapNum && c.lang === lang) {
      c.read = false;
      chapterUrls.push(c.url);
    }
    return c;
  });

  const updatedManga = { ...manga.value, chapters: updatedChapters };
  mangaRaw.value = updatedManga;
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** dialog to mark chapters as read/unread */
function chapterDialog(index:number, chapter: {
    hasNextUnread: boolean;
    hasPrevUnread: boolean;
    id: string;
    url: string;
    lang: mirrorsLangsType;
    date: number;
    number: number;
    name?: string | undefined;
    volume?: number | undefined;
    group?: string | undefined;
    read: boolean;
}) {
  $q.dialog({
    title: chapter.name,
    options: {
      model: '',
      type: 'radio',
      items: [
            { label: $t('mangas.markasread.previous'), value: '1', disable: index === 0 || !chapter.hasPrevUnread },
            { label: $t('mangas.markasread.previous_unread'), value: '2', disable: index === 0 || chapter.hasPrevUnread},
            { label: $t('mangas.markasread.current'), value: '3', disable: chapter.read },
            { label: $t('mangas.markasread.current_unread'), value: '4', disable: !chapter.read },
            { label: $t('mangas.markasread.next'), value: '5', disable: index >= (nbOfChapters.value-1) || !chapter.hasNextUnread, color: 'positive'},
            { label: $t('mangas.markasread.next_unread'), value: '6', disable: index >= (nbOfChapters.value-1) || chapter.hasNextUnread},
          ].filter(item => item.disable === false),
    },
  })
  .onOk(async data => {
    const findIndex = chapters.value.findIndex(c => c.id === chapter.id);
    switch (data) {
      case '1':
        await markPreviousAsRead(findIndex);
        break;
      case '2':
        await markPreviousAsUnread(findIndex);
        break;
      case '3':
        await markAsRead(findIndex);
        break;
      case '4':
        await markAsUnread(findIndex);
        break;
      case '5':
        await markNextAsRead(findIndex);
        break;
      case '6':
        await markNextAsUnread(findIndex);
        break;
      default:
        break;
    }
  });
}

/** fetch manga */
async function startFetch() {
  nodata.value = null;
  const reqId = Date.now();
  const socket = await useSocket(settings.server);

  socket.once('showManga', (id, mg) => {
    if (id === reqId) {
      if(isManga(mg)) {
        nodata.value = null;
        // When the manga is fetched from recommendation no language filter is applied we have to this ourself
        if(!mg.inLibrary) { // making sure we don't hide something that might be in the user's library
          mg.langs = mg.langs.filter(l => !ignoredLangs.value.includes(l));
          mg.chapters = mg.chapters.filter(c => !ignoredLangs.value.includes(c.lang));
        }

        if(!selectedLanguage.value) selectedLanguage.value = mg.langs[0];
        mangaRaw.value = { ...mg, covers: mg.covers.map(c => transformIMGurl(c, settings)), userCategories: mg.userCategories.sort() };

        socket.emit('getMirrors', true, (mirrors) => {
          const m = mirrors.find((m) => m.name === mg.mirror.name);
          if(m) mirrorinfo.value = m;
        });
        if(mangaRaw.value.langs.length === 1) hideCaret();
        else showCaret();
      }
      else {
        const msg:string[] = [];
        let { error, trace } = mg;
        if(error === 'manga_error_invalid_link') msg.push($t('mangas.errors.invalid_link', {url: props.url}));
        else if(error === 'manga_error_unknown') msg.push($t('mangas.errors.unknown', {url: props.url}));
        else {
          if(trace) {
            if(trace.includes('timeout')) msg.push($t('mangas.errors.timeout', {source: mirrorinfo.value?.displayName}));
            else if(trace.includes('ERR_INVALID_AUTH_CREDENTIALS')) msg.push($t('mangas.errors.invalid_auth'));
            else if (trace.includes('invalid_json')) msg.push($t('mangas.errors.invalid_json'));
            else if(trace.includes('bad_request')) msg.push($t('mangas.errors.bad_request', {code: trace.split('bad_request: ')[1]}));
            else msg.push($t('mangas.errors.unknown', {url: props.url}));
          } else {
            msg.push($t('mangas.errors.unknown', {url: props.url}));
          }
        }
        nodata.value = msg;
      }
    }
  });

  socket.emit('showManga', reqId, {
    id: props.id,
    mirror: props.mirror,
    langs: [props.lang],
    url: props.url,
  });

}

async function On() {
  const socket = await useSocket(settings.server);
  function getIgnoredLangs():Promise<void> {
    return new Promise(resolve => {
      socket.emit('getSettings', (globalSettings) => {
        ignoredLangs.value = mirrorsLang.filter(l => !globalSettings.langs.includes(l));
        resolve();
      });
    });
  }
  await getIgnoredLangs();
  window.scrollTo(0, 0);
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('showChapter');
}

onMounted(On);
onBeforeUnmount(Off);

startFetch();

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="{ height: `${$q.screen.height-(top?.offsetHeight || 0)}px`}"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-page-container>
      <q-page
        v-if="nodata"
      >
        <div class="absolute-center w-100">
          <q-banner
            class="text-white bg-negative q-mx-lg"
          >
            <template #avatar>
              <q-icon
                name="signal_wifi_off"
                color="white"
              />
            </template>
            <p class="text-h5">
              {{ $t('mangas.errors.nodata') }}:
            </p>
            <ul>
              <li
                v-for="(msg, i) in nodata"
                :key="i"
              >
                <span class="text-caption">{{ msg }}</span>
              </li>
            </ul>

            <template #action>
              <q-btn
                flat
                color="white"
                :label="$t('setup.retry')"
                @click="startFetch"
              />
            </template>
          </q-banner>
        </div>
      </q-page>
      <q-page>
        <q-scroll-area
          :style="{ height: `${$q.screen.height-(top?.offsetHeight || 0)}px`, minHeight: '100px'}"
          :bar-style="{ background: 'orange', width: '6px' }"
          :thumb-style="{ background: 'orange', width: '2px', margin: '2px' }"
          class="q-pa-lg"
        >
          <div
            class="flex-center flex"
          >
            <div
              v-if="manga"
              class="cursor-pointer"
            >
              <span class="text-h3 text-center">
                {{ manga.displayName || manga.name }}
                <q-icon
                  size="xs"
                  class="q-mb-lg"
                  name="edit"
                />
              </span>
              <q-popup-edit
                v-slot="scope"
                :model-value="displayName"
                :cover="true"
              >
                <q-input
                  :model-value="displayName"
                  dense
                  autofocus
                  counter
                  :debounce="500"
                  @update:model-value="(v) => displayName = (v as string)"
                  @keyup.enter="scope.set"
                >
                  <template #append>
                    <q-icon
                      class="cursor-pointer"
                      name="restart_alt"
                      @click="manga ? displayName = manga.name : null"
                    >
                      <q-tooltip>
                        {{ $t('mangas.displayname.reset') }}
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </q-popup-edit>
            </div>
            <q-skeleton
              v-else
              type="text"
              class="text-h3 w-50"
            />
          </div>
          <div class="flex flex-center">
            <q-img
              v-if="manga && mirrorinfo"
              :src="mirrorinfo.icon"
              :alt="mirrorinfo.displayName"
              height="16px"
              width="16px"
              class="q-mr-sm"
              loading="lazy"
            />
            <q-skeleton
              v-else
              :dark="$q.dark.isActive"
              height="16px"
              width="16px"
              type="rect"
              class="q-ml-sm"
            />
            <a
              v-if="manga && mirrorinfo"
              class="text-weight-medium"
              :class="$q.dark.isActive ? 'text-white' : 'text-dark'"
              style="text-decoration: none"
              :href="mirrorInfoURL"
              target="_blank"
            >
              {{ mirrorinfo.displayName }}
              <q-icon name="open_in_new" />
              <q-tooltip>{{ $t('mangas.open_in_new.manga') }}</q-tooltip>
            </a>
            <q-skeleton
              v-else
              :dark="$q.dark.isActive"
              type="text"
              width="50px"
              class="text-weight-medium"
            />
          </div>
          <div class="row q-mx-sm q-mt-lg">
            <div
              class="col-md-4 col-xs-12 col-lg-3 q-my-auto q-ml-auto q-mr-auto"
            >
              <q-carousel
                v-if="manga && manga.covers.length > 0"
                v-model="slide"
                class="rounded-borders cursor-pointer q-ml-auto q-mr-auto"
                autoplay
                animated
                infinite
                :height="thumbnailHeight"
                style="max-width:300px;"
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
              <div
                v-if="manga"
                class="flex flex-center"
              >
                <q-btn
                  size="md"
                  class="q-mt-xs w-100"
                  style="max-width:300px;"
                  :icon="isMangaInDB(manga) ? 'delete_forever': 'library_add'"
                  :text-color="isMangaInDB(manga) ? 'negative' : 'positive'"
                  :color="$q.dark.isActive ? 'grey-9' : 'grey-4'"
                  @click="toggleInLibrary"
                >
                  <span
                    class="q-ml-sm"
                    :class="$q.dark.isActive ? 'text-white': 'text-dark'"
                  >
                    {{ isMangaInDB(manga) ? $t('reader.manga.remove') : $t('reader.manga.add') }}
                  </span>
                </q-btn>
              </div>

              <q-skeleton
                v-else
                class="w-100 q-mt-xs"
                :dark="$q.dark.isActive"
                type="QBtn"
              />
            </div>
            <div
              id="mangalang"
              class="col-md-8 col-xs-12 q-my-lg q-ml-auto"
              :class="$q.screen.gt.xs ? 'q-px-lg': ''"
            >
              <div
                v-if="manga"
                class="flex column rounded-borders justify-evenly q-px-sm"
                style="gap: 15px;"
                :style="{minHeight: thumbnailHeight}"
              >
                <div
                  class="flex"
                >
                  <q-icon
                    name="translate"
                    color="white"
                    size="40px"
                    class="bg-orange-7 q-px-sm"
                    style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                  />
                  <q-select
                    :label="manga.langs.length < 2 ? $t('languages.language', manga.langs) : $t('mangas.select_language')"
                    :readonly="manga.langs.length < 2"
                    :behavior="$q.screen.lt.md ? 'dialog' : 'menu'"
                    :dark="$q.dark.isActive"
                    outlined
                    :input-debounce="0"
                    dense
                    :options-dark="$q.dark.isActive"
                    color="orange"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                    style="flex-grow:1;  border-radius: 0px 4px 4px 0px!important;"
                    :model-value="routeLang"
                    :options="manga.langs.map(v=> { return { value: v, label: $t(`languages.${v}`) } })"
                    @update:model-value="(v:OptionLanguage) => routeLang = v"
                  />
                  <div
                    class="flex q-ml-lg"
                    style="height:40px;flex-grow:1;"
                  >
                    <q-icon
                      name="newspaper"
                      color="white"
                      size="40px"
                      class="bg-orange-7 q-px-sm"
                      style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                    />
                    <div
                      class="flex items-center"
                      :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                      style="flex-grow:1;border-radius: 0px 4px 4px 0px;"
                    >
                      <span
                        v-show="$q.screen.gt.xs"
                        class="q-ml-sm"
                      >{{ $t('mangas.publication') }}</span>
                      <span
                        class="text-weight-bold text-center q-ml-sm"
                        :class="'text-'+statusClass"
                      >
                        {{ $t(`mangas.status_${manga.status}`).toLocaleUpperCase() }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="manga.authors.length">
                  <div
                    class="flex w-100"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                    style="border-radius: 4px 4px 0px 0px;"
                  >
                    <q-icon
                      name="menu_book"
                      color="white"
                      size="40px"
                      class="bg-orange-7 q-px-sm"
                      style="border-radius: 4px 0px 0px 0px;"
                    />
                    <span class="q-ml-auto q-mr-auto self-center">
                      {{ $t('mangas.authors_and_artists').toLocaleUpperCase() }}
                    </span>
                  </div>
                  <div
                    class="w-100 q-pa-sm"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                    style="border-radius: 0px 0px 4px 4px;"
                  >
                    <span
                      class="text-caption"
                      style="word-wrap:break-word;"
                    >
                      {{ manga.authors.join(', ') }}
                    </span>
                  </div>
                </div>
                <div v-if="manga.tags.length">
                  <div
                    class="flex w-100"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                    style="border-radius: 4px 4px 0px 0px;"
                  >
                    <q-icon
                      name="tag"
                      color="white"
                      size="40px"
                      class="bg-orange-7 q-px-sm"
                      style="border-radius: 4px 0px 0px 0px;"
                    />
                    <span class="q-ml-auto q-mr-auto self-center">
                      {{ $t('mangas.tags').toLocaleUpperCase() }}
                    </span>
                  </div>
                  <div
                    class="w-100 q-pa-sm"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                    style="border-radius: 0px 0px 4px 4px;"
                  >
                    <span
                      class="text-caption"
                      style="word-wrap:break-word;"
                    >
                      {{ manga.tags.join(', ') }}
                    </span>
                  </div>
                </div>
                <div id="categories">
                  <div
                    class="flex w-100"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                    style="border-radius: 4px 4px 0px 0px;"
                  >
                    <q-icon
                      name="tag"
                      color="white"
                      size="40px"
                      class="bg-orange-7 q-px-sm"
                      style="border-radius: 4px 0px 0px 0px;"
                    />
                    <span class="q-ml-auto q-mr-auto self-center">
                      {{ $t('mangas.categories').toLocaleUpperCase() }}
                    </span>
                  </div>
                  <q-select
                    v-model="userCategories"
                    :placeholder="$t('mangas.edit_categories')"
                    outlined
                    use-input
                    use-chips
                    multiple
                    hide-dropdown-icon
                    new-value-mode="add-unique"
                    :behavior="$q.screen.lt.md ? 'dialog' : 'menu'"
                    :dark="$q.dark.isActive"
                    color="orange"
                    dense
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                    style="border-radius: 0px 0px 4px 4px;"
                    options-dense
                  />
                </div>
                <div v-if="manga.synopsis">
                  <div
                    class="flex w-100"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                    style="border-radius: 0px 4px 0px 4px;"
                  >
                    <q-icon
                      name="menu_book"
                      color="white"
                      size="40px"
                      class="bg-orange-7 q-px-sm"
                      style="border-radius: 4px 0px 0px 0px;"
                    />
                    <span class="q-ml-auto q-mr-auto self-center">
                      {{ $t('mangas.synopsis').toLocaleUpperCase() }}
                    </span>
                  </div>
                  <div
                    class="w-100 q-pa-sm"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                    style="border-radius: 0px 0px 4px 4px;"
                  >
                    <span
                      class="text-caption"
                      style="word-wrap:break-word;"
                    >
                      {{ manga.synopsis }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="manga"
              class="q-mb-xs w-100 no-shadow q-gutter-xs"
              :class="$q.dark.isActive ? 'q-table__card--dark q-table--dark' : undefined"
              :style="{borderLeft: '0', borderRight: '0', borderTop: '0'}"
            >
              <div class="flex">
                <q-btn
                  color="orange"
                  text-color="white"
                  icon="filter_alt"
                  class="q-mr-lg"
                  @click="filterDialog = !filterDialog"
                />
                <q-btn
                  v-if="resume.value"
                  color="orange"
                  text-color="white"
                  :label="resume.label"
                  class="q-mr-lg"
                  @click="() => resume.value ? showChapter(resume.value) : null"
                />
                <q-btn
                  color="orange"
                  text-color="white"
                  :icon="settings.mangaPage.chapters.sort === 'DESC' ? 'arrow_downward' : 'arrow_upward'"
                  class="q-mr-lg"
                  @click="settings.mangaPage.chapters.sort === 'DESC' ? settings.mangaPage.chapters.sort = 'ASC' : settings.mangaPage.chapters.sort = 'DESC'"
                >
                  {{ $t('mangas.chapter_order') }}
                </q-btn>

                <q-dialog
                  v-model="filterDialog"
                  :full-width="$q.screen.lt.md"
                  :full-height="$q.screen.lt.md"
                  :position="$q.screen.lt.md ? undefined : 'top'"
                >
                  <q-card
                    :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
                    :style="$q.screen.lt.md ? '':'width:500px;'"
                    class="q-pa-md"
                  >
                    <div class="flex items-center justify-between w-100">
                      <span>{{ $t('mangas.hide_unread') }}</span>
                      <q-toggle
                        v-model="hideReadChapters"
                        color="orange"
                      />
                    </div>
                    <div
                      v-if="manga"
                      id="scanlatorFilter"
                      class="flex items-center justify-between w-100"
                    >
                      <q-select
                        v-if="mangaRaw && mangaRaw.chapters && mangaRaw.chapters.some(x => x.group)"
                        v-model="ignoredScanlators"
                        color="orange"
                        :label="$q.screen.lt.md || $q.platform.has.touch ? $t('mangas.hide_scanlators_tap') : $t('mangas.hide_scanlators_click')"
                        :options="Array.from(new Set(manga.chapters.map(c => c.group)))"
                        multiple
                        use-chips
                        class=" w-100"
                        filled
                        dense
                        options-dense
                        :behavior="$q.screen.lt.md ? 'dialog' : 'menu'"
                      >
                        <template #prepend>
                          <q-icon :name="$q.screen.lt.md || $q.platform.has.touch ? 'touch_app' : 'ads_click'" />
                        </template>
                      </q-select>
                    </div>
                    <div
                      v-if="mangaRaw && mangaRaw.mirror.name === 'komga'"
                      class="flex items-center justify-between w-100"
                    >
                      <span>{{ $t('mangas.komga_tries_its_best') }}</span>
                      <q-toggle
                        v-model="isKomgaTryingItsBest"
                        color="orange"
                      />
                    </div>
                    <div
                      v-if="$q.screen.lt.md"
                      class="absolute-bottom-right q-mb-lg q-mr-lg"
                    >
                      <q-btn
                        push
                        color="orange"
                        size="lg"
                        @click="filterDialog = false"
                      >
                        {{ $t('mangas.close_filter') }}
                      </q-btn>
                    </div>
                  </q-card>
                </q-dialog>
              </div>
              <div class="w-100 q-mt-sm">
                <q-linear-progress
                  size="18px"
                  :value="manga.chapters.filter(c => c.read).length / manga.chapters.length"
                  color="orange"
                  rounded
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge

                      color="white"
                      text-color="dark"
                    >
                      {{ manga.chapters.filter(c => c.read).length }} / {{ manga.chapters.length }}
                    </q-badge>
                  </div>
                </q-linear-progress>
              </div>
            </div>

            <q-virtual-scroll
              v-if="manga"
              :style="{ height: `${($q.screen.height/2)-(top?.offsetHeight || 0)}px`, minHeight: '76.78px'}"
              class="w-100"
              :items="[...manga.chapters]"
              separator
              :virtual-scroll-item-size="76.78"
              :virtual-scroll-slice-size="1"
              :items-size="manga.chapters.length"
              :items-fn="(from, size) => [...manga!.chapters.slice(from).slice(0, size)]"
            >
              <template #default="{ item, index }">
                <q-item
                  :key="index"
                >
                  <q-item-section
                    class="cursor-pointer"
                    @click="showChapter(item)"
                  >
                    <q-item-label>
                      <div
                        class="text-body1 q-ma-none q-pa-none"
                        :class="item.read ? 'text-grey-7' : 'text-white'"
                      >
                        <span v-if="item.volume !== undefined">{{ $t("mangas.volume") }} {{ item.volume }}</span>
                        <span v-if="(!isKomgaTryingItsBest && item.volume !== undefined) || (isKomgaTryingItsBest && item.number > -1 && typeof item.volume !== 'undefined')"> - </span>
                        <span v-if="!isKomgaTryingItsBest || (isKomgaTryingItsBest && item.number > -1 && item.volume === undefined)">{{ $t("mangas.chapter") }} {{ item.number }}</span>
                      </div>
                    </q-item-label>
                    <q-item-label
                      caption
                    >
                      <span :class="item.read ? 'text-grey-9' : 'text-grey-6'">
                        {{ item.name || '&nbsp;' }}
                      </span>
                    </q-item-label>
                    <q-item-label
                      caption
                    >
                      <span
                        :class="item.read ? 'text-grey-9' : 'text-grey-8'"
                      >
                        {{ item.group || '&nbsp;' }}
                      </span>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section
                    side
                    top
                  >
                    <q-item-label caption>
                      <div class="flex flex-center">
                        <div>
                          {{ dayJS ? dayJS(item.date).fromNow() : item.date }}
                        </div>
                        <q-btn
                          v-if="$q.screen.lt.md"
                          class="q-ml-md self-end"
                          icon="more_vert"
                          dense
                          @click="() => chapterDialog(index, item)"
                        />
                        <q-btn-dropdown
                          v-else
                          class="q-ml-md"
                          dropdown-icon="more_vert"
                          flat
                          dense
                        >
                          <q-list separator>
                            <q-item
                              v-if="!(index >= (nbOfChapters-1) || !item.hasNextUnread)"
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markNextAsRead(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.next') }}
                            </q-item>
                            <q-item
                              v-if="!(index >= (nbOfChapters-1) || item.hasNextUnread)"
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markNextAsUnread(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.next_unread') }}
                            </q-item>
                            <q-item
                              v-if="item.read"
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markAsUnread(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.current_unread') }}
                            </q-item>
                            <q-item
                              v-else
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markAsRead(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.current') }}
                            </q-item>
                            <q-item
                              v-if="!(index === 0 || !item.hasPrevUnread)"
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markPreviousAsRead(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.previous') }}
                            </q-item>
                            <q-item
                              v-if="!(index === 0 || item.hasPrevUnread)"
                              v-close-popup
                              class="flex items-center"
                              clickable
                              @click="markPreviousAsUnread(chapters.findIndex(c => c.id === item.id))"
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
                              {{ $t('mangas.markasread.previous_unread') }}
                            </q-item>
                          </q-list>
                        </q-btn-dropdown>
                      </div>
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-virtual-scroll>
          </div>
        </q-scroll-area>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css" scoped>
/* Chrome, Edge, and Safari */

.sticky-table {
  /* height or max-height is important */
  height: 410px;
  /* this will be the loading indicator */
}

.sticky-table .q-table__top,
.sticky-table .q-table__bottom,


.sticky-table thead tr th {
  position: sticky;
  z-index: 1;
}

.sticky-table thead tr:last-child th {
  /* height of all previous header rows */
  top: 48px;
}

.sticky-table thead tr:first-child th {
  top: 0;
}

.reading-progress {
  width: 100%
}
</style>
<style lang="css">
.q-table__middle.q-virtual-scroll.q-virtual-scroll--vertical.scroll::-webkit-scrollbar {
  width: 2px;
}

.q-table__middle.q-virtual-scroll.q-virtual-scroll--vertical.scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
  margin-top:10px;
  margin-bottom:20px
}

.q-table__middle.q-virtual-scroll.q-virtual-scroll--vertical.scroll::-webkit-scrollbar-thumb {
  background-color: #ff990054 !important;
  border-radius: 10px;
  opacity: 0.5;
  min-height: 300px;
}


#mangalang .q-field--outlined .q-field__control::before {
  border-radius: 0px 4px 4px 0px!important;
}

#mangalang .q-field__control:before {
  border: 0px!important;
}
#mangalang .q-field--outlined .q-field__control:after {
  border: 0px!important;
}

#categories .q-field--auto-height.q-field--dense .q-field__control, #categories .q-field--auto-height.q-field--dense .q-field__native {
  min-height: 41px!important;
}
#categories .q-chip, #categories .q-chip .ellipsis, #scanlatorFilter .q-chip, #scanlatorFilter .q-chip .ellipsis {
  color: black;
  background:orange;
  max-width: 300px;
}
#categories .q-chip .q-icon, #scanlatorFilter .q-chip .q-icon {
  color: black;
}

</style>
