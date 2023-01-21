<script setup lang="ts">
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
defineProps<{
  disabled: boolean
}>();

/** emits */
const emit = defineEmits<{
  (eventName: 'migrate', loader: Ref<boolean>):void
}>();

// setings
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// states
const
/** loading */
loading = ref(false);

function migrate() {
  emit('migrate', loading);
}
</script>

<template>
  <q-btn
    :disable="disabled && !loading"
    :loading="loading"
    class="w-100"
    square
    color="orange"
    @click="migrate"
  >
    <span class="text-bold">{{ $t('migrate.select_candidate') }}</span>
  </q-btn>
</template>
