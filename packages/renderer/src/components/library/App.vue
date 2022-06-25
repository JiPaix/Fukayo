<script lang="ts" setup>
import { useQuasar } from 'quasar';
import type { Ref } from 'vue';
import { onBeforeUnmount, onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { socketClientInstance } from '../../../../api/src/client/types';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';
import { useStore as useSettingsStore } from '../../store/settings';
import { useSocket } from '../helpers/socket';
import { chapterLabel } from '../reader/helpers';

/** quasar */
const $q = useQuasar();
/** router */
const router = useRouter();
/** web socket */
let socket: socketClientInstance | undefined;
/** settings */
const settings = useSettingsStore();
/** mangas in db */
const mangasRAW = ref<MangaGroup[]>([]);
/** mirrors */
const mirrors = ref<mirrorInfo[]>([]);
/**
 * mangas parsed
 */

const mangas = computed(() => {
  return mangasRAW.value;
});

const divSizes = computed(() => {
  if($q.screen.xs) {
    return {
      card: 'col-12',
      carousel: 'col-12',
      carouselH: 'min-height:60vh;',
      infos: 'col-12 text-center  ',
      title: 'text-center text-h3',
      mirrorSize: 'lg',
      selectdense: false,
      select: 'col-12',
    };
  }
  if($q.screen.sm) {
    return {
      card: 'col-12',
      carousel: 'col-5',
      carouselH: 'min-height:60vh;',
      infos: 'col-7 text-center',
      title: 'text-center text-h3 q-mb-lg',
      mirrorSize: 'lg',
      selectdense: false,
      select: 'absolute-bottom-right q-px-lg col-7',
    };
  }
  if($q.screen.md) {
    return {
      card: 'col-12',
      carousel: 'col-2',
      carouselH: 'min-height:300px;',
      infos: 'col-10',
      title: 'text-center text-h3 q-mb-lg',
      mirrorSize: 'md',
      selectdense: false,
      select: 'absolute-bottom-right q-px-lg col-10',
    };
  }
  return {
      card: 'col-6',
      carousel: 'col-2',
      carouselH: 'min-height:150px;',
      infos: 'col-10',
      title: 'text-center text-h5 q-mb-lg',
      mirrorSize: 'md',
      selectdense: true,
      select: 'col-11',
    };
});

type MangaInDBwithLabel = {
  mirror: string,
  lang:string,
  name: string,
  displayName?: string,
  url: string,
  unread: number,
  read:number,
  expanded: boolean,
  lastchapter: {label: string|number, value:number},
  chapters: {
    label: string | number;
    value: number;
    read:boolean
  }[]
};

type MangaGroup = {
  name: string;
  mangas: MangaInDBwithLabel[];
  covers: string[];
  slide: Ref<number>
  expansion: {value: MangaInDBwithLabel, slot:string }
};

function showManga(mangaInfo:{ mirror: string, url:string, lang:string, chapterindex?: number}) {
  console.log('show manga', mangaInfo);
  router.push({
            name: 'manga',
            params: {
              mirror: mangaInfo.mirror,
              url:mangaInfo.url,
              lang: mangaInfo.lang,
              chapterindex: mangaInfo.chapterindex,
            },
          });
}

function getMirror(mirror:string) {
  return mirrors.value.find(m => m.name === mirror);
}

function toggleExpand(group: MangaInDBwithLabel[], manga: MangaInDBwithLabel) {
  const expanded = group.filter(m => m.expanded && m !== manga);
  expanded.forEach(m => {
    if(m !== manga) {
      m.expanded = false;
    }
  });

  setTimeout(() => {
    manga.expanded = !manga.expanded;
  }, expanded.length ? 200 : 0);

}

onMounted(async () => {
  if (!socket) socket = await useSocket(settings.server);
  const id = Date.now();
  socket.emit('getMirrors', true, async (m) => {
    mirrors.value = m;
    if (!socket) socket = await useSocket(settings.server);

    socket.on('showLibrary', (resid, manga) => {
      if(resid === id) {
        const mirrorInfo = m.find(mirror => mirror.name === manga.mirror);
        if(mirrorInfo) {
          // find the manga the highest number of read chapter
          manga.chapters = manga.chapters.sort((a, b) => b.number - a.number);

          const maxChapter = manga.chapters.reduce((max, chapter) => chapter.read ? Math.max(max, chapter.number) : max, 0);
          // find the index of the highest read chapter
          let chapterIndex = manga.chapters.findIndex(chapter => chapter.number === maxChapter);
          if(chapterIndex === -1) chapterIndex = manga.chapters.length-1;
          const group = mangasRAW.value.find(group => group.name === manga.displayName || group.name === manga.name);
          const mg:Omit<MangaInDBwithLabel, 'expanded'>  = {
            name: manga.name,
            displayName: manga.displayName,
            mirror: mirrorInfo.name,
            url: manga.url,
            unread: manga.chapters.filter(c => !c.read).length,
            read: manga.chapters.filter(c => c.read).length,
            lastchapter: ref({ label: chapterLabel(manga.chapters[chapterIndex].number, manga.chapters[chapterIndex].name), value: chapterIndex }) as unknown as {label: string|number, value:number},
            chapters: manga.chapters.map((c, i) => {
              return {
                label: chapterLabel(c.number, c.name),
                value: i,
                read: c.read,
              };
            }),
            lang: manga.lang,
          };

          if(!group) {
            (mg as MangaInDBwithLabel).expanded = ref(true) as unknown as boolean,
            mangasRAW.value.push({
              name: manga.displayName || manga.name,
              mangas: [mg as MangaInDBwithLabel],
              covers: manga.covers,
              slide: ref(0) as unknown as number,
              expansion: ref({slot: manga.name+manga.lang+manga.mirror, value: manga}) as unknown as {value: MangaInDBwithLabel, slot:string },
            });
          } else {
            (mg as MangaInDBwithLabel).expanded = ref(false) as unknown as boolean,
            group.mangas.push(mg as MangaInDBwithLabel);
            // add mg covers to group covers
            group.covers = [...new Set([...group.covers, ...manga.covers])];
          }
        }
      }
    });
    socket.emit('showLibrary', id);
  });
});

onBeforeUnmount(() => {
  socket?.off('showLibrary');
  socket?.emit('stopShowLibrary');
});
function shout() {
  console.log(mangasRAW.value);
}
</script>

<template>
  <div
    class="w-100 q-pa-lg"
    :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
    :dark="$q.dark.isActive"
  >
    <q-card-section
      class="text-center"
    >
      <h2>mangalist (wip)</h2>
      <q-btn
        size="lg"
        @click="shout"
      >
        DEBUG
      </q-btn>
    </q-card-section>
  </div>
  <q-infinite-scroll
    :offset="500"
    class="w-100 q-pa-lg"
  >
    <div class="row">
      <div
        v-for="(group, i) in mangas"
        :key="i"
        :class="divSizes.card"
      >
        <q-card class="q-ma-lg">
          <div class="row">
            <q-carousel
              v-model="group.slide"
              animated
              autoplay
              infinite
              class="cursor-pointer"
              :class="divSizes.carousel"
              style="overflow:hidden;"
              :style="divSizes.carouselH"
            >
              <q-carousel-slide
                v-for="(covers, ic) in group.covers"
                :key="ic"
                :name="ic"
                :img-src="covers"
                style="background-position: 50% 0%;overflow:hidden;"
              />
            </q-carousel>
            <div :class="divSizes.infos">
              <div class="row q-mx-md">
                <span
                  class="ellipsis col-12"
                  :class="divSizes.title"
                >
                  {{ group.name }}
                  <q-tooltip
                    anchor="top middle"
                    self="bottom left"
                    :offset="[10, 10]"
                  >
                    {{ group.name }}
                  </q-tooltip>
                </span>
              </div>
              <div
                class="row q-mx-md q-mb-sm"
              >
                <div
                  class="col-12"
                >
                  <q-btn
                    v-for="(manga, im) in group.mangas.sort((a, b) => a.lang.localeCompare(b.lang))"
                    :key="im"
                    dense
                    flat
                    :dark="$q.dark.isActive"
                    :size="divSizes.mirrorSize"
                    :text-color="manga.expanded ? 'orange' : $q.dark.isActive ? 'white' : 'dark'"
                    :icon="manga.expanded ? 'expand_less' : 'expand_more'"
                    :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
                    @click="group.mangas.length > 1 ? toggleExpand(group.mangas, manga) : null"
                  >
                    <img
                      :src="getMirror(manga.mirror)?.icon"
                    >
                    <div class="q-mx-sm flex items-center">
                      <span>{{ $t(`languages.${manga.lang}.value`) }}</span>
                      <span
                        v-if="manga.unread > 0"
                        style="font-size:0.6rem"
                        class="text-caption q-ml-sm"
                        :class="$q.dark.isActive ? 'text-info': 'text-primary'"
                      >
                        ({{ manga.read }}/{{ manga.chapters.length }})
                      </span>
                    <!-- percentage of unread chapters -->
                    </div>
                  </q-btn>
                </div>

                <q-slide-transition
                  v-for="(manga, im) in group.mangas"
                  :key="im"
                >
                  <div
                    v-show="manga.expanded"
                    :class="divSizes.select"
                  >
                    <div class="row">
                      <q-select
                        v-model="manga.lastchapter"
                        filled
                        :dense="divSizes.selectdense"
                        hide-bottom-space
                        item-aligned
                        :options="manga.chapters.sort((a, b) => a.value - b.value)"
                        color="orange"
                        class="q-px-none col-12"
                        :dark="$q.dark.isActive"
                        @update:model-value="showManga({ mirror: manga.mirror, url: manga.url, lang: manga.lang, chapterindex: manga.lastchapter.value })"
                      >
                        <template #before>
                          <q-btn
                            icon="pageview"
                            color="orange"
                            dense
                            :size="divSizes.mirrorSize"
                            @click="showManga({ mirror: manga.mirror, url: manga.url, lang: manga.lang })"
                          >
                            <q-tooltip>
                              Show Manga page
                            </q-tooltip>
                          </q-btn>
                        </template>
                        <template #selected-item>
                          <div class="ellipsis">
                            {{ manga.lastchapter.label }}
                          </div>
                        </template>
                        <template #option="scope">
                          <q-item
                            v-bind="scope.itemProps"
                            :dark="$q.dark.isActive"
                            @click="manga.lastchapter.value === scope.opt.value ? showManga({ mirror: manga.mirror, url: manga.url, lang: manga.lang, chapterindex: scope.opt.value }) : null"
                          >
                            <q-item-section>
                              <q-item-label>
                                <div class="ellipsis">
                                  <q-icon
                                    v-if="!scope.opt.read"
                                    left
                                    name="new_releases"
                                    color="positive"
                                  />
                                  <q-icon
                                    v-else
                                    left
                                    name="done"
                                  />
                                  {{ scope.opt.label }}
                                </div>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </template>
                      </q-select>
                    </div>
                  </div>
                </q-slide-transition>
              </div>
            </div>
          </div>
        </q-card>
      </div>
    </div>
  </q-infinite-scroll>
</template>
<style lang="css">
.q-panel.scroll {
  overflow: hidden!important;
}
.q-field--item-aligned .q-field__before {
  min-width: 0px!important;
}
</style>
