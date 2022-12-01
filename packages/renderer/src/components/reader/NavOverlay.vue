<script lang="ts" setup>
import { getCssVar, useQuasar } from 'quasar';
import { computed } from 'vue';

const props = defineProps<{
  drawerOpen: boolean;
  position: 'left' | 'right'|'center';
  hintColor?: 'primary' | 'secondary' | 'accent' | 'dark' | 'positive' | 'negative' | 'info' | 'warning'
}>();

const $q = useQuasar();

const style = computed(() => {
  const width = (($q.screen.width - (props.drawerOpen ? 300: 0)) / 3),
        background = props.hintColor ? getCssVar(props.hintColor) : 'none',
        marginBottom = '15px',
        marginLeft = props.position === 'center' ? width : 0,
        marginRight = props.position === 'right' ? props.drawerOpen ? 300+12 : 12 : 0;


  return {

    background:  background ? background : 'none',
    width: width+'px',
    marginBottom,
    marginLeft: marginLeft+'px',
    marginRight: marginRight+'px',
  };

});


</script>

<template>
  <div
    :class="position === 'center' ? 'absolute-left' : `absolute-${position}`"
    :style="style"
    class="hoverColor"
  />
</template>
<style lang="css">
.hoverColor {
  opacity: 0
}
.hoverColor:hover {
  opacity: 0.1;
}
</style>
