<script lang="ts" setup>
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import fileSystem from '@renderer/components/settings/fileSystem.vue';
import languageList from '@renderer/components/settings/languageList.vue';
import mainOptions from '@renderer/components/settings/mainOptions.vue';
import mirrorsOptions from '@renderer/components/settings/mirrorsOptions.vue';
import { useQuasar } from 'quasar';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';


// settings
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** route */
route = useRoute(),
/** quasar */
$q = useQuasar();

// globals
const
/** list of tabs */
tabList:['general', 'sources', 'languages', 'files'] = ['general', 'sources', 'languages', 'files'],
/** default tab */
startTab:typeof tabList[number] = typeof route.params.tab === 'string' && tabList.includes(route.params.tab as typeof tabList[number]) ? route.params.tab as typeof tabList[number]: 'general';

// states
const
/** current tab */
tab = ref<'general' | 'sources' | 'languages' | 'files'>(startTab),
subheaderSize = ref(0);

/** save QHeader's height */
function onResize() {
  const div = document.querySelector<HTMLDivElement>('#sub-header');
  if(div) subheaderSize.value = div.offsetHeight;
}
</script>
<template>
  <div
    class="w-100"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark'"
  >
    <q-tabs
      id="sub-header"
      v-model="tab"
      inline-label
      :class="$q.dark.isActive ? 'bg-grey-7 text-white' : 'bg-grey-4 text-dark'"
    >
      <q-tab
        name="general"
        icon="settings"
        :label="$t('settings.general.tab')"
      />
      <q-tab
        name="sources"
        icon="travel_explore"
        :label="$t('mangas.source', 20)"
      />
      <q-tab
        name="languages"
        icon="translate"
        :label="$t('languages.language', 20)"
      />
      <q-tab
        name="files"
        icon="storage"
        :label="$t('settings.files.tab')"
      />
      <q-resize-observer @resize="onResize" />
    </q-tabs>
    <main-options
      v-if="tab === 'general'"
      :sub-header-size="subheaderSize"
    />
    <mirrors-options
      v-else-if="tab === 'sources'"
      :sub-header-size="subheaderSize"
    />
    <language-list
      v-else-if="tab === 'languages'"
      :sub-header-size="subheaderSize"
    />
    <file-system v-else />
  </div>
</template>
