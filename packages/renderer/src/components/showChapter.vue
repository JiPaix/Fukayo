<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isChapterPage, isChapterPageErrorMessage } from './helpers/typechecker';
import { ChapterPage } from '../../../api/src/models/types/chapter';
import type { ChapterPageErrorMessage } from '../../../api/src/models/types/errors';
import type { MangaPage } from '../../../api/src/models/types/manga';



/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** emit */
const emit = defineEmits<{
  (event: 'hide'): void
  (event: 'reload', chapterIndex:number, pageIndex:number): void
  (event: 'navigate', chapterIndex:number): void
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

/** Display the right drawer */
const drawerRight = ref(true);
const drawerRightReveal = ref(false);

/** Select menu: Current chapter */
const selectedChap = ref({label: props.manga.chapters[props.chapterSelectedIndex].name || props.manga.chapters[props.chapterSelectedIndex].number, value: props.chapterSelectedIndex });

/** Select menu: Next Chapter */
const next = computed(() => {
  const chapterIndex = props.chapterSelectedIndex - 1;
  if(chapterIndex < 0) return null;
  return {
    label: props.manga.chapters[chapterIndex].name || props.manga.chapters[chapterIndex].number,
    value: chapterIndex,
  };
});

/** Select menu: Previous Chapter */
const previous = computed(() => {
  const chapterIndex = props.chapterSelectedIndex + 1;
  if(chapterIndex >= props.manga.chapters.length) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});

const last = computed(() => {
  const chapterIndex = 0;
  if(!next.value) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});

const first = computed(() => {
  const chapterIndex = props.manga.chapters.length - 1;
  if(!previous.value || chapterIndex < 0) return null;
  return {
    label: chapterLabel(props.manga.chapters[chapterIndex].number, props.manga.chapters[chapterIndex].name),
    value: chapterIndex,
  };
});


/** displays a progress bar while images are loading */
const showProgressBar = computed(() => {
  return props.sortedImages.length < props.nbOfImagesToExpectFromChapter;
});

/** color of the progress bar, orange = loading, red = has erroneous page */
const progressBarColor = computed(() => {
  if(props.sortedImages.length === props.nbOfImagesToExpectFromChapter) {
    if(props.sortedImages.some(isChapterPageErrorMessage)) {
      return 'negative';
    }
  }
  return 'orange';
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

function navigate(label: {label: string|number, value: number}) {
  selectedChap.value = label;
  emit('navigate', label.value);
}

/** Select Menu label */
function chapterLabel(number:number, name?:string) {
  if(name) return name;
  return number;
}

</script>
<template>
  <q-layout
    view="lHh lpR lFf"
    container
    class="shadow-2 rounded-borders"
  >
    <q-header
      elevated
      class="bg-dark"
      reveal
      @reveal="drawerRightReveal = !drawerRightReveal"
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
          <span class="text-subtitle1">{{ manga.displayName || manga.name }}</span>
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
          @click="drawerRight = !drawerRight"
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
    <q-footer>
      <q-linear-progress
        v-if="showProgressBar"
        class="absolute absolute-bottom"
        style="margin-left: 0"
        size="4px"
        :color="progressBarColor"
        :value="sortedImages.length/nbOfImagesToExpectFromChapter"
        animation-speed="500"
      />
    </q-footer>
    <q-drawer
      v-model="drawerRight"
      side="right"
      :width="300"
      class="bg-grey-9"
    >
      <q-bar
        v-if="drawerRightReveal"
        class="w-100 flex bg-grey-10 items-center justify-between cursor-pointer"
        @click="drawerRight = !drawerRight"
      >
        <span class="ellipsis q-pr-sm"> {{ manga.displayName || manga.name }} </span>
        <q-tooltip>
          {{ manga.name }}
        </q-tooltip>
        <q-icon
          flat
          dense
          name="close"
        />
      </q-bar>
      <q-select
        v-model="selectedChap"
        hide-bottom-space
        item-aligned
        popup-content-style="width: 300px"
        :options="manga.chapters.map((chapter, index) => ({
          label: chapterLabel(chapter.number, chapter.name),
          value: index,
        }))"
        @update:model-value="emit('navigate', $event.value)"
      >
        <template #selected-item>
          <div class="ellipsis">
            {{ selectedChap.label }}
          </div>
        </template>
        <template #option="scope">
          <q-item
            v-bind="scope.itemProps"
          >
            <q-item-section>
              <q-item-label>
                <div class="ellipsis">
                  {{ scope.opt.label }}
                </div>
              </q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
      <div class="flex flex-center">
        <q-btn-group>
          <q-btn
            :disable="!first"
            @click="first ? navigate(first) : null"
          >
            <q-icon name="first_page" />
            <q-tooltip v-if="first">
              <span>{{ $t('reader.first.value') }}</span>
              <br>
              <span>{{ first.label }}</span>
            </q-tooltip>
          </q-btn>
          <q-btn
            :disable="!previous"
            @click="previous ? navigate(previous): null"
          >
            <q-icon name="navigate_before" />
            <q-tooltip v-if="previous">
              <span>{{ $t('reader.previous.value') }}</span>
              <br>
              <span>{{ previous.label }}</span>
            </q-tooltip>
          </q-btn>
          <q-btn
            :disable="!next"
            @click="next ? navigate(next): null"
          >
            <q-icon name="navigate_next" />
            <q-tooltip v-if="next">
              <span>{{ $t('reader.next.value') }}</span>
              <br>
              <span>{{ next.label }}</span>
            </q-tooltip>
          </q-btn>

          <q-btn
            :disable="!last"
            @click="last ? navigate(last) : null"
          >
            <q-icon name="last_page" />
            <q-tooltip v-if="last">
              <span>{{ $t('reader.last.value') }}</span>
              <br>
              <span>{{ last.label }}</span>
            </q-tooltip>
          </q-btn>
        </q-btn-group>
      </div>
    </q-drawer>
    <q-page-container>
      <q-page>
        <div
          v-for="(img, i) in images"
          :key="i"
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
                    {{ $t('reader.reload.value') }}
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
