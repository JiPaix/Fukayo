<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isChapterPage, isChapterPageErrorMessage } from './helpers/typechecker';
import type { ChapterPage } from '../../../api/src/mirrors/types/chapter';
import type { ChapterPageErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import type { MangaPage } from '../../../api/src/mirrors/types/manga';

/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** emit */
const emit = defineEmits<{
  (event: 'hide'): void
  (event: 'reload', chapterIndex:number, pageIndex:number): void
}>();

/** props */
const props = defineProps<{
  /** the current manga infos */
  manga: MangaPage
  /** manga.chapter index to display on screen */
  chapterSelectedIndex: number
  /** the number of pages expected to receive (1-based) */
  nbOfImagesToExpectFromChapter: number
  /** images sorted by index */
  sortedImages: (ChapterPage | ChapterPageErrorMessage)[]
}>();

/** displays a progress bar while images are loading */
const showProgressBar = ref(true);

/** color of the progress bar, orange = loading, red = has erroneous page */
const progressBarColor = ref<'orange'|'negative'>('orange');

/** hide the progress bar once all images are loaded */
watch(props.sortedImages, (newValue) => {
  if (newValue.length === props.nbOfImagesToExpectFromChapter) {
    setTimeout(() => {
      if(newValue.some(isChapterPageErrorMessage)) {
        progressBarColor.value = 'negative';
      } else {
        showProgressBar.value = false;
      }
    }, 500); // matches q-linear-progress animation-speed
  }
});

/** Array that acts as a buffer for props.sortedImages */
const images = computed(() =>
  Array.from({length: props.nbOfImagesToExpectFromChapter}, (k, v) => v)
    .map((k, v) => props.sortedImages[v] || { index: v }),
);

/** Sates for "reload page" buttons */
const reloaders = ref(Array.from({length: props.nbOfImagesToExpectFromChapter}, () => false));

/** reload page */
function reload(pageIndex: number) {
  reloaders.value[pageIndex] = true;
  emit('reload', props.chapterSelectedIndex, pageIndex);
}

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    class="shadow-2 rounded-borders"
  >
    <q-header
      reveal
      :reveal-offset="10"
      elevated
      class="bg-dark"
    >
      <q-toolbar>
        <q-btn
          flat
          round
          dense
          icon="close"
          class="q-mr-sm"
          @click="emit('hide')"
        />
        <q-avatar v-if="manga.covers">
          <img :src="manga.covers[0]">
        </q-avatar>
        <q-skeleton
          v-else
          type="QAvatar"
        />
        <q-toolbar-title>
          <span class="text-subtitle1">{{ manga.name }}</span>
          <q-tooltip>
            {{ manga.name }}
          </q-tooltip>
        </q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="menu"
          class="q-mx-sm"
        />
      </q-toolbar>
      <q-bar>
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume !== undefined"
          class="text-caption"
        >
          {{ $t('mangas.volume.value') }} {{ manga.chapters[chapterSelectedIndex].volume }}
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume !== undefined && manga.chapters[chapterSelectedIndex].number !== undefined"
          class="text-caption"
        >
          -
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].number !== undefined"
          class="text-caption"
        >
          {{ $t('mangas.chapter.value') }} {{ manga.chapters[chapterSelectedIndex].number }}
        </span>
        <span
          v-if="manga.chapters[chapterSelectedIndex].volume === undefined && manga.chapters[chapterSelectedIndex].number === undefined"
          class="text-caption"
        >
          {{ manga.chapters[chapterSelectedIndex].name }}
        </span>
      </q-bar>
    </q-header>
    <q-footer
      elevated
      class="bg-transparent"
    >
      <q-linear-progress
        v-if="sortedImages.length && showProgressBar"
        :color="progressBarColor"
        :value="sortedImages.length/nbOfImagesToExpectFromChapter"
        animation-speed="500"
      />
    </q-footer>
    <q-page-container>
      <q-page>
        <div
          v-for="img in images"
          :key="img.index"
        >
          <q-img
            :src="img && !isChapterPageErrorMessage(img) && isChapterPage(img) ? (img).src : 'undefined'"
          >
            <template #error>
              <div
                v-if="(img as ChapterPage).src !== undefined"
                class="absolute-full flex flex-center bg-negative text-white"
              >
                <div>
                  <q-btn
                    icon-right="broken_image"
                    :loading="reloaders[img.index]"
                    color="white"
                    text-color="black"
                    @click="reload(img.index)"
                  >
                    {{ $t('showChapter.reload.value') }}
                  </q-btn>
                  <div
                    v-if="isChapterPageErrorMessage(img)"
                    class="text-center"
                  >
                    {{ img.error }}
                  </div>
                </div>
              </div>
              <div
                v-else
                class="absolute-full flex flex-center bg-dark text-white"
              >
                <div class="flex column items-center">
                  <q-spinner-facebook
                    size="10em"
                    color="orange"
                  />
                  <q-chip
                    color="white"
                    text-color="black"
                  >
                    {{ img.index+1 }}/{{ nbOfImagesToExpectFromChapter }}
                  </q-chip>
                </div>
              </div>
            </template>
            <div
              class="absolute-bottom text-subtitle1 text-center"
              style="background:none;"
            >
              <q-chip>
                {{ img.index+1 }}/{{ nbOfImagesToExpectFromChapter }}
              </q-chip>
            </div>
          </q-img>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
