<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import type dayjs from 'dayjs';
import type { MangaInDB, MangaPage } from '../../../../api/src/models/types/manga';


/** dayJS lib */
const dayJS = inject<typeof dayjs>('dayJS');
/** props */
defineProps<{
  chapter: (MangaInDB['chapters']|MangaPage['chapters'])[0] & { hasNextUnread: boolean, hasPrevUnread: boolean };
  index: number
  length: number
}>();
/** emit */
const emit = defineEmits<{
  (event: 'showChapterComp', index: number): void
  (event: 'markNextAsRead', index: number): void
  (event: 'markNextAsUnread', index: number): void
  (event: 'markAsUnread', index: number): void
  (event: 'markAsRead', index: number): void
  (event: 'markPreviousAsRead', index: number): void
  (event: 'markPreviousAsUnread', index: number): void
}>();
/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
</script>
<template>
  <q-item
    :dark="$q.dark.isActive"
    clickable
    style="max-height:52px;"
  >
    <!-- Chapter name, volume, number -->
    <q-item-section
      :class="chapter.read ? 'text-grey-9' : ''"
      @click="emit('showChapterComp', index)"
    >
      <q-item-label>
        <span v-if="chapter.volume !== undefined">{{ $t("mangas.volume") }} {{ chapter.volume }}</span>
        <span v-if="chapter.volume !== undefined && chapter.number !== undefined">
          -
        </span>
        <span
          v-if="chapter.number !== undefined"
        >{{ $t("mangas.chapter") }} {{ chapter.number }}</span>
        <span v-if="chapter.volume === undefined && chapter.number === undefined">{{
          chapter.name
        }}</span>
      </q-item-label>
      <q-item-label
        v-if="chapter.number !== undefined"
        caption
      >
        <span class="text-grey-6">{{ chapter.name }}</span>
      </q-item-label>
    </q-item-section>
    <q-item-section
      side
    >
      <!-- Chapter Date -->
      <q-item-label caption>
        {{ dayJS ? dayJS(chapter.date).fromNow() : chapter.date }}
        <q-btn-dropdown
          dropdown-icon="more_vert"
          flat
        >
          <q-list separator>
            <q-item
              v-if="index > 0 && chapter.hasNextUnread"
              v-close-popup
              class="flex items-center"
              clickable
              @click="emit('markNextAsRead', index)"
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
              {{ $t('mangas.markasread.next', { chapterWord: $t('mangas.chapter', length).toLocaleLowerCase() }, length) }}
            </q-item>
            <q-item
              v-else-if="index > 0"
              v-close-popup
              class="flex items-center"
              clickable
              @click="emit('markNextAsUnread', index)"
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
              {{ $t('mangas.markasread.next_unread', { chapterWord: $t('mangas.chapter', length).toLocaleLowerCase() }, length) }}
            </q-item>
            <q-item
              v-if="chapter.read"
              v-close-popup
              class="flex items-center"
              clickable
              @click="emit('markAsUnread', index)"
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
              @click="emit('markAsRead', index)"
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
              v-if="index < length - 1 && chapter.hasPrevUnread"
              v-close-popup
              class="flex items-center"
              clickable
              @click="emit('markPreviousAsRead', index)"
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
              {{ $t('mangas.markasread.previous', { chapterWord: $t('mangas.chapter', length).toLocaleLowerCase() }, length) }}
            </q-item>
            <q-item
              v-else-if="index < length - 1"
              v-close-popup
              class="flex items-center"
              clickable
              @click="emit('markPreviousAsUnread', index)"
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
              {{ $t('mangas.markasread.previous_unread', { chapterWord: $t('mangas.chapter', length).toLocaleLowerCase() }, length) }}
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </q-item-label>
    </q-item-section>
  </q-item>
</template>
