<script lang="ts" setup>
import { isChapterPageErrorMessage } from './helpers/typechecker';
import type { ChapterPage } from '../../../api/src/mirrors/types/chapter';
import type { ChapterPageErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import type { MangaPage } from '../../../api/src/mirrors/types/manga';

/** emit */
const emit = defineEmits<{ (event: 'hide'): void }>();

/** props */
defineProps<{
  /** the current manga infos */
  manga: MangaPage
  /** manga.chapter index to display on screen */
  chapterSelectedIndex: number
  /** the number of pages expected to receive */
  nbOfImagesToExpectFromChapter: number
  /** images sorted by index */
  sortedImages: (ChapterPage | ChapterPageErrorMessage)[]
}>();
</script>
<template>
  <q-layout
    view="hHh Lpr lff"
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

    <q-page-container>
      <q-page>
        <div
          v-for="n in nbOfImagesToExpectFromChapter"
          :key="n"
        >
          <div v-if="sortedImages[n]">
            <q-img
              v-if="!isChapterPageErrorMessage(sortedImages[n])"
              :src="(sortedImages[n] as ChapterPage).src"
            >
              <div
                class="absolute-bottom text-subtitle1 text-center"
                style="background:none;"
              >
                <q-chip>
                  {{ n }}/{{ nbOfImagesToExpectFromChapter }}
                </q-chip>
              </div>
            </q-img>
            <q-skeleton
              v-else
              height="600px"
            />
          </div>
          <div v-else>
            <q-skeleton height="600px" />
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
