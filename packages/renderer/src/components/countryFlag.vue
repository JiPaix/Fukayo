<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import 'flag-icons';

const $t = useI18n().t.bind(useI18n());

const props = defineProps<{
  country: string
  size: string
  squared?: boolean
  showname?: boolean
  noTooltip?: boolean
}>();


const icon = ref(getCountryCode());

function getCountryCode() {
  const code = props.country.toLocaleLowerCase();
  const realcode = $t('languages.'+code+'.flag');
  const square = props.squared ? ' fis' : '';
  const flag = `fi fi-${realcode}` + square;
  const name = $t('languages.'+code+'.value');
  const localname = $t('languages.'+code+'.localvalue');
  const size = props.size ? props.size : '16px';
  return { flag, name, localname, size };
}

</script>
<template>
  <div class="flex items-center">
    <span
      v-if="props.showname"
      class="q-mr-md"
    >
      {{ icon.name }} ({{ icon.localname }}) {{ $t('languages.current.value') === icon.localname ? '' : `(${icon.localname})` }}
    </span>
    <div
      :class="icon.flag"
      :style="`width: ${icon.size}; height: ${icon.size};`"
    >
      <q-tooltip v-if="!noTooltip && !showname">
        {{ icon.name }} {{ $t('languages.current.value') === icon.localname ? '' : `(${icon.localname})` }}
      </q-tooltip>
    </div>
  </div>
</template>
