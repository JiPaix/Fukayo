<script lang="ts" setup>
import { isManga } from '@api/db/helpers';
import type { MangaErrorMessage, SearchErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo, TaskDone } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import { isSearchResult, isTaskDone } from '@renderer/components/helpers/typechecker';
import type { MangaInDBwithLabel } from '@renderer/components/library/@types';
import EntryFixer from '@renderer/components/library/migrate/EntryFixer.vue';
import MigrateButton from '@renderer/components/library/migrate/MigrateButton.vue';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import Fuse from 'fuse.js';
import { useQuasar } from 'quasar';
import type { Ref} from 'vue';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

/** props */
const props = defineProps<{
  mangas: (MangaInDBwithLabel & { covers: string[], mirrorDisplayName: string, mirrorIcon: string })[]
  /** is this migration tool used because of broken mirror/entries? */
  bug: boolean
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** router */
router = useRouter(),
/** user settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// state
const
/** template ref (infinite scroll) */
scrollTargetRef = ref<null|Element>(null),
/** template ref height */
migrateHeader = ref(0),
/** show-hide main dialog */
dialog = ref(false),
/** list of mangas yet to be fixed */
mangasToFix = ref(props.mangas),
/** available mirrors */
mirrors = ref<mirrorInfo[]>([]),
/** selected migration mirror */
migrating = ref(false),
/** possible candidate for selected manga */
candidates = ref<MangaPage[]>([]),
/** origin of candidate */
compareSource = ref(props.mangas[0]),
/** loading candidates? */
loadingCandidates = ref(false),
/** show candidates dialog */
showCandidates = ref(false);

// computed
const
/** size of header */
headerSize = computed(() => {
  if(!migrateHeader.value) return 0;
  else return migrateHeader.value;
});

/** search manga in mirrors */
async function search(origin: typeof props.mangas[0], selectedMirrors: string[], loader: Ref<boolean>) {
  compareSource.value = origin;
  showCandidates.value = false;
  candidates.value = [];

  let search = await internalSearch(origin, selectedMirrors);

  const fuse = new Fuse(search, {keys: ['name', 'displayName'], shouldSort: true });
  const result = fuse.search('tion');

  search = result.map(r=>r.item).reverse();

  for(const s of search) {
    try {
      const f = await fetch(s.mirrorinfo.name, s.langs, s.url, s.id);
      candidates.value.push(f);
    } catch(e) {
      continue;
    }
  }
  loader.value = false;
  if(candidates.value.length) showCandidates.value = true;
}

/** interact with the API to find searchResults */
async function internalSearch(origin: typeof props.mangas[0], selectedMirrors: string[]):Promise<SearchResult[]> {
  compareSource.value = origin;
  const search:SearchResult[] = [];
  loadingCandidates.value = true;
  showCandidates.value = false;
  const reqId = Date.now();
  let mirrorToWait = selectedMirrors.length;
  const socket = await useSocket(settings.server);
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

/** Fetch a manga */
async function fetch(mirror: string, langs: mirrorsLangsType[], url: string, id:string):Promise<MangaPage> {
  const socket = await useSocket(settings.server);
  const reqId = Date.now();
  return new Promise((resolve, reject) => {
      const mangaListener = (id: number, manga: MangaPage | MangaInDB | MangaErrorMessage) => {
      if(id !== reqId) return;
      if(isManga(manga)) resolve(manga);
      else reject(manga);
    };
    if(!socket) return;
    socket.removeListener('showManga', mangaListener);
    socket.on('showManga', mangaListener);
    socket.emit('showManga', reqId, { mirror, langs, url, id, force: true});
  });
}

function removeLangFromCandidate(candidate: MangaPage, lang: mirrorsLangsType) {
  candidate.langs = candidate.langs.filter(l => l !== lang);
  candidate.chapters = candidate.chapters.filter(chapter => chapter.lang !== lang);
}

/** migrate manga */
async function migrate(source:typeof props.mangas[0], candidate:MangaPage, loader: Ref<boolean>) {
  const mirrorVersion = mirrors.value.find(m => m.name === source.mirror);
  if(!mirrorVersion) return;
  migrating.value = true;
  loader.value = true;
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

  const socket = await useSocket(settings.server);
  const mangaSettings = {...mangaSource.meta.options };

  async function removeOld(lang:mirrorsLangsType):Promise<void> {

    return new Promise(resolve => {
      socket.emit('removeManga', mangaSource, lang, () => resolve());
    });

  }

  for(const lang of mangaSource.langs) {
    await removeOld(lang);
  }

  socket.emit('addManga', { manga: mangaTarget, settings: mangaSettings}, (mg) => {
    const params = routeTypeHelper('manga', { id: mg.id, lang: mg.langs[0], mirror: mg.mirror.name });
    router.push(params);
  });

}

/** get list of mirrors */
async function On() {
  const socket = await useSocket(settings.server);
  socket.emit('getMirrors', false, (m => mirrors.value = m.filter(mm => mm.isOnline && !mm.isDead)));
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.off('showManga');
  socket.off('searchInMirrors');
}

onBeforeMount(On);
onBeforeUnmount(Off);
</script>
<template>
  <div class="flex flex-center q-pa-lg">
    <q-banner
      dense
      :class="$q.dark.isActive ? 'bg-grey-9': 'bg-grey-3'"
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
        bordered
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
        <q-resize-observer @resize="(size) => migrateHeader = size.height" />
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
              :style="{ maxHeight: `${$q.screen.height-headerSize}px` }"
            >
              <q-infinite-scroll
                :scroll-target="scrollTargetRef ? scrollTargetRef : undefined"
              >
                <div
                  v-for="(manga, i) in mangasToFix"
                  :key="i"
                  class="q-pa-md q-ma-lg flex flex-center"
                  :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-3'"
                >
                  <entry-fixer
                    :manga="manga"
                    :mirrors="mirrors"
                    :disabled="showCandidates"
                    @search="(p) => search(p.origin, p.mirrors, p.loader)"
                  />
                </div>
              </q-infinite-scroll>
            </div>
          </div>
          <q-dialog
            v-model="showCandidates"
            full-width
          >
            <q-card>
              <q-card-section>
                <span class="text-h6">{{ $t('migration.results') }}</span>
              </q-card-section>
              <q-card-section>
                <q-list
                  bordered
                  separator
                >
                  <q-item
                    v-for="(candidate,i) in candidates"
                    :key="i"
                    class="q-pa-lg"
                  >
                    <q-item-section
                      avatar
                    >
                      <q-img :src="transformIMGurl(candidate.covers[0], settings)" />
                      <migrate-button
                        :disabled="migrating"
                        @migrate="(loader) => migrate(compareSource, candidate, loader)"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-list separator>
                        <q-item>
                          <q-avatar
                            color="primary"
                            text-color="white"
                            icon="menu_book"
                            class="q-mr-md"
                          />
                          <q-item-section>
                            <q-item-label>{{ $t('mangas.title') }}</q-item-label>
                            <q-item-label
                              v-if="candidate.name.toLocaleLowerCase() === compareSource.name.toLocaleLowerCase()"
                              caption
                            >
                              <span class="text-positive">{{ candidate.name }}</span>
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.name.toLocaleLowerCase() !== compareSource.name.toLocaleLowerCase()"
                              caption
                            >
                              <span class="text-green">{{ $t('migrate.new') }}:</span> {{ candidate.name }}
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.name.toLocaleLowerCase() !== compareSource.name.toLocaleLowerCase()"
                              caption
                            >
                              <span class="text-negative">{{ $t('migrate.old') }}:</span> {{ compareSource.name }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                        <q-item>
                          <q-avatar
                            color="primary"
                            text-color="white"
                            icon="cloud"
                            class="q-mr-md"
                          />
                          <q-item-section>
                            <q-item-label>{{ $t('mangas.source') }}</q-item-label>
                            <q-item-label
                              v-if="candidate.mirror.name === compareSource.mirror"
                              caption
                            >
                              <span class="text-positive">{{ candidate.mirror.name }}</span>
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.mirror.name !== compareSource.mirror"
                              caption
                            >
                              <span class="text-green">{{ $t('migrate.new') }}:</span> {{ candidate.mirror.name }}
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.mirror.name !== compareSource.mirror"
                              caption
                            >
                              <span class="text-negative">{{ $t('migrate.old') }}:</span> {{ compareSource.mirror }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                        <q-item>
                          <q-avatar
                            color="primary"
                            text-color="white"
                            icon="translate"
                            class="q-mr-md"
                          />
                          <q-item-section>
                            <q-item-label>{{ $t('languages.language', candidate.langs.length) }}</q-item-label>
                            <q-item-label caption>
                              <span
                                v-if="candidate.langs.sort().join('') === compareSource.langs.sort().join('')"
                                class="text-green"
                              >
                                <q-chip
                                  v-for="(currLang, il) in candidate.langs.map(l => $t(`languages.${l}`)).sort()"
                                  :key="il"
                                  :removable="candidate.langs.length > 1 ? true : false"
                                  dense
                                  :color="compareSource.langs.includes(candidate.langs[il]) ? 'positive' : $q.dark.isActive ? 'grey-9' : 'grey-3'"
                                  @remove="removeLangFromCandidate(candidate, candidate.langs[il])"
                                >
                                  {{ currLang }}
                                </q-chip>
                              </span>
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.langs.sort().join('') !== compareSource.langs.sort().join('')"
                              caption
                            >
                              <span class="text-green">{{ $t('migrate.new') }}: </span>

                              <q-chip
                                v-for="(currLang, il) in candidate.langs.map(l => $t(`languages.${l}`)).sort()"
                                :key="il"
                                :removable="candidate.langs.length > 1 ? true : false"
                                dense
                                :color="compareSource.langs.includes(candidate.langs[il]) ? 'positive' : $q.dark.isActive ? 'grey-9' : 'grey-3'"
                                @remove="removeLangFromCandidate(candidate, candidate.langs[il])"
                              >
                                {{ currLang }}
                              </q-chip>
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.langs.sort().join('') !== compareSource.langs.sort().join('')"
                              caption
                            >
                              <span class="text-negative">{{ $t('migrate.old') }}: </span>
                              <span
                                v-for="(currLang, il) in compareSource.langs.map(l => $t(`languages.${l}`)).sort()"
                                :key="il"
                              >
                                {{ currLang }}{{ il < compareSource.langs.length-1 ? ', ': '' }}
                              </span>
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                        <q-item>
                          <q-avatar
                            color="primary"
                            text-color="white"
                            icon="collections"
                            class="q-mr-md"
                          />
                          <q-item-section>
                            <q-item-label>{{ $t('mangas.chapter', 10) }}</q-item-label>
                            <q-item-label
                              v-if="candidate.chapters.length === compareSource.chapters.length"
                              caption
                            >
                              <span class="text-green">{{ candidate.chapters.length }}</span>
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.chapters.length !== compareSource.chapters.length"
                              caption
                            >
                              <span class="text-green">{{ $t('migrate.new') }}: </span>
                              {{ candidate.chapters.length }}
                            </q-item-label>
                            <q-item-label
                              v-if="candidate.chapters.length !== compareSource.chapters.length"
                              caption
                            >
                              <span class="text-negative">{{ $t('migrate.old') }}: </span>
                              {{ compareSource.chapters.length }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </q-dialog>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>
<style lang="css" scoped>
.q-item__section--avatar {
  min-width: 200px!important;
}
</style>
