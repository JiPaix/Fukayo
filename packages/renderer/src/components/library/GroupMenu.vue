<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n/availableLangs';
import type { MangaInDBwithLabel } from '@renderer/components/library/@types';
import { debounce, useQuasar } from 'quasar';
import { ref } from 'vue';

const props = defineProps<{
  width: string,
  sortedGroup: MangaInDBwithLabel[]
  mirrors: mirrorInfo[]
  dialog: boolean
}>();

const emit = defineEmits<{
  (event: 'show-manga', payload: { mirror: string, url: string, lang: mirrorsLangsType, id: string }): void
  (event: 'update-dialog'): void
}>();

const $q = useQuasar();

const mouseOver = ref<null | number>(null);
const subDialog = ref<null | number>(null);

function toggleMenu(index:number|null) {
  mouseOver.value = index;
}

const debounceToggleMenu = debounce(toggleMenu, 100);

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
      dense
    >
      <q-item
        v-for="(manga, i) in sortedGroup"
        :key="i"
        clickable
        dense
        @click="manga.langs.length === 1 ? emit('show-manga', { mirror: manga.mirror, url: manga.url, lang: manga.langs[0], id: manga.id}) : null"
        @mouseenter="debounceToggleMenu(i)"
        @mouseleave="debounceToggleMenu(null)"
      >
        <q-item-section>
          <q-item-label class="flex items-center">
            <q-img
              :src="getMirror(manga.mirror)?.icon"
              height="16px"
              width="16px"
              class="q-mr-xs"
            />
            <span class="text-bold">{{ getMirror(manga.mirror)?.displayName }}</span>
          </q-item-label>
          <q-item-label
            v-if="manga.langs.length === 1"
            class="text-caption text-grey"
          >
            {{ $t(`languages.${manga.langs[0]}`) }}
          </q-item-label>
          <q-item-label v-if="manga.langs.length === 1">
            <span
              class="text-caption"
              :class="QMenuLabelColor(manga.unread)"
            >
              {{ manga.unread-manga.chapters.length }} / {{ manga.chapters.length }}
            </span>
          </q-item-label>
        </q-item-section>
        <q-item-section
          v-if="manga.langs.length > 1"
          side
        >
          <q-icon name="keyboard_arrow_right" />
        </q-item-section>

        <q-menu
          v-if="manga.langs.length > 1"
          :model-value="mouseOver === i"
          anchor="top end"
          self="top start"
          @mouseenter="debounceToggleMenu(i)"
          @mouseleave="debounceToggleMenu(null)"
        >
          <q-list
            separator
            dense
          >
            <q-item
              v-for="(lang, n) in manga.langs"
              :key="n"
              dense
              clickable
            >
              <q-item-section @click="emit('show-manga', { mirror: manga.mirror, url: manga.url, lang, id: manga.id})">
                <q-item-label

                  class="text-caption text-grey"
                >
                  {{ $t(`languages.${lang}`) }}
                </q-item-label>
                <q-item-label>
                  <span
                    class="text-caption"
                    :class="QMenuLabelColor(manga.chapters.filter(c => c.lang === lang).length - manga.chapters.filter(c => c.lang === lang && c.read).length)"
                  >
                    {{ manga.chapters.filter(c => c.lang === lang && c.read).length }} / {{ manga.chapters.filter(c => c.lang === lang).length }}
                  </span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
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
          :style="'min-width:'+ width"
          separator
        >
          <q-item
            v-for="(manga, i) in sortedGroup"
            :key="i"
            clickable
            @click="manga.langs.length === 1 ? emit('show-manga', { mirror: manga.mirror, url: manga.url, lang: manga.langs[0], id: manga.id}) : subDialog = i"
          >
            <q-item-section>
              <q-item-label class="flex items-center">
                <q-img
                  :src="getMirror(manga.mirror)?.icon"
                  height="16px"
                  width="16px"
                  class="q-mr-xs"
                />
                <span class="text-bold">{{ getMirror(manga.mirror)?.displayName }}</span>
              </q-item-label>
              <q-item-label
                v-if="manga.langs.length === 1"
                class="text-caption text-grey"
              >
                {{ $t(`languages.${manga.langs[0]}`) }}
              </q-item-label>
              <q-item-label v-if="manga.langs.length === 1">
                <span
                  class="text-caption"
                  :class="QMenuLabelColor(manga.unread)"
                >
                  {{ manga.unread-manga.chapters.length }} / {{ manga.chapters.length }}
                </span>
              </q-item-label>
            </q-item-section>
            <q-item-section
              v-if="manga.langs.length > 1"
              side
            >
              <q-icon name="keyboard_arrow_right" />
            </q-item-section>

            <q-dialog
              :model-value="subDialog === i"
              @update:model-value="subDialog = null"
            >
              <q-card>
                <q-list
                  separator
                >
                  <q-item
                    v-for="(lang, n) in manga.langs"
                    :key="n"
                    clickable
                  >
                    <q-item-section @click="emit('show-manga', { mirror: manga.mirror, url: manga.url, lang, id: manga.id})">
                      <q-item-label

                        class="text-caption text-grey"
                      >
                        {{ $t(`languages.${lang}`) }}
                      </q-item-label>
                      <q-item-label>
                        <span
                          class="text-caption"
                          :class="QMenuLabelColor(manga.chapters.filter(c => c.lang === lang).length - manga.chapters.filter(c => c.lang === lang && c.read).length)"
                        >
                          {{ manga.chapters.filter(c => c.lang === lang && c.read).length }} / {{ manga.chapters.filter(c => c.lang === lang).length }}
                        </span>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card>
            </q-dialog>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
