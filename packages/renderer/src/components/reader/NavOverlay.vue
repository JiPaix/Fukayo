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
        marginLeft = props.position === 'center' ? width : props.position === 'left' ? 12 : 0,
        marginRight = props.position === 'right' ? props.drawerOpen ? 300+12 : 12 : 0;

  return {
    height: $q.screen.height - 82,
    marginTop: '82px',
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
    :style="{ ...style, background: 'none' }"
    class="hoverColor"
  >
    <q-icon
      v-if="position === 'left' || position === 'right'"
      class="absolute-center"
      :color="hintColor"
      :name="position === 'left' ? 'navigate_before' : position === 'right' ? 'navigate_next' : ''"
      size="300px"
      :style="{ width: style.width }"
    />
  </div>
</template>
<style lang="css">
.hoverColor {
  opacity: 0
}
.hoverColor:hover {
  opacity: 0.3;
}
</style>
