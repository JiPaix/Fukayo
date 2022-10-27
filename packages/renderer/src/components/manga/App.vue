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
import { useQuasar } from 'quasar';
import { computed, inject, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

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
/** manga filter dialog */
const showFilterDialog = ref(false);
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

  if(isManga(manga.value) && !isMangaInDB(manga.value)) {
    add();
  }
  else if(!isManga(manga.value) && isMangaInDB(manga.value)) {
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
      if((isManga(mg) || isMangaInDB(mg))) {
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
        <div class="row q-mx-sm">
          <div
            class="col-sm-3 col-xs-8 col-lg-2 q-my-lg"
            :class="$q.screen.lt.lg ? 'q-ml-auto q-mr-auto' : undefined"
          >
            <q-carousel
              v-if="manga && manga.covers.length > 0"
              v-model="slide"
              class="shadow-5 rounded-borders cursor-pointer"
              autoplay
              animated
              infinite
              @click="toggleInLibrary()"
            >
              <q-carousel-slide
                v-for="(mangaCover, i) in manga.covers"
                :key="i"
                :name="i"
                :img-src="mangaCover"
              />
              <template #control>
                <q-carousel-control
                  position="bottom"
                  class="w-100"
                  style="margin:0!important"
                >
                  <q-btn
                    v-if="manga"
                    class="w-100"
                    :icon="isMangaInDB(manga) ? 'o_delete_forever': 'o_library_add'"
                    :color="isMangaInDB(manga) ? 'negative' : 'orange'"
                    :text-color="isMangaInDB(manga) ? 'white': 'dark'"
                  >
                    {{ isMangaInDB(manga) ? $t('reader.manga.remove') : $t('reader.manga.add') }}
                  </q-btn>
                  <q-skeleton
                    v-else
                    class="w-100"
                    :dark="$q.dark.isActive"
                    type="QBtn"
                  />
                </q-carousel-control>
              </template>
            </q-carousel>
            <q-skeleton
              v-else
              style="width:100%;height: 400px;"
            />
          </div>
          <div
            class="col-sm-9 col-xs-12 q-px-lg q-my-lg"
          >
            <q-list
              v-if="manga"
              padding
            >
              <q-item>
                <q-item-section
                  top
                  avatar
                >
                  <q-avatar
                    color="primary"
                    text-color="white"
                    icon="translate"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ $t('languages.language', manga.langs) }}</q-item-label>
                  <q-item-label
                    caption
                  >
                    <q-btn
                      v-for="(currLang, i) in manga.langs"
                      :key="i"
                      dense
                      :outline="currLang !== selectedLanguage"
                      size="sm"
                      :color="$q.dark.isActive ? 'orange' : 'dark'"
                      :text-color="$q.dark.isActive && currLang === selectedLanguage ? 'white' : 'orange'"
                      class="q-mr-sm q-mb-sm"
                      @click="changeRouteLang(currLang)"
                    >
                      {{ $t(`languages.${currLang}`) }}
                    </q-btn>
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-separator
                spaced
                inset="item"
              />
              <q-item>
                <q-item-section
                  top
                  avatar
                >
                  <q-avatar
                    color="primary"
                    text-color="white"
                    icon="category"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ $t('mangas.categories') }}</q-item-label>
                  <q-item-label
                    caption
                  >
                    <span
                      v-for="cat in userCategories"
                      :key="cat"
                      class="self-center"
                    >
                      <q-chip
                        removable
                        size="sm"
                        :color="$q.dark.isActive ? 'orange' : 'dark'"
                        :text-color="$q.dark.isActive ? 'white' : 'orange'"
                        :label="cat"
                        :title="cat"
                        @remove="removeCategory(cat)"
                      />
                    </span>
                    <q-btn
                      flat
                      size="sm"
                      :color="$q.dark.isActive ? 'white' : 'dark'"
                      :text-color="$q.dark.isActive ? 'white' : 'dark'"
                      @click="categoryPrompt"
                    >
                      +
                    </q-btn>
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-separator
                spaced
                inset="item"
              />
              <q-item>
                <q-item-section
                  top
                  avatar
                >
                  <q-avatar
                    color="primary"
                    text-color="white"
                    icon="tag"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ $t('mangas.tags') }}</q-item-label>
                  <q-item-label
                    caption
                  >
                    <span
                      v-for="(tag, i) in manga.tags"
                      :key="i"
                      class="self-center"
                    >
                      {{ tag }}{{ i === manga.tags.length-1 ? '' : ',&nbsp;' }}
                    </span>
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-separator
                spaced
                inset="item"
              />
              <q-item>
                <q-item-section
                  top
                  avatar
                >
                  <q-avatar
                    color="primary"
                    text-color="white"
                    icon="description"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ $t('mangas.synopsis') }}</q-item-label>
                  <q-item-label
                    caption
                  >
                    {{ manga.synopsis }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-separator
                spaced
                inset="item"
              />
            </q-list>
          </div>
          <div class="row q-ml-auto">
            <div class="">
              <q-btn
                :color="$q.dark.isActive ? 'white' : 'dark'"
                :text-color="$q.dark.isActive ? 'dark' : 'white'"
                round
                icon="filter_list"
                @click="showFilterDialog = !showFilterDialog"
              />
              <q-dialog
                v-model="showFilterDialog"
                position="standard"
              >
                <q-card style="width: 350px;margin-top:50px;">
                  <q-card-section class="flex justify-between items-center">
                    <div class="text-weight-bold">
                      {{ $t('mangas.chapter_order') }}:
                    </div>
                    <q-btn
                      flat
                      round
                      :icon="settings.mangaPage.chapters.sort === 'DESC' ? 'arrow_upward' : 'arrow_downward' "
                      @click="settings.mangaPage.chapters.sort === 'ASC' ? settings.mangaPage.chapters.sort = 'DESC' : settings.mangaPage.chapters.sort = 'ASC'"
                    />
                  </q-card-section>
                  <q-card-section class="flex justify-between items-center">
                    <div class="text-weight-bold">
                      {{ $t('mangas.hide_unread') }}:
                    </div>
                    <q-toggle
                      :model-value="settings.mangaPage.chapters.hideRead"
                      @update:model-value="settings.mangaPage.chapters.hideRead = !settings.mangaPage.chapters.hideRead"
                    />
                  </q-card-section>
                </q-card>
              </q-dialog>
            </div>
          </div>
          <div
            v-if="manga"
            class="row w-100"
          >
            <q-virtual-scroll
              v-slot="{ item, index }"
              :items="chapters.filter(c => c.lang === selectedLanguage)"
              :items-size="nbOfChapters"
              :virtual-scroll-item-size="80"
              separator
              class="w-100"
            >
              <q-item
                v-if="(settings.mangaPage.chapters.hideRead && !item.read) || !settings.mangaPage.chapters.hideRead"
                :key="index"
                :dark="$q.dark.isActive"
                clickable
                style="height:80px;"
              >
                <q-item-section
                  :class="item.read ? 'text-grey-9' : ''"
                  @click="showChapter(item)"
                >
                  <q-item-label>
                    <span v-if="item.volume !== undefined">{{ $t("mangas.volume") }} {{ item.volume }} - </span>
                    <span>{{ $t("mangas.chapter") }} {{ item.number }}</span>
                  </q-item-label>
                  <q-item-label
                    caption
                  >
                    <span class="text-orange">{{ item.name || '--' }}</span>
                  </q-item-label>
                  <q-item-label
                    caption
                  >
                    <span class="text-grey-6 text-caption">{{ item.group }}</span>
                  </q-item-label>
                </q-item-section>
                <q-item-section
                  side
                >
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
                          {{ $t('mangas.markasread.next') }}
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
                          {{ $t('mangas.markasread.next_unread') }}
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
                          {{ $t('mangas.markasread.current_unread') }}
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
                          {{ $t('mangas.markasread.current') }}
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
                          {{ $t('mangas.markasread.previous') }}
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
                          {{ $t('mangas.markasread.previous_unread') }}
                        </q-item>
                      </q-list>
                    </q-btn-dropdown>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-virtual-scroll>
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
