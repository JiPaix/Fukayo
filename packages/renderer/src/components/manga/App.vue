<script lang="ts" setup>
import { inject, onBeforeUnmount, onMounted } from 'vue';
import { onBeforeMount, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStore as useSettingsStore } from '/@/store/settings';
import { QItem, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useSocket } from '../helpers/socket';
import { useRouter } from 'vue-router';
import {
  isManga,
  isMangaInDb,
} from '../helpers/typechecker';
import type dayjs from 'dayjs';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';
import type { supportedLangsType } from '../../locales/lib/supportedLangs';
import type en from '../../locales/en.json';

const props = defineProps<{
  url?: string
}>();

/** quasar */
const $q = useQuasar();
const $t = useI18n<{message: typeof en}, supportedLangsType>().t.bind(useI18n());
/** vue-router */
const router = useRouter();
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
/** the number of chapters */
const nbOfChapters = ref(0);
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

/** list of unread chapters */
const unreadChaps = computed(() => {
  return chapters.value.filter((c) => !c.read);
});


/** move to the reader */
function showChapter(chapter:MangaInDB['chapters'][0] | MangaPage['chapters'][0]) {
  if(!mirrorinfo.value || !manga.value) return;

  const params = {
    mirror: mirrorinfo.value.name,
    lang: manga.value.lang,
    url: chapter.url,
    id: chapter.id,
    parentId: manga.value.id,
  };
  router.push({
    name: 'reader',
    params,
  });
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
  if(isMangaInDb(manga.value)) {
    socket?.emit('removeManga', manga.value, (res) => {
      mangaRaw.value = res;
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
    mangaRaw.value = manga.value;
  }
}

/** Mark a chapter as read */
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

/** Mark a chapter as unread */
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

/** Mark all previous chapters as read */
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

/** Mark all previous chapters as unread */
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

/** Mark all next chapters as read */
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

/** Mark all next chapters as unread */
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

/** Opens the "change display name" dialog, calls `updateManga` when user press "OK" */
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
  if (!socket) socket = await useSocket(settings.server);
  const mangaId  = (route.params as { id: string; }).id;

  const reqId = Date.now();

  socket.once('showManga', (id, mg) => {
    if (id === reqId) {
      if((isManga(mg) || isMangaInDb(mg))) {
        nodata.value = null;
        nbOfChapters.value = mg.chapters.length;
        mangaRaw.value = mg;
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
  socket?.emit('showManga', reqId, { id: mangaId });
}

onBeforeMount(async () => {
  await startFetch();
});

onMounted(() => {
  window.scrollTo(0, 0);
});

onBeforeUnmount(async () => {
  const socket = await useSocket(settings.server);
  socket.off('showChapter');
});

</script>
<template>
  <div
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
      </q-virtual-scroll>
    </div>
  </q-card>
</template>
