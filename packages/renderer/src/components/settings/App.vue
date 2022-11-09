<script lang="ts" setup>
import type en from '@i18n/../locales/en.json';
import type { appLangsType } from '@i18n';
import fileSystem from '@renderer/components/settings/fileSystem.vue';
import languageList from '@renderer/components/settings/languageList.vue';
import mainOptions from '@renderer/components/settings/mainOptions.vue';
import mirrorsOptions from '@renderer/components/settings/mirrorsOptions.vue';
import { useQuasar } from 'quasar';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
const tab = ref<'general' | 'sources' | 'languages' | 'files'>('general');
const $q = useQuasar();
</script>

<template>
  <div
    class="q-gutter-y-md w-100"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-dark'"
  >
    <q-tabs
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
    </q-tabs>
    <main-options v-if="tab === 'general'" />
    <mirrors-options v-else-if="tab === 'sources'" />
    <language-list v-else-if="tab === 'languages'" />
    <file-system v-else />
  </div>
</template>
