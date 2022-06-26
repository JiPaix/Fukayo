<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';

/** props */
const props = defineProps<{
  icon?: string
  nbOfUnread: number
  mirrorDisplayName?: string
  lang: string
}>();
/** emit */
const emit = defineEmits<{ (event: 'showManga'): void }>();
/** quasar */
const $q = useQuasar();
/** hover */
const hover = ref(false);

const QChipSize = computed(() => {
  switch ($q.screen.name) {
    case 'xs':
      return '';
    case 'sm':
      return '';
    case 'md':
      return '';
    default:
      return 'md';
  }
});

const QChipColors = {
    none : {
      hover: 'bg-grey-6',
      normal: 'bg-grey-7',
    },
    some : {
      hover: 'bg-orange-5',
      normal: 'bg-orange',
    },
};

const QChipColor = computed(() => {
  if(props.nbOfUnread > 0) return hover.value ? QChipColors.some.hover : QChipColors.some.normal;
  else return hover.value ? QChipColors.none.hover : QChipColors.none.normal;
});



</script>
<template>
  <div
    :size="QChipSize"
    class="q-mb-xs flex flex-center justify-between text-white shadow-3 rounded-borders"
    :class="QChipColor"
    @click="emit('showManga')"
    @mouseenter="hover=true"
    @mouseleave="hover=false"
  >
    <q-img
      :src="icon"
      width="16px"
      height="16px"
      class="bg-white q-mr-xs"
      :ratio="1"
      :style="nbOfUnread === 0 ? 'opacity:0.5;' : undefined"
    />
    <span
      class="q-mr-xs"
      style="font-size:10px;"
    >
      {{ nbOfUnread }}
    </span>
    <q-tooltip>
      <span>{{ mirrorDisplayName }}</span>
      <span class="q-ml-xs">({{ $t(`languages.${lang}.value`) }})</span>
    </q-tooltip>
  </div>
</template>
