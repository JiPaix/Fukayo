<script lang="ts" setup>
import type { SearchResult } from '@api/models/types/search';
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { QItem, useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  width: number,
  height: number,
  sortedGroup: SearchResult
  mirror: mirrorInfo
  dialog: boolean
  hideLangs?: mirrorsLangsType[]
}>();

/** emits */
const emit = defineEmits<{
  (event: 'show-manga', payload: { mirror: string, url: string, lang: SearchResult['langs'][number], id: string }): void
  (event: 'update-dialog'): void
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// globals
const
/** item min height */
itemMinHeight = 32,
/** number of items */
nbOfItems = 5;

// states
const
/** item's title template ref */
titleitem = ref<HTMLSpanElement|null>();

// computed
const
/** QList's max height */
QListMaxHeight = computed(() => {
  if(!titleitem.value) return itemMinHeight * nbOfItems;
  if(!titleitem.value.parentElement) return itemMinHeight * nbOfItems;
  return (itemMinHeight * nbOfItems) + titleitem.value.parentElement.offsetHeight;
});

/** sort languages */
function sortLangs(langs: mirrorsLangsType[]) {
  if(props.hideLangs) langs = langs.filter(x => !props.hideLangs?.some(y => x === y));
  return langs.sort((a, b) => $t('languages.'+a).localeCompare($t('languages.'+b)));
}
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
