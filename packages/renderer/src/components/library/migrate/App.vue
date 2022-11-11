<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import { isMangaPage } from '@api/db/helpers';
import type { MangaErrorMessage, SearchErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo, TaskDone } from '@api/models/types/shared';
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { isSearchResult, isTaskDone } from '@renderer/components/helpers/typechecker';
import type { MangaInDBwithLabel } from '@renderer/components/library/@types';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useQuasar } from 'quasar';
import { onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';

/** props */
const props = defineProps<{
  mangas: (MangaInDBwithLabel & { covers: string[], mirrorDisplayName: string, mirrorIcon: string })[]
  /** is this migration tool used because of broken mirror/entries? */
  bug: boolean
}>();
/** web socket */
let socket: socketClientInstance | undefined;
/** quasar */
const $q = useQuasar();
/** i18n */
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
/** router */
const router = useRouter();
/** settings */
const settings = useSettingsStore();
/** template ref (infinite scroll) */
const scrollTargetRef = ref<null|Element>(null);
/** show-hide main dialog */
const dialog = ref(false);
/** carrousel slides */
const slide = ref(0);
/** list of mangas yet to be fixed */
const mangasToFix = ref(props.mangas);
/** available mirrors */
const mirrors = ref<mirrorInfo[]>([]);
/** selected migration mirror */
const migrationMirror = ref<string[]|null>(null);
/** possible candidate for selected manga */
const candidates = ref<MangaPage[]>([]);
/** origin of candidate */
const compareSource = ref(props.mangas[0]);
/** loading candidates? */
const loadingCandidates = ref(false);
/** show candidates dialog */
const showCandidates = ref(false);

async function search(origin: typeof props.mangas[0], selectedMirrors: string[]) {
  selectedMirrors = mirrors.value.filter(m=> selectedMirrors.includes(m.displayName)).map(m=>m.name);
  const search = await internalSearch(origin, selectedMirrors);
  for(const s of search) {
    try {
      const f = await fetch(s.mirrorinfo.name, s.langs, s.url, s.id);
      candidates.value.push(f);
    } catch(e) {
      continue;
    }
  }
  loadingCandidates.value = false;
  if(candidates.value.length) showCandidates.value = true;
}

async function internalSearch(origin: typeof props.mangas[0], selectedMirrors: string[]):Promise<SearchResult[]> {
  compareSource.value = origin;
  const search:SearchResult[] = [];
  loadingCandidates.value = true;
  showCandidates.value = false;
  const reqId = Date.now();
  let mirrorToWait = selectedMirrors.length;
  if (!socket) socket = await useSocket(settings.server);
  return new Promise(resolve => {
    const searchListener = (id:number, manga:SearchResult | SearchResult[] | SearchErrorMessage | TaskDone) => {
      if(id !== reqId) return;

      if(isSearchResult(manga)) {
        search.push(manga);
      }
      if(isTaskDone(manga)) {
        --mirrorToWait;
      }
      if(mirrorToWait <= 0) {
        if(socket) socket.removeListener('searchInMirrors', searchListener);
        resolve(search);
      }
    };
    if(!socket) return;
    socket.removeListener('searchInMirrors', searchListener);
    socket.on('searchInMirrors', searchListener);
    socket.emit('searchInMirrors', origin.name, reqId, selectedMirrors, origin.langs, (nbOfDonesToExpect) => {
      mirrorToWait = nbOfDonesToExpect;
    });
  });
}

async function fetch(mirror: string, langs: mirrorsLangsType[], url: string, id:string):Promise<MangaPage> {
  if (!socket) socket = await useSocket(settings.server);
  const reqId = Date.now();
  return new Promise((resolve, reject) => {
      const mangaListener = (id: number, manga: MangaPage | MangaInDB | MangaErrorMessage) => {
      if(id !== reqId) return;
      if(isMangaPage(manga)) resolve(manga);
      else reject(manga);
    };
    if(!socket) return;
    socket.removeListener('showManga', mangaListener);
    socket.on('showManga', mangaListener);
    socket.emit('showManga', reqId, { mirror, langs, url, id});
  });
}

async function migrate(source:typeof props.mangas[0], candidate:MangaPage) {
  const mirrorVersion = mirrors.value.find(m => m.name === source.mirror);
  if(!mirrorVersion) return;
  const mangaSource:MangaInDB = {
    id: source.id,
    url: source.url,
    langs: source.langs,
    name: source.name,
    displayName: source.displayName,
    covers: source.covers,
    synopsis: source.synopsis,
    tags: source.tags,
    authors: source.authors,
    inLibrary: true,
    userCategories: source.userCategories,
    meta: source.meta,
    mirror: { name: source.mirror, version: mirrorVersion.version },
    status: source.status,
    chapters: source.chapters.map(c => {
      return {
        ...c,
      };
    }),
  };

  const mangaTarget:MangaPage = {
    ...candidate,
    chapters: candidate.chapters.map(c => {
      return {
        ...c,
        read: (source.chapters.find(cc => cc.number === c.number && cc.volume === cc.volume)?.read) || false,
      };
    }),
  };

  if (!socket) socket = await useSocket(settings.server);


  socket.emit('addManga', {manga: mangaTarget, settings: { ...mangaSource.meta.options }}, (mg) => {
    mangaSource.langs.forEach(l => socket?.emit('removeManga', mangaSource, l, () => null));
    const params = routeTypeHelper('manga', { id: mg.id, lang: mg.langs[0], mirror: mg.mirror.name });
    router.push(params);
  });
}

onBeforeMount(async() => {
  if (!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', false, (m => {
    mirrors.value = m;
  }));
});

