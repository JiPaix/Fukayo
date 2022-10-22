<script lang="ts" setup>
import { getCssVar, useQuasar } from 'quasar';
import { computed, ref } from 'vue';

const props = defineProps<{
  drawerOpen: boolean;
  position: 'left' | 'right'|'center';
  currentPage: number;
  totalPages: number;
  hintColor?: 'primary' | 'secondary' | 'accent' | 'dark' | 'positive' | 'negative' | 'info' | 'warning'
}>();

const emit = defineEmits<{
  (event: 'scrollToPage', index:number):void
  (event: 'loadNext'):void
  (event: 'loadPrevious', rememberLastPage: true):void
  (event: 'toggleDrawer'):void
}>();

const $q = useQuasar();

const show = ref(false);

const style = computed(() => {
  const width = ($q.screen.width- (props.drawerOpen ? 300: 0))/3+'px';
  const background = props.hintColor ? getCssVar(props.hintColor) : 'none';
  const marginLeft = props.position === 'center' ? width : 0;
  if(show.value) {
    return {
      opacity: 0.1,
      background:  background ? background : 'none',
      width,
      marginLeft,
    };
  }
  return {
    opacity: 0.1,
    background: 'none',
    width,
    marginLeft,
  };
});

function nav() {
  if(props.position === 'center') return emit('toggleDrawer');
  if(props.position === 'left') {
    if(props.currentPage > 1) return emit('scrollToPage', props.currentPage-2);
    else return emit('loadPrevious', true);
  }
  if(props.position === 'right') {
    if(props.currentPage < props.totalPages) return emit('scrollToPage', props.currentPage);
    else return emit('loadNext');
  }
}
</script>

<template>
  <div
    :class="`absolute-${position === 'center' ? 'left' : position}`"
    :style="style"
    @mouseover="show = true"
    @mouseleave="show = false"
    @click="nav"
  />
</template>
