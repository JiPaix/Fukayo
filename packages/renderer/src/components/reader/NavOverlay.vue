<script lang="ts" setup>
import { getCssVar, useQuasar } from 'quasar';
import { computed, ref } from 'vue';

const props = defineProps<{
  rtl: boolean;
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
  const marginBottom = '15px';
  if(show.value) {
    return {
      opacity: 0.1,
      background:  background ? background : 'none',
      width,
      marginLeft,
      marginBottom,
    };
  }
  return {
    opacity: 0.1,
    background: 'none',
    width,
    marginLeft,
    marginBottom,
  };
});

function nav() {
  if(props.position === 'center') return emit('toggleDrawer');
  const isPrev = (props.position === 'right' && props.rtl) || (props.position === 'left' && !props.rtl);
  const isNext = (props.position === 'left' && props.rtl) || (props.position === 'right' && !props.rtl);
  if(isPrev) {
    if(props.currentPage > 1) return emit('scrollToPage', props.currentPage-2);
    else return emit('loadPrevious', true);
  }
  if(isNext) {
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
