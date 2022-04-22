<script lang="ts" setup>
import { onBeforeMount, onMounted, onBeforeUnmount,ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { sock } from '../socketClient';
import type { MangaPage } from '../../../api/src/mirrors/types/manga';
import type { MangaErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import type dayjs from 'dayjs';
import { inject } from 'vue'; // import inject from vue
const dayJS = inject<typeof dayjs>('dayJS'); // inject dayJS

const $t = useI18n().t.bind(useI18n());

const emit = defineEmits<{
  (event: 'hide'): void
}>();

onBeforeUnmount(() => {
  emit('hide');
});

const props = defineProps<{
  socket: sock
  manga: MangaPage & {
    chapters?: MangaPage['chapters']
  }
}>();

const refs = ref<MangaPage & {
  chapters?: MangaPage['chapters']
}>({...props.manga});

const manga = computed<MangaPage & {
  chapters?: MangaPage['chapters']
}>(() => {
  const chapters = refs.value.chapters;
  const sorted = chapters.sort((a, b) => b.number - a.number);
  return {
    id: refs.value.id,
    mirrorInfo: refs.value.mirrorInfo,
    url:refs.value.url,
    lang:refs.value.lang,
    name: refs.value.name,
    covers: refs.value.covers,
    synopsis: refs.value.synopsis,
    tags: refs.value.tags,
    chapters: sorted,
  };

});

// getting cover current size on screen for virtual scroller
const cover = ref<HTMLImageElement | null>(null);
const coverHeight = ref<number>();
function onResize(o:{height:number, width:number}) {
  coverHeight.value = o.height;
}

function isManga(res: MangaPage | MangaErrorMessage): res is MangaPage {
  return (res as MangaPage).name !== undefined;
}

onBeforeMount(() => {
  const reqId = Date.now();
  props.socket.emit('showManga', reqId, props.manga.mirrorInfo.name, props.manga.lang ,props.manga.url);
  props.socket.on('showManga', (id, mg) => {
    if(id === reqId && isManga(mg)) {
      refs.value = {...mg};
    }
  });
});

onMounted(() => {
  // getting cover initial size on screen for virtual scroller
  coverHeight.value = cover.value?.height;
  window.scrollTo(0,0);
});

</script>
<template>
  <q-card>
    <q-card-section
      class="text-center"
    >
      <div>
        <span
          class="text-h3"
        >
          {{ manga.name }}
        </span>
      </div>
      <div v-if="manga.tags">
        <q-chip
          v-for="(tag, i) in manga.tags"
          :key="i"
          color="orange"
        >
          {{ tag }}
        </q-chip>
      </div>
      <div
        v-else
        class="flex justify-center"
      >
        <q-skeleton
          v-for="i in 3"
          :key="i"
          type="QChip"
        />
      </div>
      <div class="flex items-center">
        <span class="q-mr-sm">SOURCE: </span>
        <span class="text-weight-medium">{{ manga.mirrorInfo.displayName }}</span>
        <img
          :src="manga.mirrorInfo.icon"
          :alt="manga.mirrorInfo.displayName"
          class="q-ml-sm"
        >
      </div>
      <div class="flex items-center">
        Language:
        <span class="text-weight-medium q-ml-sm">{{ $t('languages.'+props.manga.lang+'.value') }}</span>
        <span
          class="fi q-ml-sm"
          :class="'fi-'+$t('languages.'+props.manga.lang+'.flag')"
        />
      </div>
    </q-card-section>
    <q-card-section>
      <div v-if="manga.synopsis">
        {{ manga.synopsis }}
      </div>
      <q-skeleton
        v-else
        type="text"
        class="w-100 q-px-xl q-py-lg"
        style="height:180px"
      />
    </q-card-section>

    <div class="row">
      <q-card-section class="col-xs-12 col-sm-5 col-md-4 col-lg-2">
        <div>
          <img
            v-if="manga.covers && manga.covers.length > 0"
            ref="cover"
            class="rounded-borders w-100"
            :src="manga.covers[0]"
          >
          <q-skeleton
            v-else
            height="400px"
          />
          <q-resize-observer @resize="onResize" />
        </div>
      </q-card-section>
      <q-card-section class="col-lg-10 col-sm-7 col-md-8 col-xs-12">
        <q-virtual-scroll
          v-if="manga.chapters"
          :style="'height: '+coverHeight+'px'"
          :items="manga.chapters"
          separator
        >
          <template #default="{ item, index }">
            <q-item
              :key="index"
              v-ripple
              clickable
            >
              <q-item-section>
                <q-item-label>
                  <span v-if="item.volume !== undefined">{{ $t('mangas.volume.value') }} {{ item.volume }}</span>
                  <span v-if="item.volume !== undefined && item.number !== undefined"> - </span>
                  <span v-if="item.number !== undefined">{{ $t('mangas.chapter.value') }} {{ item.number }}</span>
                  <span v-if="item.volume === undefined && item.number === undefined">{{ item.name }}</span>
                </q-item-label>
                <q-item-label
                  v-if="item.number !== undefined"
                  caption
                >
                  {{ item.name }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
                top
              >
                <q-item-label caption>
                  {{ dayJS ? dayJS(item.date).fromNow() : item.date }}
                </q-item-label>
                <q-icon
                  name="visibility"
                  color="yellow"
                />
              </q-item-section>
            </q-item>
          </template>
        </q-virtual-scroll>
        <q-skeleton
          v-for="i in 20"
          v-else
          :key="i"
          type="text"
          :height="(coverHeight||0)/20+'px'"
          class="q-pa-sm"
        />
      </q-card-section>
    </div>
  </q-card>
</template>
