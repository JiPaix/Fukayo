<script lang="ts" setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import 'flag-icons';

const $t = useI18n().t.bind(useI18n());

const props = defineProps<{
  country: string
  square: boolean
  height: string,
  width: string,
  showname?: boolean
  noTooltip?: boolean
}>();


const icon = ref(getCountryCode());

function getCountryCode() {
  const code = props.country.toLocaleLowerCase();
  const realcode = $t('languages.'+code+'.flag');
  const flag = `fi fi-${realcode}${props.square ? ' fis':''}`;
  const name = $t('languages.'+code+'.value');
  const localname = $t('languages.'+code+'.localvalue');
  return { flag, name, localname };
}

</script>
<template>

    <span
      v-if="props.showname"
      class="q-mr-md"
    >
      {{ icon.name }} {{ $t('languages.current.value') === icon.localname ? '' : `(${icon.localname})` }}
    </span>
    <div
      :class="icon.flag"
      :style="'height:'+props.height+';width:'+props.width+';'"
    >
      <q-tooltip v-if="!noTooltip && !showname">
        {{ icon.name }} {{ $t('languages.current.value') === icon.localname ? '' : `(${icon.localname})` }}
      </q-tooltip>
    </div>

</template>
