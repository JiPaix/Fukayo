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
  else if($q.screen.sm) return '370px';
  else if($q.screen.md) return '500px';
  return '700px';
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

const chapters = computed(() => {
  if (mangaRaw.value && mangaRaw.value.chapters) {
    return sortChapter(mangaRaw.value.chapters);
  }
  return [];
});

const cats = computed(() => {
  if(mangaRaw.value) {
    return Array.from(chunks(mangaRaw.value.userCategories, 2));
  }
  return [] as string[];
});

const tags = computed(() => {
  if(mangaRaw.value) {
    return Array.from(chunks(mangaRaw.value.tags, 2));
  }
  return [] as string[];
});

const authors = computed(() => {
  if(mangaRaw.value) {
    return Array.from(chunks(mangaRaw.value.authors, 2));
  }
  return [] as string[];
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
  if(a.volume && b.volume) {
    const diff = a.volume - b.volume;
    if(diff) return diff;
  }
  return a.number - b.number;
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
    }),
  };
});

/** list of unread chapters */
const unreadChaps = computed(() => {
  return chapters.value.filter((c) => !c.read);
});

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

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

/** remove category */
function removeCategory(catName:string) {
  if(!manga.value) return;
  userCategories.value = userCategories.value.filter(cat => cat !== catName);
  if(isMangaInDB(manga.value)) {
    manga.value.userCategories = userCategories.value;
    updateManga(manga.value);
  }
}

function addCategory(catName: string) {
  catName = catName.trim();
  if(!manga.value) return;
  if(userCategories.value.includes(catName)) return;
  userCategories.value.push(catName);
  if(isMangaInDB(manga.value)) {
    manga.value.userCategories = userCategories.value;
    updateManga(manga.value);
  }
}

