<script lang="ts" setup>
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n/index';
import { mirrorsLang } from '@i18n/index';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/** stored settings */
const settings = useSettingsStore();
/** i18n */
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

const models = computed(() => {
  return mirrorsLang.filter(l => l !== 'xx').sort((a,b) => {
    return $t('languages.'+a).localeCompare($t('languages.'+b));
  });
});

function updateval(lang:mirrorsLangsType, val:boolean) {
  if(val) settings.i18n.ignored = settings.i18n.ignored.filter(l => l !== lang);
  else settings.i18n.ignored.push(lang);
}

function selectAll() {
  settings.i18n.ignored = [];
}

function unselectAll() {
  settings.i18n.ignored = mirrorsLang.filter(l => l !== 'xx');
}

</script>

<template>
  <q-card
    class="w-100"
    flat
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? 'bg-dark': 'bg-grey-2'"
  >
    <q-card-section
      class="row items-center"
    >
      <q-banner class="q-mx-auto bg-grey-9 text-white">
        <template #avatar>
          <q-icon
            name="translate"
            color="white"
          />
        </template>
        {{ $t('settings.language.description') }}
        <template #action>
          <q-btn
            flat
            color="white"
            :label="$t('settings.language.selectall')"
            @click="selectAll"
          />
          <q-btn
            flat
            color="white"
            :label="$t('settings.language.unselectall')"
            @click="unselectAll"
          />
        </template>
      </q-banner>
    </q-card-section>
    <q-card-section class="row">
      <div
        v-for="(lang ,i) in models"
        :key="i"
        class="col-lg-2 col-sm-4"
      >
        <q-checkbox
          :model-value="!settings.i18n.ignored.includes(lang)"
          :label="$t(`languages.${lang}`)"
          @update:model-value="(val) => updateval(lang, val)"
        />
      </div>
    </q-card-section>
  </q-card>
</template>
