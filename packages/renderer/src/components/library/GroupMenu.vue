<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import type { MangaInDBwithLabel } from '@renderer/components/library/@types';
import { debounce, QCard, QCardSection, QDialog, QIcon, QImg, QItem, QItemLabel, QItemSection, QList, QMenu, useQuasar } from 'quasar';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  width: string,
  sortedGroup: MangaInDBwithLabel[]
  mirrors: mirrorInfo[]
  dialog: boolean
}>();

/** emits */
const emit = defineEmits<{
  (event: 'show-manga', payload: { mirror: string, url: string, lang: mirrorsLangsType, id: string }): void
  (event: 'update-dialog'): void
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// globals
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

// states
const
/** index hovered card */
mouseOver = ref<null | number>(null),
/** index of card triggering the dialog */
subDialog = ref<null | number>(null);

/** change index of hovered card */
function toggleMenu(index:number|null) {
  mouseOver.value = index;
}

/** debounced `toggleMenu` */
const debounceToggleMenu = debounce(toggleMenu, 100);

/** find mirror by name */
function getMirror(mirror:string) {
  return props.mirrors.find(m => m.name === mirror);
}

/** return a color for QMenu's labels */
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
          @click="debounceToggleMenu(i)"
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
