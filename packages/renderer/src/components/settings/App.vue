<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import mirrorsOptions from './mirrorsOptions.vue';
import fileSystem from './fileSystem.vue';
import mainOptions from './mainOptions.vue';
import { useQuasar } from 'quasar';

/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
const tab = ref<string>('general');
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
        name="files"
        icon="storage"
        :label="$t('settings.files.tab')"
      />
    </q-tabs>
    <main-options v-if="tab === 'general'" />
    <mirrors-options v-if="tab === 'sources'" />
    <file-system v-if="tab === 'files'" />
  </div>
</template>
