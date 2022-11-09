<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { mirrorInfo } from '@api/models/types/shared';
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n/index';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import {
isManga,
// eslint-disable-next-line comma-dangle
isMangaInDB
} from '@renderer/components/helpers/typechecker';
import { useHistoryStore } from '@renderer/store/history';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import type dayjs from 'dayjs';
import type { QSelectOption } from 'quasar';
import { useQuasar } from 'quasar';
import { computed, inject, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type OptionLanguage = QSelectOption<mirrorsLangsType>

const props = defineProps<{
  id: string,
  url?: string,
  lang: mirrorsLangsType
  mirror: string,
}>();

/** quasar */
const $q = useQuasar();
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
/** vue-router */
const router = useRouter();
/** dayJS lib */
const dayJS = inject<typeof dayjs>('dayJS');
/** stored settings */
const settings = useSettingsStore();
/** stored history */
const historyStore = useHistoryStore();
/** web socket */
let socket: socketClientInstance | undefined;
/** selected language */
const selectedLanguage = ref(props.lang);
/** mirror info */
const mirrorinfo = ref<mirrorInfo|undefined>();
/** the number of chapters */
const nbOfChapters = computed(() => {
  if(!mangaRaw.value) return 0;
  if(!mangaRaw.value.chapters) return 0;
  return mangaRaw.value.chapters.filter(c => c.lang === props.lang).length;
});
/** carrousel slides */
const slide = ref(0);
/** manga failed to load*/
const nodata = ref<string[]|null>(null);

const thumbnailHeight = computed(() => {
  if($q.screen.xs) return '400px';
  else if($q.screen.sm) return '400px';
  else if($q.screen.md) return '500px';
  return '400px';
});

/** return the color class for the manga's publication status */
function statusClass(status:MangaPage['status']) {
  switch(status) {
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
  }
}

type Manga = MangaInDB | MangaPage;
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
/** manga infos as retrieved by the server */
const mangaRaw = ref<PartialBy<Manga, 'chapters'>>();

/** manga's chapters */
const chapters = computed(() => {
  if (mangaRaw.value && mangaRaw.value.chapters) {
    return sortChapter(mangaRaw.value.chapters);
  }
  return [];
});

/** chapter table column */
const columns = [
  {
    name: 'chap',
    label: 'chapter',
    field: 'number',
    sortable: true,
    sort: (a:number, b:number, rowA:MangaPage['chapters'][number], rowB:MangaPage['chapters'][number]) => sortChapInTable(rowA, rowB),
  },
  {
    name: 'fetch',
    label: 'date',
    field: 'date',
    format: (val:number) => dayJS ? dayJS(val).fromNow() : val,
  },
];

function sortChapInTable(a:MangaPage['chapters'][number], b:MangaPage['chapters'][number]) {
  const avol = a.volume || 999999,
        bvol = b.volume || 999999,
        voldif = avol - bvol;
  if(voldif === 0) return a.number - b.number;
  return voldif;
}

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
    }).filter(x => x.lang === selectedLanguage.value),
  };
});

/** list of unread chapters */
const unreadChaps = computed(() => {
  return chapters.value.filter((c) => !c.read);
});

/** move to the reader */
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

/** toggle manga in and out of library */
function toggleInLibrary() {
  if(!manga.value) return;
  if(!isMangaInDB(manga.value)) {
    add();
  } else {
    remove();
  }
}

/** add manga to library */
async function add() {
  if(!manga.value) return;
  if (!socket) socket = await useSocket(settings.server);
  socket?.emit('addManga', { manga: manga.value }, (res) => {
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
  if (!socket) socket = await useSocket(settings.server);
  // get the language index
  const langIndex = manga.value.langs.findIndex(i => i === selectedLanguage.value);

  if(isMangaInDB(manga.value)) {
    socket.emit('removeManga', manga.value, selectedLanguage.value, (res) => {
      mangaRaw.value = { ...res, covers: res.covers.map(c => transformIMGurl(c, settings)) };
      // automatically select another language when current is deleted
      changeRouteLang(langIndex < 0 || res.langs.length-1 < langIndex ? res.langs[0] : res.langs[langIndex]);
      if(res.langs.length === 1) hideCaret();
    });
  }
}

/** upserts manga in database, also updates `mangaRaw` */
async function updateManga(updatedManga:MangaInDB|MangaPage) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  if(isMangaInDB(manga.value)) {
    socket.emit('addManga', { manga: updatedManga }, (res) => {
      mangaRaw.value = {...res, covers: manga.value?.covers||[] };
    });
  } else {
    mangaRaw.value = updatedManga;
  }
}

/** Mark a chapter as read */
async function markAsRead(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);

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
}

/** Mark a chapter as unread */
async function markAsUnread(index:number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);

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
  if(!socket) socket = await useSocket(settings.server);

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
  if(!socket) socket = await useSocket(settings.server);

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
  if(!socket) socket = await useSocket(settings.server);

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
  socket.emit('markAsRead', { mirror: manga.value.mirror.name, lang, url: manga.value.url, chapterUrls, read: true, mangaId: updatedManga.id });
}

