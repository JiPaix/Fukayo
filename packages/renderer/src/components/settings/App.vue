<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import mirrorsOptions from './mirrorsOptions.vue';
import fileSystem from './fileSystem.vue';
import mainOptions from './mainOptions.vue';

/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
const tab = ref<string>('general');
</script>

<template>
  <div
    class="q-gutter-y-md w-100 bg-dark text-white "
  >
    <q-tabs
      v-model="tab"
      inline-label
      style="background:rgba(255, 255, 255, 0.15)"
    >
      <q-tab
        name="general"
        icon="settings"
        :label="$t('settings.general.value')"
      />
      <q-tab
        name="sources"
        icon="travel_explore"
        :label="$t('settings.sources.value')"
      />
      <q-tab
        name="files"
        icon="storage"
        :label="$t('settings.files.value')"
      />
    </q-tabs>
    <main-options v-if="tab === 'general'" />
    <mirrors-options v-if="tab === 'sources'" />
    <file-system v-if="tab === 'files'" />
  </div>
</template>
