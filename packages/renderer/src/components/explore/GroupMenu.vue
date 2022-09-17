<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n/index';
import { useQuasar } from 'quasar';

const props = defineProps<{
  width: number,
  height: number,
  sortedGroup: SearchResult
  mirror: mirrorInfo
  dialog: boolean
  hideLangs?: mirrorsLangsType[]
}>();

const emit = defineEmits<{
  (event: 'show-manga', payload: { mirror: string, url: string, lang: SearchResult['langs'][number], id: string }): void
  (event: 'update-dialog'): void
}>();

const $q = useQuasar();

function sortLangs(langs: SearchResult['langs']) {
  if(props.hideLangs) langs = langs.filter(x => props.hideLangs?.some(y => x === y));
  return langs.sort((a, b) => a.localeCompare(b));
}

const itemSize = 32;

</script>

<template>
  <q-menu
    v-if="$q.screen.gt.md"
    anchor="center middle"
    self="center middle"
    :style="{ 'max-height': `${itemSize*5}px` }"
  >
    <q-list
      :style="{ 'width': `${width-(width*0.2)}px`, 'max-height': `${itemSize*5}px` }"
      separator
      dense
    >
      <q-bar
        :style="{ 'width': `${width-(width*0.2)}px`, 'height': 'auto' }"
        class="text-caption items-center q-pa-sm"
        :dark="$q.dark.isActive"
      >
        <span class="text-light">{{ sortedGroup.name }}</span>
      </q-bar>
      <q-item
        v-for="(lang, i) in sortLangs(sortedGroup.langs)"
        :key="i"
        v-close-popup
        clickable
        @click="emit('show-manga', {mirror: mirror.name, url: sortedGroup.url, lang: lang, id: sortedGroup.id})"
      >
        <q-item-section>
          <q-item-label class="flex items-center">
            <span class="text-caption">{{ $t(`languages.${lang}`) }}</span>
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
      <q-bar
        class="text-bold q-pa-md"
        style="height:auto;"
      >
        {{ sortedGroup.name }}
      </q-bar>
      <q-card-section>
        <q-list
          separator
        >
          <q-item
            v-for="(lang, i) in sortedGroup.langs"
            :key="i"
            v-close-popup
            clickable
            class="q-pa-lg"
            @click="emit('show-manga', {mirror: mirror.name, url: sortedGroup.url, lang: lang, id: sortedGroup.id})"
          >
            <q-item-section>
              <q-item-label class="flex items-center">
                <span class="text-caption">{{ $t(`languages.${sortedGroup}`) }}</span>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
