<script lang="ts" setup>
import { getCssVar, useQuasar } from 'quasar';
import { computed } from 'vue';

const props = defineProps<{
  drawerOpen: boolean;
  position: 'left' | 'right'|'center';
  hintColor?: 'primary' | 'secondary' | 'accent' | 'dark' | 'positive' | 'negative' | 'info' | 'warning'
  mobileHint?: boolean
  rtl?: boolean
}>();

const $q = useQuasar();

/** header + sub-header size */
const headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
});

const style = computed(() => {
  const width = (($q.screen.width - (props.drawerOpen ? 300: 0)) / 3),
        background = props.hintColor ? getCssVar(props.hintColor) : 'none',
        marginBottom = '15px',
        marginLeft = props.position === 'center' ? width : props.position === 'left' ? 12 : 0,
        marginRight = props.position === 'right' ? props.drawerOpen ? 300+12 : 12 : 0;

  return {
    height: $q.screen.height - headerSize.value,
    marginTop: `${headerSize.value}px`,
    background:  background ? background : 'none',
    width: width+'px',
    marginBottom,
    marginLeft: marginLeft+'px',
    marginRight: marginRight+'px',
  };

});

const parentClass = computed(() => {
  let css = '';
  if(props.position === 'center') css += 'absolute-left ';
  else css += `absolute-${props.position} `;
  if(props.mobileHint) {
    css +=  'mobileHint ';
    if(props.position === 'left') {
      if(props.rtl) css += 'bg-positive';
      else css += 'bg-negative';
    }
    if(props.position === 'right') {
      if(props.rtl) css += 'bg-negative';
      else css += 'bg-positive';
    }

  }
  else css+= 'hoverColor';
  return css;
});


</script>

<template>
  <div
    :class="parentClass"
    :style="{ ...style, background: mobileHint ? getCssVar('orange') || 'none' : 'none' }"
  >
    <div class="absolute-center">
      <q-icon

        :color="mobileHint ? 'black' : hintColor"
        :name="position === 'left' ? 'navigate_before' : position === 'right' ? 'navigate_next' : mobileHint ? 'menu' : ''"
        :size="position === 'center' ? '200px' : '300px'"
        :style="{ width: style.width }"
      />
    </div>
  </div>
</template>
<style lang="css">
.hoverColor {
  opacity: 0
}
.hoverColor:hover {
  opacity: 0.3;
}
.mobileHint {
  opacity: 0.7
}
</style>