/** Mark all next chapters as unread */
async function markNextAsUnread(index: number) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);

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

/** Opens the "change display name" dialog, calls `updateManga` when user press "OK" */
async function changeDisplayName(displayName?: string | number | null) {
  if(!manga.value) return;
  if(displayName) {
    if(typeof displayName === 'number') return;
    if(displayName.trim() === '') return;
    const updatedManga:MangaInDB|MangaPage = {...manga.value, displayName };
    await updateManga(updatedManga);
  }
}

/** parse the "source" link for self-hosted mirrors */
function getMirrorInfoUrl(link:string) {
  if(!mirrorinfo.value) return;
  let url = '';
  const { protocol, host, port} = mirrorinfo.value.options;
  if(protocol && host && port) {
    url += protocol + '://' + host + ':' + port;
  }
  else url += mirrorinfo.value.host;
  url += link;
  return url;
}

const userCategories = ref<string[]>([]);

/** edit categories */
function editCategories(vals:string[]) {
  if(!manga.value) return;
  userCategories.value = vals.sort();
  if(isMangaInDB(manga.value)) {
    manga.value.userCategories = userCategories.value;
    updateManga(manga.value);
  }
}

function hideCaret() {
  const style = document.querySelector('#hidecaret') as HTMLStyleElement || document.createElement('style');
  style.id = '#hidecaret';
  style.textContent = '.q-icon.notranslate.material-icons.q-select__dropdown-icon { display: none; }';
  document.body.appendChild(style);
}

function showCaret() {
  const style = document.getElementById('#hidecaret') as HTMLStyleElement || null;
  if(style) style.textContent = '';
}

