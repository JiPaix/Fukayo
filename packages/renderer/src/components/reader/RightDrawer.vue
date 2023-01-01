<script lang="ts" setup>
import type { MangaInDB, MangaPage } from '@api/models/types/manga';
import { useQuasar } from 'quasar';
import { computed, ref, watch } from 'vue';

/** props */
const props = defineProps<{
  chapters: (MangaPage['chapters'][0]|MangaInDB['chapters'][0])[]
  currentChapterId: string
  inLibrary: boolean
  readerSettings: MangaInDB['meta']['options']
  headerSize: number
}>();

/** emits */
const emit = defineEmits<{
  (event: 'loadIndex', index: number): void
  (event: 'toggleInLibrary'): void
  (event: 'toggleRead', index:number): void
  (event: 'updateSettings', newSettings:MangaInDB['meta']['options'], oldSettings:MangaInDB['meta']['options']): void
}>();

/** quasar */
const $q = useQuasar();

/** returns the current chapter index */
const currentChapterIndex = computed(() => {
  return props.chapters.findIndex(chapter => chapter.id === props.currentChapterId);
});

/** format labels for QSelect */
function chapterLabel(number:number, name?:string) {
  if(name) return `${number} - ${name}`;
  return number;
}

/** label of the selected chapter in QSelect */
const selectedChap = ref({label: chapterLabel(props.chapters[currentChapterIndex.value].number, props.chapters[currentChapterIndex.value].name), value: currentChapterIndex.value });

/** update the label when currentChapterId changes */
watch(() => props.currentChapterId, () => {
    selectedChap.value = {label: chapterLabel(props.chapters[currentChapterIndex.value].number, props.chapters[currentChapterIndex.value].name), value: currentChapterIndex.value };
});

/** label of the first chapter */
const firstChapterLabel = computed(() => {
  if(currentChapterIndex.value === 0) return null;
  return {
    label: chapterLabel(props.chapters[0].number, props.chapters[0].name),
    value: props.chapters.length - 1,
  };
});

/** label of the previous chapter */
const nextChapterLabel = computed(() => {
  if(currentChapterIndex.value + 1 < props.chapters.length) {
    return {
      label: chapterLabel(props.chapters[currentChapterIndex.value + 1].number, props.chapters[currentChapterIndex.value + 1].name),
      value: currentChapterIndex.value + 1,
    };
  }
  return null;
});

/** label of the next chapter */
const previousChapterLabel = computed(() => {
  if(currentChapterIndex.value - 1 >= 0) {
    return {
      label: chapterLabel(props.chapters[currentChapterIndex.value - 1].number, props.chapters[currentChapterIndex.value - 1].name),
      value: currentChapterIndex.value - 1,
    };
  }
  return null;
});

/** label of the last chapter */
const lastChapterLabel = computed(() => {
  if(currentChapterIndex.value === props.chapters.length - 1) return null;
  return {
    label: chapterLabel(props.chapters[props.chapters.length - 1].number, props.chapters[props.chapters.length - 1].name),
    value: 0,
  };
});

/** shorthand for `emit('loadIndex', chapter_index)` */
function goToChapter(label: { label: string | number, value: number } ) {
  emit('loadIndex', label.value);
}
/** shorthand for `emit('loadIndex', first_chapter_index)` */
function goFirstChapter() {
  if(!firstChapterLabel.value) return;
  selectedChap.value = firstChapterLabel.value;
  emit('loadIndex', firstChapterLabel.value.value);
}
/** shorthand for `emit('loadIndex', previous_chapter_index)` */
function goPrevChapter() {
  if(!previousChapterLabel.value) return;
  selectedChap.value = previousChapterLabel.value;
  emit('loadIndex', previousChapterLabel.value.value);
}
/** shorthand for `emit('loadIndex', next_chapter_index)` */
function goNextChapter() {
  if(!nextChapterLabel.value) return;
  selectedChap.value = nextChapterLabel.value;
  emit('loadIndex', nextChapterLabel.value.value);
}
/** shorthand for `emit('loadIndex', last_chapter_index)` */
function goLastChapter() {
  if(!lastChapterLabel.value) return;
  selectedChap.value = lastChapterLabel.value;
  emit('loadIndex', lastChapterLabel.value.value);
}

async function toggleInLibrary() {
  emit('toggleInLibrary');
}

async function toggleRead() {
  emit('toggleRead', currentChapterIndex.value);
}

/** ref-ing the readerSettings props */
const localSettings = ref<MangaInDB['meta']['options']>({
  webtoon: props.readerSettings.webtoon,
  showPageNumber: props.readerSettings.showPageNumber,
  zoomMode: props.readerSettings.zoomMode,
  longStrip: props.readerSettings.longStrip,
  longStripDirection: props.readerSettings.longStripDirection,
  book: props.readerSettings.book,
  bookOffset: props.readerSettings.bookOffset,
  rtl: props.readerSettings.rtl,
  overlay: props.readerSettings.overlay,
});


