<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { mirrorsLangsType } from '@i18n';
import { QItem, useQuasar } from 'quasar';
import { computed, ref } from 'vue';

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
  if(props.hideLangs) langs = langs.filter(x => !props.hideLangs?.some(y => x === y));
  return langs.sort((a, b) => a.localeCompare(b));
}

// List config
const titleitem = ref<HTMLSpanElement|null>();

const itemMinHeight = 32;
const nbOfItems = 5;

const QListMaxHeight = computed(() => {
  if(!titleitem.value) return itemMinHeight * nbOfItems;
  if(!titleitem.value.parentElement) return itemMinHeight * nbOfItems;
  return (itemMinHeight * nbOfItems) + titleitem.value.parentElement.offsetHeight;
});

</script>

<template>
  <q-menu
    v-if="$q.screen.gt.md"
    anchor="center middle"
    self="center middle"
    :style="{ 'max-height': `${itemMinHeight*nbOfItems}px` }"
  >
    <q-list
      :style="{ 'max-width': `${width-(width*0.2)}px`, 'max-height': `${QListMaxHeight}px` }"
      separator
      dense
    >
      <q-item
        class="q-pa-sm text-orange text-bold"
        :dark="$q.dark.isActive"
        :style="{ 'width': `${width-(width*0.2)}px`, 'word-break': 'break-word' }"
      >
        <span
          ref="titleitem"
          class="text-light"
        >
          {{ }}{{ sortedGroup.name }}
        </span>
      </q-item>
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
            v-for="(lang, i) in sortLangs(sortedGroup.langs)"
            :key="i"
            v-close-popup
            clickable
            class="q-pa-lg"
            @click="emit('show-manga', {mirror: mirror.name, url: sortedGroup.url, lang: lang, id: sortedGroup.id})"
          >
            <q-item-section>
              <q-item-label class="flex items-center">
                <span class="text-caption">{{ $t(`languages.${lang}`) }}</span>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