function categoryPrompt() {
  $q.dialog({
    title: $t('mangas.add_new_category'),
    prompt: {
      model: '',
      type: 'text', // optional
    },
    cancel: true,
  }).onOk(data => {
    addCategory(data);
  });
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
        userCategories.value = mg.userCategories;

        socket?.emit('getMirrors', true, (mirrors) => {
          const m = mirrors.find((m) => m.name === mg.mirror.name);
          if(m) mirrorinfo.value = m;
        });
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
  console.log(lang);
  const newURL = window.location.href.replace(/\/\w+\/$/gi, `/${lang}/`);
  history.pushState({}, '', newURL);
  selectedLanguage.value = lang;
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
            class="col-sm-4 col-xs-12 col-lg-3 q-my-auto q-ml-auto q-mr-auto"
          >
            <q-carousel
              v-if="manga && manga.covers.length > 0"
              v-model="slide"
              class="shadow-5 rounded-borders cursor-pointer"
              autoplay
              animated
              infinite
              :height="thumbnailHeight"
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
            <q-btn
              v-if="manga"
              size="md"
              class="w-100 q-mt-xs"
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
            <q-skeleton
              v-else
              class="w-100 q-mt-xs"
              :dark="$q.dark.isActive"
              type="QBtn"
            />
          </div>
          <div
            class="col-sm-8 col-xs-12 q-my-lg q-ml-auto"
            :class="$q.screen.gt.xs ? 'q-px-lg': ''"
          >
            <div
              v-if="manga"
              class="flex column rounded-borders justify-evenly q-px-sm"
              style="gap: 15px;"
              :style="{minHeight: thumbnailHeight}"
            >
              <div class="flex">
                <q-icon
                  name="translate"
                  color="white"
                  size="56px"
                  class="bg-orange-7 q-px-sm"
                  style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                />
                <q-select
                  :label="$t('languages.language', manga.langs)"
                  :readonly="manga.langs.length < 2"
                  :behavior="$q.screen.gt.md ? 'default': 'dialog'"
                  :dark="$q.dark.isActive"
                  filled

                  square
                  style="flex-grow:1;"
                  :model-value="{ value: selectedLanguage, label: $t(`languages.${selectedLanguage}`) }"
                  :options="manga.langs.map(v=> { return { value: v, label: $t(`languages.${v}`) } })"
                  @update:model-value="(v:OptionLanguage) => changeRouteLang(v.value)"
                />
              </div>
              <div class="flex">
                <q-icon
                  name="person"
                  color="white"
                  size="56px"
                  class="bg-orange-7 q-px-sm"
                  style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                >
                  <q-tooltip>{{ $t('mangas.authors_and_artists') }}</q-tooltip>
                </q-icon>
                <div
                  v-for="(authorsChunks, i) in authors"
                  :key="i"
                  class="flex column justify-evenly text-caption q-px-xs"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-4'"
                  style="flex-grow:1;"
                >
                  <span
                    v-for="(author, it) in authorsChunks"
                    :key="it"
                    dense
                    class="q-my-xs text-center rounded-borders q-px-sm"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                  >
                    {{ author }}
                  </span>
                </div>
              </div>
              <div class="flex">
                <q-icon
                  name="tag"
                  color="white"
                  size="56px"
                  class="bg-orange-7 q-px-sm"
                  style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                >
                  <q-tooltip>{{ $t('mangas.tags') }}</q-tooltip>
                </q-icon>
                <div
                  v-for="(tagChunks, i) in tags"
                  :key="i"
                  class="flex column justify-evenly text-caption q-px-xs"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-4'"
                  style="flex-grow:1;"
                >
                  <span
                    v-for="(tag, it) in tagChunks"
                    :key="it"
                    dense
                    class="q-my-xs text-center rounded-borders q-px-sm"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                  >
                    {{ tag }}
                  </span>
                </div>
                <div
                  class="flex column text-caption q-px-xs"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-4'"
                  style="flex-grow:1;"
                />
              </div>
              <div class="flex">
                <q-icon
                  name="category"
                  color="white"
                  size="56px"
                  class="bg-orange-7 q-px-sm"
                  style="border-radius: 4px 0px 0px 4px;min-height: 40px"
                >
                  <q-tooltip>{{ $t('mangas.categories') }}</q-tooltip>
                </q-icon>
                <div
                  v-if="cats.length === 0"
                  style="flex-grow:1;"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-4'"
                />
                <div
                  v-for="(catsChunks, i) in cats"
                  v-else
                  :key="i"
                  class="flex column justify-evenly text-caption q-px-xs"
                  :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-4'"
                  style="flex-grow:1;"
                >
                  <q-chip
                    v-for="(cat, it) in catsChunks"
                    :key="it"
                    removable
                    dense
                    class="q-my-none"
                    :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                    @remove="removeCategory(cat)"
                  >
                    <span class="self-center">{{ cat }}</span>
                  </q-chip>
                </div>
                <q-btn
                  text-color="white"
                  size="24.5px"
                  dense
                  square
                  class="self-start text-center q-my-auto"
                  style="background: rgba(255, 127, 0, 1)"
                  @click="categoryPrompt"
                >
                  +
                </q-btn>
              </div>
              <div v-if="manga.synopsis">
                <div
                  class="flex w-100"
                  :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
                >
                  <q-icon
                    name="menu_book"
                    color="white"
                    size="56px"
                    class="bg-orange-7 q-px-sm"
                    style="border-radius: 4px 0px 0px 0px;"
                  />
                  <span class="q-ml-auto q-mr-auto self-center">
                    {{ $t('mangas.synopsis') }}
                  </span>
                </div>
                <div
                  class="w-100 q-pa-sm"
                  :style="`background: rgba(255, 255, 255, ${$q.dark.isActive ? '0.3': '1'})`"
                >
                  <span
                    class="text-caption"
                    style="word-wrap:break-word;"
                  >
                    {{ manga.synopsis }}
                  </span>
                </div>
              </div>
              <div
                class="flex"
                :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-4'"
              >
                <q-icon
                  name="newspaper"
                  color="white"
                  size="56px"
                  class="bg-orange-7 q-px-sm"
                  style="border-radius: 4px 0px 0px 0px;"
                />
                <div
                  class="flex items-center"
                  style="flex-grow:1;"
                >
                  <span class="q-ml-auto q-mr-auto text-center">
                    <span
                      v-show="$q.screen.gt.xs"
                      class="q-mr-sm"
                    >{{ $t('mangas.publication') }}</span>
                    <span
                      class="text-weight-bold q-ml-auto text-center"
                      :class="'text-'+statusClass(manga.status)"
                    >
                      {{ $t(`mangas.status_${manga.status}`) }}
                    </span>
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