/** make sure options are compatible with each others */
async function checkSettingsCompatibilty(key: keyof typeof localSettings.value) {

  if(key === 'book' && localSettings.value.book) {
    if(localSettings.value.zoomMode === 'stretch-height' && localSettings.value.longStripDirection === 'vertical') localSettings.value.zoomMode = 'auto';
    if(localSettings.value.webtoon) localSettings.value.webtoon = false;
    if( (!localSettings.value.longStrip && localSettings.value.book) || (localSettings.value.longStrip && localSettings.value.longStripDirection === 'vertical')) {
      if(localSettings.value.zoomMode === 'stretch-height') localSettings.value.zoomMode = 'auto';
    }
  }

  if(key === 'longStrip' && !localSettings.value.longStrip) {
    localSettings.value.webtoon = false;
  }

  if(key === 'webtoon' && localSettings.value.webtoon) {
    if(localSettings.value.zoomMode === 'stretch-height') localSettings.value.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && localSettings.value.longStripDirection === 'vertical') {
    if(localSettings.value.book && localSettings.value.zoomMode === 'stretch-height') localSettings.value.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && localSettings.value.longStripDirection === 'horizontal') {
    if(localSettings.value.zoomMode === 'stretch-width') localSettings.value.zoomMode = 'auto';
  }

}

watch(() => localSettings.value, (nval, oval) => {
  emit('updateSettings', nval, oval);
}, { deep: true });

</script>