async function startFetch() {
  nodata.value = null;
  const reqId = Date.now();
  if (!socket) socket = await useSocket(settings.server);

  socket.once('showManga', (id, mg) => {
    if (id === reqId) {
      if(isManga(mg)) {
        nodata.value = null;
        // When the manga is fetched from recommendation no language filter is applied we have to this ourself
        if(!mg.inLibrary) { // making sure we don't hide something that might be in the user's library
          mg.langs = mg.langs.filter(l => !settings.i18n.ignored.includes(l));
          mg.chapters = mg.chapters.filter(c => !settings.i18n.ignored.includes(c.lang));
        }
        if(!selectedLanguage.value) selectedLanguage.value = mg.langs[0];
        mangaRaw.value = { ...mg, covers: mg.covers.map(c => transformIMGurl(c, settings)) };
        // user categories have to be stored in a Ref in order to be reactive
        userCategories.value = mg.userCategories.sort();

        socket?.emit('getMirrors', true, (mirrors) => {
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

onBeforeMount(async () => {
  startFetch();
});

onMounted(() => {
  window.scrollTo(0, 0);
});

onBeforeUnmount(async () => {
  const socket = await useSocket(settings.server);
  socket.off('showChapter');
});

function changeRouteLang(lang: mirrorsLangsType) {
  selectedLanguage.value = lang;
  const newURL = window.location.href.replace(/\/\w+$/gi, `/${lang}`);
  history.pushState({}, '', newURL);
}

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-50)+'px'"
    class="shadow-2"
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
      <q-page class="q-mt-lg q-px-lg">
        <div
          class="flex-center flex"
          style="height:auto"
        >
          <div
            v-if="manga"
            class="cursor-pointer"
          >
            <span class="text-h3 text-center">
              {{ manga.displayName || manga.name }}
            </span>
            <q-popup-edit
              v-slot="scope"
              :model-value="manga.displayName || manga.name"
              :cover="true"
            >
              <q-input
                :model-value="manga.displayName || manga.name"
                dense
                autofocus
                counter
                :debounce="500"
                @update:model-value="(v?:string|number|null) => changeDisplayName(v)"
                @keyup.enter="scope.set"
              >
                <template #append>
                  <q-icon
                    class="cursor-pointer"
                    name="restart_alt"
                    @click="manga ? changeDisplayName(manga.name) : null"
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
          <img
            v-if="manga && mirrorinfo"
            :src="mirrorinfo.icon"
            :alt="mirrorinfo.displayName"
            class="q-mr-sm"
          >
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
        </div>
        <div class="row q-mx-sm q-mt-lg">
          <div
            class="col-md-4 col-xs-12 col-lg-3 q-my-auto q-ml-auto q-mr-auto"
          >
            <q-carousel
              v-if="manga && manga.covers.length > 0"
              v-model="slide"
              class="shadow-5 rounded-borders cursor-pointer q-ml-auto q-mr-auto"
              autoplay
              animated
              infinite
              :height="thumbnailHeight"
              style="max-width:300px;"
              @click="toggleInLibrary()"
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
                  :behavior="$q.screen.gt.md ? 'default': 'dialog'"
                  :dark="$q.dark.isActive"
                  outlined
                  :input-debounce="0"
                  dense
                  :options-dark="$q.dark.isActive"
                  color="orange"
                  :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                  style="flex-grow:1;  border-radius: 0px 4px 4px 0px!important;"
                  :model-value="{ value: selectedLanguage, label: $t(`languages.${selectedLanguage}`) }"
                  :options="manga.langs.map(v=> { return { value: v, label: $t(`languages.${v}`) } })"
                  @update:model-value="(v:OptionLanguage) => changeRouteLang(v.value)"
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
                      :class="'text-'+statusClass(manga.status)"
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
                  v-model:model-value="manga.userCategories"
                  :placeholder="$t('mangas.edit_categories')"
                  outlined
                  use-input
                  use-chips
                  multiple
                  hide-dropdown-icon
                  new-value-mode="add-unique"
                  :behavior="$q.screen.gt.md ? 'default': 'dialog'"
                  :dark="$q.dark.isActive"
                  color="orange"
                  dense
                  :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                  style="border-radius: 0px 0px 4px 4px;"
                  options-dense
                  @update:model-value="(v:string[]) => editCategories(v)"
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
          <q-table
            v-if="manga"
            binary-state-sort
            :columns="columns"
            :rows="manga.chapters"
            color="orange"
            class="w-100 q-mt-sm"
            :pagination="{sortBy: 'chap', rowsPerPage:0, descending: settings.mangaPage.chapters.sort === 'DESC'}"
          >
            <template #header="properties">
              <q-tr
                :props="properties"
                class="text-body1"
                :class="$q.dark.isActive ? 'bg-dark':'bg-white'"
              >
                <q-th
                  key="chap"
                  :props="properties"
                  style="text-align:left!important"
                  @click="settings.mangaPage.chapters.sort === 'ASC' ? settings.mangaPage.chapters.sort = 'DESC' : settings.mangaPage.chapters.sort = 'ASC'"
                >
                  {{ $t('mangas.chapter_order') }}
                </q-th>
                <q-th
                  key="fetch"
                  :props="properties"
                  style="text-align:right!important"
                >
                  {{ $t('mangas.date') }}
                </q-th>
              </q-tr>
            </template>
            <template #body="properties">
              <q-tr
                v-if="(settings.mangaPage.chapters.hideRead && !properties.row.read) || !settings.mangaPage.chapters.hideRead"
                :props="properties"
                :class="properties.row.read ? 'text-grey-8': ''"
                class="cursor-pointer"
              >
                <q-td
                  key="chap"
                  :props="properties"
                  style="white-space: normal !important;text-align:left!important"
                  @click="showChapter(properties.row)"
                >
                  <div class="text-body1 q-ma-none q-pa-none">
                    <span v-if="properties.row.volume !== undefined">{{ $t("mangas.volume") }} {{ properties.row.volume }} - </span>
                    <span>{{ $t("mangas.chapter") }} {{ properties.row.number }}</span>
                  </div>
                  <div class="text-caption">
                    <span
                      class="text-caption"
                      :class="properties.row.read ? '' : 'text-orange'"
                    >
                      {{ properties.row.name || '--' }}
                    </span>
                  </div>
                  <div class="text-caption">
                    <span
                      class="text-caption"
                      :class="properties.row.read ? '' : 'text-grey-6'"
                    >
                      {{ properties.row.group || '--' }}
                    </span>
                  </div>
                </q-td>
                <q-td
                  key="fetch"
                  :props="properties"
                  style="white-space: normal !important;text-align:right!important"
                >
                  <span>
                    {{ dayJS ? dayJS(properties.row.date).fromNow() : properties.row.date }}

                  </span>
                  <q-btn-dropdown
                    dropdown-icon="more_vert"
                    flat
                  >
                    <q-list separator>
                      <q-item
                        v-if="properties.rowIndex > 0 && properties.row.hasNextUnread"
                        v-close-popup
                        class="flex items-center"
                        clickable
                        @click="markNextAsRead(properties.rowIndex)"
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
                        v-else-if="properties.rowIndex > 0"
                        v-close-popup
                        class="flex items-center"
                        clickable
                        @click="markNextAsUnread(properties.rowIndex)"
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
                        v-if="properties.row.read"
                        v-close-popup
                        class="flex items-center"
                        clickable
                        @click="markAsUnread(properties.rowIndex)"
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
                        @click="markAsRead(properties.rowIndex)"
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
                        v-if="properties.rowIndex < nbOfChapters - 1 && properties.row.hasPrevUnread"
                        v-close-popup
                        class="flex items-center"
                        clickable
                        @click="markPreviousAsRead(properties.rowIndex)"
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
                        v-else-if="properties.rowIndex < nbOfChapters - 1"
                        v-close-popup
                        class="flex items-center"
                        clickable
                        @click="markPreviousAsUnread(properties.rowIndex)"
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
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css" scoped>
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
</style>
<style lang="css">
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
#categories .q-chip, #categories .q-chip .ellipsis {
  color: black;
  background:orange;
  max-width: 300px;
}
#categories .q-chip .q-icon {
  color: black;
}
</style>
