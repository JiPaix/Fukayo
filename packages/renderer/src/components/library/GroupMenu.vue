<script lang="ts" setup>
import { useQuasar } from 'quasar';
import type { MangaInDBwithLabel } from './@types';
import type { mirrorInfo } from '../../../../api/src/models/types/shared';

const props = defineProps<{
  width: string,
  sortedGroup: MangaInDBwithLabel[]
  mirrors: mirrorInfo[]
  dialog: boolean
}>();

const emit = defineEmits<{
  (event: 'show-manga', payload: { mirror: string, url: string, lang: string }): void
  (event: 'update-dialog'): void
}>();

const $q = useQuasar();

function getMirror(mirror:string) {
  return props.mirrors.find(m => m.name === mirror);
}

const QMenuColors = {
  dark : {
    bold: {
      some: 'text-orange',
      none: 'text-grey-6',
    },
    some:'text-orange-2',
    none: 'text-grey-6',
  },
  light : {
    bold: {
      some: 'text-orange',
      none: 'text-grey-6',
    },
    some:'text-primary',
    none: 'text-grey-6',
  },
};

function QMenuChapterColor (unread: number) {
  if($q.dark.isActive) {
    if(unread > 0) return QMenuColors.dark.bold.some;
    return QMenuColors.dark.bold.none;
  } else {
    if(unread > 0) return QMenuColors.light.bold.some;
    return QMenuColors.light.bold.none;
  }
}

function QMenuLabelColor (unread:number) {
  if($q.dark.isActive) {
    if(unread > 0) return QMenuColors.dark.some;
    return QMenuColors.dark.none;
  } else {
    if(unread > 0) return QMenuColors.light.some;
    return QMenuColors.light.none;
  }
}
</script>

<template>
  <q-menu
    v-if="$q.screen.gt.sm"
    anchor="center middle"
    self="center middle"
  >
    <q-list
      :style="'min-width:'+ width"
      separator
    >
      <q-item
        v-for="(manga, i) in sortedGroup"
        :key="i"
        v-close-popup
        clickable
        @click="emit('show-manga', {mirror: manga.mirror, url: manga.url, lang: manga.lang})"
      >
        <q-item-section>
          <q-item-label class="flex items-center">
            <q-img
              :src="getMirror(manga.mirror)?.icon"
              height="16px"
              width="16px"
              class="q-mr-xs bg-white"
            />
            <span class="text-bold">{{ getMirror(manga.mirror)?.displayName }}</span>
            <span
              class="text-caption q-ml-xs"
            >
              ({{ $t(`languages.${manga.lang}.value`) }})
            </span>
          </q-item-label>
          <q-item-label
            caption
            lines="1"
          >
            <span
              class="q-mr-xs"
              :class="QMenuChapterColor(manga.unread)"
            >
              {{ manga.unread }}
            </span>
            <span :class="QMenuLabelColor(manga.unread)">{{ $t('library.left_to_read', {chapterWord: $t('mangas.chapter', manga.unread).toLocaleLowerCase() }, manga.unread) }}</span>
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-menu>
  <q-dialog
    v-else
    :model-value="dialog"
    @update:model-value="emit('update-dialog')"
  >
    <q-card>
      <q-card-section>
        <q-list
          separator
        >
          <q-item
            v-for="(manga, i) in sortedGroup"
            :key="i"
            v-close-popup
            clickable
            class="q-pa-lg"
            @click="emit('show-manga', {mirror: manga.mirror, url: manga.url, lang: manga.lang})"
          >
            <q-item-section>
              <q-item-label class="flex items-center">
                <q-img
                  :src="getMirror(manga.mirror)?.icon"
                  height="16px"
                  width="16px"
                  class="q-mr-xs bg-white"
                />
                <span class="text-bold">{{ getMirror(manga.mirror)?.displayName }}</span>
                <span
                  class="text-caption q-ml-xs"
                >
                  ({{ $t(`languages.${manga.lang}.value`) }})
                </span>
              </q-item-label>
              <q-item-label
                caption
                lines="1"
              >
                <span
                  class="q-mr-xs"
                  :class="QMenuChapterColor(manga.unread)"
                >
                  {{ manga.unread }}
                </span>
                <span :class="QMenuLabelColor(manga.unread)">{{ $t('library.left_to_read', {chapterWord: $t('mangas.chapter', manga.unread).toLocaleLowerCase() }, manga.unread) }}</span>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