<template>
  <div
    class="q-pa-lg"
  >
    <q-select
      v-model="selectedChap"
      hide-bottom-space
      item-aligned
      popup-content-style="width: 300px"
      :options="chapters.map((chapter, index) => ({
        label: chapterLabel(chapter.number, chapter.name),
        value: index,
        read: chapter.read,
      })).sort((a, b) => a.value - b.value)"
      color="orange"
      :dark="$q.dark.isActive"
      @update:model-value="goToChapter"
    >
      <template #selected-item>
        <div class="ellipsis">
          {{ selectedChap.label }}
        </div>
      </template>
      <template #option="scope">
        <q-item
          v-bind="scope.itemProps"
          :dark="$q.dark.isActive"
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
    <div class="flex flex-center">
      <q-btn-group>
        <q-btn
          :text-color="firstChapterLabel ? undefined : 'negative'"
          :disable="!firstChapterLabel"
          @click="goFirstChapter"
        >
          <q-icon name="first_page" />
          <q-tooltip v-if="firstChapterLabel">
            <span>{{ $t('reader.first') }}</span>
            <br>
            <span>{{ firstChapterLabel.label }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :text-color="previousChapterLabel ? undefined : 'negative'"
          :disable="!previousChapterLabel"
          @click="goPrevChapter"
        >
          <q-icon name="navigate_before" />
          <q-tooltip v-if="previousChapterLabel">
            <span>{{ $t('reader.previous') }}</span>
            <br>
            <span>{{ previousChapterLabel.label }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :text-color="nextChapterLabel ? undefined : 'negative'"
          :disable="!nextChapterLabel"
          @click="goNextChapter"
        >
          <q-icon name="navigate_next" />
          <q-tooltip v-if="nextChapterLabel">
            <span>{{ $t('reader.next') }}</span>
            <br>
            <span>{{ nextChapterLabel.label }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :text-color="lastChapterLabel ? undefined : 'negative'"
          :disable="!lastChapterLabel"
          @click="goLastChapter"
        >
          <q-icon name="last_page" />
          <q-tooltip v-if="lastChapterLabel">
            <span>{{ $t('reader.last') }}</span>
            <br>
            <span>{{ lastChapterLabel.label }}</span>
          </q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
    <div class="flex flex-center q-mt-lg">
      <q-btn-group>
        <q-btn
          :text-color="inLibrary ? 'red' : ''"
          @click="toggleInLibrary"
        >
          <q-icon :name="inLibrary ? 'o_delete' : 'o_favorite'" />
          <q-tooltip>
            <span>{{ inLibrary ? $t('reader.manga.remove') : $t('reader.manga.add') }}</span>
          </q-tooltip>
        </q-btn>
        <q-btn
          :text-color="chapters[currentChapterIndex].read ? 'orange' : ''"
          @click="toggleRead"
        >
          <q-icon :name="chapters[currentChapterIndex].read ? 'o_visibility_off' : 'o_visibility'" />
          <q-tooltip>
            <span>{{ chapters[currentChapterIndex].read ? $t('mangas.markasread.current_unread') : $t('mangas.markasread.current') }}</span>
          </q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
    <div class="q-mt-lg flex">
      <div class="w-100 flex flex-center justify-around q-mb-xs q-mt-lg">
        <q-slide-transition>
          <q-btn-group>
            <q-btn
              :color="!localSettings.longStrip ? 'orange':''"
              class="q-ml-auto"
              icon="photo"
              dense
              @click="localSettings.longStrip = false;checkSettingsCompatibilty('longStrip')"
            >
              <q-tooltip>{{ $t('reader.singlePage') }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="localSettings.longStripDirection === 'vertical' && localSettings.longStrip ? 'orange':''"
              class="q-ml-auto"
              icon="swap_vert"
              dense
              @click="localSettings.longStrip = true;localSettings.longStripDirection = 'vertical';checkSettingsCompatibilty('longStripDirection');"
            >
              <q-tooltip>{{ $t('reader.vertical') }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="localSettings.longStripDirection === 'horizontal' && localSettings.longStrip ? 'orange':''"
              icon="swap_horiz"
              dense
              @click="localSettings.longStrip = true;localSettings.longStripDirection = 'horizontal';checkSettingsCompatibilty('longStripDirection');"
            >
              <q-tooltip>{{ $t('reader.horizontal') }}</q-tooltip>
            </q-btn>
          </q-btn-group>
        </q-slide-transition>
        <q-slide-transition>
          <q-btn-group>
            <q-btn
              :color="localSettings.rtl ? '':'orange'"
              dense
              icon="format_textdirection_l_to_r"
              @click="localSettings.rtl = false;checkSettingsCompatibilty('rtl')"
            >
              <q-tooltip>{{ $t('reader.ltr') }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="localSettings.rtl ? 'orange':''"
              dense
              icon="format_textdirection_r_to_l"
              @click="localSettings.rtl = true"
            >
              <q-tooltip>{{ $t('reader.rtl') }}</q-tooltip>
            </q-btn>
          </q-btn-group>
        </q-slide-transition>
      </div>
      <div class="w-100 flex flex-center justify-around q-mt-sm q-mb-xs">
        <q-slide-transition>
          <q-btn-group>
            <q-btn
              :color="localSettings.book && !localSettings.bookOffset ? 'orange':''"
              dense
              icon="menu_book"
              @click="localSettings.book = true;localSettings.bookOffset = false;checkSettingsCompatibilty('book');"
            >
              <q-tooltip>{{ $t('reader.book_mode') }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="localSettings.book && localSettings.bookOffset ? 'orange':''"
              dense
              icon="auto_stories"
              @click="localSettings.book = true;localSettings.bookOffset = true;checkSettingsCompatibilty('book');"
            >
              <q-tooltip>{{ $t('reader.book_mode_offset') }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="!localSettings.book && !localSettings.bookOffset ? 'orange':''"
              dense
              icon="not_interested"
              @click="localSettings.book = false;localSettings.bookOffset = false;checkSettingsCompatibilty('book');"
            >
              <q-tooltip>{{ $t('reader.book_mode_off') }}</q-tooltip>
            </q-btn>
          </q-btn-group>
        </q-slide-transition>
      </div>
      <q-toggle
        v-model="localSettings.webtoon"
        :disable="localSettings.book || !localSettings.longStrip"
        :color="localSettings.book || !localSettings.longStrip ? 'negative' : 'orange'"
        :keep-color="localSettings.book || !localSettings.longStrip"
        :label="$t('reader.webtoon')"
        :dark="$q.dark.isActive"
        @update:model-value="checkSettingsCompatibilty('webtoon');"
      />
      <q-toggle
        v-model="localSettings.showPageNumber"
        :label="$t('reader.showpagenumber')"
        color="orange"
        :dark="$q.dark.isActive"
      />
      <q-toggle
        v-if="!$q.platform.has.touch"
        v-model="localSettings.overlay"
        :label="$t('settings.reader.overlay')"
        color="orange"
        :dark="$q.dark.isActive"
      />
      <div class="w-100 flex flex-center justify-around q-mt-sm q-mb-xs">
        <q-slide-transition>
          <q-btn-group>
            <q-btn
              icon="width_wide"
              :color="localSettings.zoomMode === 'auto' ? 'orange' : undefined"
              @click="localSettings.zoomMode = 'auto';checkSettingsCompatibilty('zoomMode');"
            >
              <q-tooltip>
                {{ $t('reader.displaymode.auto') }}
              </q-tooltip>
            </q-btn>
            <q-btn
              icon="fit_screen"
              :text-color="localSettings.longStrip && localSettings.longStripDirection === 'horizontal' ? 'negative' : undefined"
              :disable="localSettings.longStrip && localSettings.longStripDirection === 'horizontal'"
              :color="localSettings.zoomMode === 'stretch-width' ? 'orange' : undefined"
              @click="localSettings.zoomMode = 'stretch-width';checkSettingsCompatibilty('zoomMode');"
            >
              <q-tooltip>
                {{ $t('reader.displaymode.stretch-width') }}
              </q-tooltip>
            </q-btn>

            <q-btn
              icon="height"
              :text-color="localSettings.webtoon || (localSettings.book && localSettings.longStripDirection !== 'horizontal') ? 'negative' : undefined"
              :color="localSettings.zoomMode === 'stretch-height' ? 'orange' : undefined"
              :disable="localSettings.webtoon || (localSettings.book && localSettings.longStripDirection !== 'horizontal')"
              @click="localSettings.zoomMode = 'stretch-height';checkSettingsCompatibilty('zoomMode');"
            >
              <q-tooltip>
                {{ $t('reader.displaymode.stretch-height') }} ({{ $t('reader.displaymode.compatibility') }})
              </q-tooltip>
            </q-btn>
          </q-btn-group>
        </q-slide-transition>
      </div>
    </div>
  </div>
</template>