</script>
<template>
  <div class="flex flex-center q-pa-lg">
    <q-banner
      dense
      :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
      class="shadow-2"
    >
      <template #avatar>
        <q-icon
          name="bug_report"
          color="negative"
          class="align-middle"
        />
      </template>
      <div>
        <span>{{ $t('migrate.warning') }}</span>
        <br><span class="text-caption">{{ $t('migrate.hidden') }}</span>
      </div>

      <template #action>
        <q-btn
          flat
          dense
          color="primary"
          :label="$t('migrate.insepect')"
          @click="dialog = true"
        />
      </template>
    </q-banner>
  </div>

  <q-dialog
    v-model="dialog"
    maximized
  >
    <q-layout view="lHh lpR lFf">
      <q-header
        elevated
        class="bg-dark"
      >
        <q-toolbar>
          <q-toolbar-title>
            <q-btn
              square
              dense
              flat
              size="lg"
              icon="arrow_back"
              @click="dialog = !dialog"
            >
              {{ $t('migrate.close') }}
            </q-btn>
          </q-toolbar-title>
        </q-toolbar>
      </q-header>
      <q-page-container
        :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
      >
        <q-page>
          <div>
            <div
              ref="scrollTargetRef"
              class="q-pa-md"
              style="overflow: auto;"
              :style="{ maxHeight: `${$q.screen.height-50}px` }"
            >
              <q-infinite-scroll
                :scroll-target="scrollTargetRef ? scrollTargetRef : undefined"
              >
                <div
                  v-for="(manga, i) in mangasToFix"
                  :key="i"
                  class="bg-grey-9 q-pa-md q-ma-lg flex flex-center"
                >
                  <div class="row q-mx-sm w-100 ">
                    <div
                      class="col-sm-3 col-xs-8 col-lg-2 q-my-lg"
                      :class="$q.screen.lt.lg ? 'q-ml-auto q-mr-auto' : undefined"
                    >
                      <q-carousel
                        v-model="slide"
                        class="shadow-5 rounded-borders"
                        autoplay
                        animated
                        infinite
                      >
                        <q-carousel-slide
                          v-for="(mangaCover, ci) in manga.covers"
                          :key="ci"
                          :name="ci"
                          :img-src="transformIMGurl(mangaCover, settings)"
                        />
                      </q-carousel>
                    </div>
                    <div
                      class="col-sm-9 col-xs-12 q-px-lg q-my-lg"
                    >
                      <q-list
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
                              icon="menu_book"
                            />
                          </q-item-section>

                          <q-item-section>
                            <q-item-label>{{ $t('mangas.title') }}</q-item-label>
                            <q-item-label caption>
                              {{ manga.name }}
                            </q-item-label>
                            <q-item-label
                              v-if="manga.displayName"
                              caption
                            >
                              ( {{ manga.displayName }} )
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
                              icon="cloud"
                            />
                          </q-item-section>

                          <q-item-section>
                            <q-item-label>{{ $t('mangas.source') }}</q-item-label>
                            <q-item-label
                              caption
                            >
                              <q-icon
                                :name="'img:'+manga.mirrorIcon"
                                size="16px"
                              />
                              {{ manga.mirrorDisplayName }}
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
                              icon="translate"
                            />
                          </q-item-section>

                          <q-item-section>
                            <q-item-label>{{ $t('languages.language', manga.langs) }}</q-item-label>
                            <q-item-label
                              caption
                            >
                              <q-btn
                                v-for="(currLang, il) in manga.langs"
                                :key="il"
                                dense
                                size="sm"
                                :color="$q.dark.isActive ? 'orange' : 'dark'"
                                class="q-mr-sm q-mb-sm"
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
                              color="negative"
                              text-color="white"
                              icon="bug_report"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>{{ $t('migrate.bug') }}</q-item-label>
                            <q-item-label caption>
                              <span>
                                {{ $t('migrate.mirror_status') }}:
                              </span>
                              <span
                                v-if="manga.dead"
                                class="text-negative"
                              >
                                ✖
                              </span>
                              <span
                                v-else
                                class="text-positive"
                              >✔</span>
                            </q-item-label>
                            <q-item-label caption>
                              <span>
                                {{ $t('migrate.entry_status') }}:
                              </span>
                              <span
                                v-if="manga.broken"
                                class="text-negative"
                              >
                                ✖
                              </span>
                              <span
                                v-else
                                class="text-positive"
                              >
                                ✔
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
                              color="positive"
                              text-color="white"
                              icon="swap_horiz"
                            />
                          </q-item-section>

                          <q-item-section>
                            <q-item-label>{{ $t('migrate.solutions') }}</q-item-label>
                            <q-item-label
                              caption
                            >
                              <q-select
                                v-model="migrationMirror"
                                :options="mirrors.filter(m => m.langs.some(l => manga.langs.includes(l)) && manga.dead ? manga.mirror !== m.name : true).map(m => m.displayName)"
                                multiple
                                :label="$t('migrate.select_mirror')"
                              />
                              <q-btn
                                class="q-mr-sm"
                                :disable="!migrationMirror || !migrationMirror.length"
                                :loading="loadingCandidates"
                                @click="migrationMirror ? search(manga, migrationMirror) : null"
                              >
                                {{ $t('migrate.search_candidates') }}
                              </q-btn>
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </div>
                  </div>
                </div>
              </q-infinite-scroll>
            </div>
          </div>
          <q-dialog
            v-model="showCandidates"
          >
            <q-card>
              <q-card-section>
                <span class="text-h6">{{ $t('migration.results') }}</span>
              </q-card-section>
              <q-card-section
                v-for="(candidate,i) in candidates"
                :key="i"
              >
                <q-card>
                  <q-card-section horizontal>
                    <div class="flex-row q-my-auto">
                      <div
                        class="col-12"
                      >
                        <q-img :src="transformIMGurl(candidate.covers[0], settings)" />
                      </div>
                      <div class="col-12">
                        <q-btn
                          class="q-mt-auto"
                          square
                          color="orange"
                          @click="migrate(compareSource,candidate)"
                        >
                          {{ $t('migrate.select_candidate') }}
                        </q-btn>
                      </div>
                    </div>
                    <q-list
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
                            icon="menu_book"
                          />
                        </q-item-section>

                        <q-item-section>
                          <q-item-label>{{ $t('mangas.title') }}</q-item-label>
                          <q-item-label caption>
                            <span class="text-green">{{ $t('migrate.new') }}:</span> {{ candidate.name }}
                          </q-item-label>
                          <q-item-label caption>
                            <span class="text-negative">{{ $t('migrate.old') }}:</span> {{ compareSource.name }}
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
                            icon="cloud"
                          />
                        </q-item-section>

                        <q-item-section>
                          <q-item-label>{{ $t('mangas.source') }}</q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-green">{{ $t('migrate.new') }}:</span> {{ candidate.mirror.name }}
                          </q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-negative">{{ $t('migrate.old') }}:</span> {{ compareSource.mirror }}
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
                            icon="translate"
                          />
                        </q-item-section>

                        <q-item-section>
                          <q-item-label>{{ $t('languages.language', candidate.langs) }}</q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-green">{{ $t('migrate.new') }}: </span>
                            <span
                              v-for="(currLang, il) in candidate.langs"
                              :key="il"
                            >
                              {{ $t(`languages.${currLang}`) }}{{ il < candidate.langs.length-1 ? ', ': '' }}
                            </span>
                          </q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-negative">{{ $t('migrate.old') }}: </span>
                            <span
                              v-for="(currLang, il) in compareSource.langs"
                              :key="il"
                            >
                              {{ $t(`languages.${currLang}`) }}{{ il < compareSource.langs.length-1 ? ', ': '' }}
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
                            icon="translate"
                          />
                        </q-item-section>

                        <q-item-section>
                          <q-item-label>{{ $t('mangas.chapter', 10) }}</q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-green">{{ $t('migrate.new') }}: </span>
                            {{ candidate.chapters.length }}
                          </q-item-label>
                          <q-item-label
                            caption
                          >
                            <span class="text-negative">{{ $t('migrate.old') }}: </span>
                            {{ compareSource.chapters.length }}
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </q-card-section>
                </q-card>
              </q-card-section>
            </q-card>
          </q-dialog>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>
