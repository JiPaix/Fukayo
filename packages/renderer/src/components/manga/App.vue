<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { mirrorInfo } from '@api/models/types/shared';
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n/index';
import { useSocket } from '@renderer/components/helpers/socket';
import {
isManga,
isMangaInDb,
} from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import type dayjs from 'dayjs';
import { useQuasar } from 'quasar';
import { computed, inject, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { routeTypeHelper } from '../helpers/routePusher';

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
    return chapters.sort((a, b) => a.number - b.number);
  }
  return chapters.sort((a, b) => b.number - a.number);
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

  const params = routeTypeHelper('reader', {
    mirror: mirrorinfo.value.name,
    lang: chapter.lang,
    url: chapter.url,
    id: chapter.id,
    parentId: manga.value.id,
  });

  router.push(params);
}

/** toggle manga in and out of library */
function toggleInLibrary() {
  if(!manga.value) return;

  if(isManga(manga.value) && !isMangaInDb(manga.value)) {
    add();
  }
  else if(!isManga(manga.value) && isMangaInDb(manga.value)) {
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

  if(isMangaInDb(manga.value)) {
    socket.emit('removeManga', manga.value, selectedLanguage.value, (res) => {
      mangaRaw.value = res;
      // automatically select another language when current is deleted
      changeRouteLang(langIndex < 0 || res.langs.length-1 < langIndex ? res.langs[0] : res.langs[langIndex]);
    });
  }
}

/** upserts manga in database, also updates `mangaRaw` */
async function updateManga(updatedManga:MangaInDB|MangaPage) {
  if(!manga.value) return;
  if(!socket) socket = await useSocket(settings.server);
  if(isMangaInDb(manga.value)) {
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
  const lang = selectedLanguage.value;
  if(!socket) socket = await useSocket(settings.server);
  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = true;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang, url: manga.value.url, chapterUrl: c.url, read: true});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

/** Mark a chapter as unread */
async function markAsUnread(index:number) {
  if(!manga.value) return;
  const lang = selectedLanguage.value;
  if(!lang) return;
  if(!socket) socket = await useSocket(settings.server);
  const updatedChapters = chapters.value.map(c => {
    if(c.number === chapters.value[index].number) {
      c.read = false;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang, url: manga.value.url, chapterUrl: c.url, read: false});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

/** Mark all previous chapters as read */
function markPreviousAsRead(index: number) {
  if(!manga.value) return;
  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = true;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang, url: manga.value.url, chapterUrl: c.url, read: true});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

/** Mark all previous chapters as unread */
function markPreviousAsUnread(index: number) {
  if(!manga.value) return;
  const lang = selectedLanguage.value;
  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map(c => {
    if(c.number < chapNum) {
      c.read = false;
      if(manga.value) {
        socket?.emit('markAsRead', {mirror: manga.value.mirror, lang: lang, url: manga.value.url, chapterUrl: c.url, read: false});
      }
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

/** Mark all next chapters as read */
function markNextAsRead(index: number) {
  if(!manga.value) return;
  const lang = selectedLanguage.value;

  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map((c) => {
    if(c.number > chapNum && c.lang === lang) {
      c.read = true;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
}

/** Mark all next chapters as unread */
function markNextAsUnread(index: number) {
  if(!manga.value) return;
  const lang = selectedLanguage.value;

  const chapNum = chapters.value[index].number;
  const updatedChapters = chapters.value.map((c) => {
    if(c.number > chapNum && c.lang === lang) {
      c.read = false;
    }
    return c;
  });
  const updatedManga = { ...manga.value, chapters: updatedChapters };
  updateManga(updatedManga);
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

async function startFetch() {
  nodata.value = null;
  const reqId = Date.now();
  if (!socket) socket = await useSocket(settings.server);

  socket.once('showManga', (id, mg) => {
    if (id === reqId) {
      if((isManga(mg) || isMangaInDb(mg))) {
        nodata.value = null;
        mangaRaw.value = mg;
        if(!selectedLanguage.value) {
          selectedLanguage.value = mg.langs[0];
        }
        socket?.emit('getMirrors', true, (mirrors) => {
          const m = mirrors.find((m) => m.name === mg.mirror);
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
                @update:model-value="(v) => changeDisplayName(v)"
                @keyup.enter="scope.set"
              >
                <template #append>
                  <q-icon
                    class="cursor-pointer"
                    name="restart_alt"
                    @click="manga ? changeDisplayName(manga.name) : null"
                  >
                    <q-tooltip>
                      Reset manga name to default
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
                    :icon="isMangaInDb(manga) ? 'o_delete_forever': 'o_library_add'"
                    :color="isMangaInDb(manga) ? 'negative' : 'orange'"
                    :text-color="isMangaInDb(manga) ? 'white': 'dark'"
                  >
                    {{ isMangaInDb(manga) ? $t('reader.manga.remove') : $t('reader.manga.add') }}
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
            <div class="q-mb-lg">
              <div
                class="flex items-center"
              >
                <span
                  class="text-bold"
                >
                  {{ $t('languages.language').toLocaleUpperCase() }}:
                </span>
                <div
                  v-if="manga"
                  class="text-weight-medium q-ml-sm"
                >
                  <q-btn-group>
                    <q-btn
                      v-for="(currLang, i) in manga.langs"
                      :key="i"
                      dense
                      :outline="currLang !== selectedLanguage"
                      size="sm"
                      :color="$q.dark.isActive ? 'orange' : 'dark'"
                      :text-color="$q.dark.isActive && currLang === selectedLanguage ? 'white' : 'orange'"
                      @click="changeRouteLang(currLang)"
                    >
                      {{ $t(`languages.${currLang}`) }}
                    </q-btn>
                  </q-btn-group>
                </div>
                <q-skeleton
                  v-else
                  :dark="$q.dark.isActive"
                  type="text"
                  class="text-weight-medium q-ml-sm q-my-none"
                  width="50px"
                />
              </div>
            </div>
            <div
              v-if="manga"
              class="q-mb-md"
            >
              <div
                v-if="manga.tags.length"
                class="flex items-center"
              >
                <span class="text-bold q-mr-sm">{{ $t('mangas.tags').toLocaleUpperCase() }}</span>
                <span
                  v-for="(tag, i) in manga.tags"
                  :key="i"
                  class="self-center"
                >
                  {{ tag }}{{ i === manga.tags.length-1 ? '' : ',&nbsp;' }}
                </span>
              </div>
            </div>
            <div v-if="manga">
              <span class="text-bold">{{ $t('mangas.synopsis').toLocaleUpperCase() }}</span>
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
        <div class="row q-mb-md">
          <div class="col-xs-3 offset-xs-9 col-sm-2 offset-sm-10 q-ml-auto col-lg-1 offset-lg-11 text-center">
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
          class="row"
        >
          <q-virtual-scroll
            v-slot="{ item, index }"
            :items="chapters.filter(c => c.lang === selectedLanguage)"
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
              <q-item-section
                :class="item.read ? 'text-grey-9' : ''"
                @click="showChapter(item)"
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
          </q-virtual-scroll>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
  <!-- <div
    v-if="nodata"
    class="absolute-full flex column flex-center"
  >
    <q-banner
      class="text-white bg-negative"
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
  <q-card
    v-else
    class="w-100 q-pa-lg"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark'"
    :dark="$q.dark.isActive"
  >
    <div
      class="row"
    >
      <div
        class="col-12"
      >
        Manga name
        <div
          v-if="manga"
          class="flex flex-center"
        >

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
        Tags
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
    Cover
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
    Manga info
    <div
      class="col-sm-9 col-xs-12 q-px-lg q-my-lg"
    >
      Manga source & language
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
      Manga description
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
  Chapters list
  </div>
  <div class="row">
    <q-virtual-scroll
      v-slot="{ item, index }"
      :items="chapters"
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
        Chapter name, volume, number
        <q-item-section
          :class="item.read ? 'text-grey-9' : ''"
          @click="showChapter(item)"
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
          Chapter Date
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
    </q-virtual-scroll>
  </div>
  </q-card> -->
</template>
