<script lang="ts" setup>
import { focusMode, isFullScreen } from '@renderer/components/helpers/toggleFullScreen';
import { colors, getCssVar, QIcon, useQuasar } from 'quasar';
import { computed } from 'vue';

/** props */
const props = defineProps<{
  drawerOpen: boolean;
  position: 'left' | 'right'|'center';
  hintColor?: 'primary' | 'secondary' | 'accent' | 'dark' | 'positive' | 'negative' | 'info' | 'warning'
  mobileHint?: boolean
  rtl?: boolean
}>();

/** emits */
const emit = defineEmits<{
  (eventName: 'showMenu'):void
  (eventName: 'nextPage'):void
  (eventName: 'prevPage'):void
}>();
/** quasar */
const $q = useQuasar();

/** header + sub-header size */
const headerSize = computed(() => {
  const topHeader = (document.querySelector('#top-header') as HTMLDivElement || null) || document.createElement('div');
  const subHeader = (document.querySelector('#sub-header') as HTMLDivElement || null) || document.createElement('div');
  return topHeader.offsetHeight + subHeader.offsetHeight;
});

/** CSS */
const style = computed(() => {
  const width = ($q.screen.width - (props.drawerOpen ? 300: 0));
  const positiveCSS = getCssVar('positive');
  const negativeCSS = getCssVar('negative');
  if(!positiveCSS || !negativeCSS) return;
  const positive = colors.changeAlpha(positiveCSS, 0.7);
  const negative = colors.changeAlpha(negativeCSS, 0.7);
  return {
    height: ($q.screen.height - headerSize.value)+'px',
    width: width+'px',
    '--hint-positive': props.rtl ? negative : positive,
    '--hint-negative': props.rtl ? positive : negative,
  };

});

const shouldHint = computed(() => {
  if(isFullScreen.value || focusMode.value) return false;
  if($q.platform.has.touch) return false;
  return true;
});

/** QIcons class names */
const hoverColorClass = computed(() => shouldHint.value ? 'hoverColor' : undefined);
/** QIcons class names */
const hintColorClass = computed(() => shouldHint.value ? props.hintColor: 'transparent');
</script>

<template>
  <div
    class="fixed-center"
    :class="mobileHint ? 'specialGradient': undefined"
    :style="style"
  >
    <div class="fixed-center w-100">
      <div class="flex flex-center justify-between">
        <q-icon
          :class="mobileHint ? 'mobileHint' : hoverColorClass"
          :color="mobileHint ? 'dark' : hintColorClass"
          :name="props.rtl ? 'navigate_next' : 'navigate_before'"
          size="20vw"
          @click="emit('prevPage')"
        />
        <q-icon
          :class="mobileHint ? 'mobileHint' : hoverColorClass"
          :color="mobileHint ? 'dark' : hintColorClass"
          name="menu"
          size="20vw"
          @click="emit('showMenu')"
        />
        <q-icon
          :class="mobileHint ? 'mobileHint' : hoverColorClass"
          :color="mobileHint ? 'dark' : hintColorClass"
          :name="props.rtl ? 'navigate_before' : 'navigate_next'"
          size="20vw"
          @click="emit('nextPage')"
        />
      </div>
    </div>
  </div>
</template>
<style lang="css" scoped>
.hoverColor {
  opacity: 0
}
.hoverColor:hover {
  opacity: 0.3;
}
.mobileHint {
  opacity: 1
}
.specialGradient {
  background: linear-gradient(90deg, var(--hint-positive) 25%, rgba(0,0,0,0) 20%), linear-gradient(90deg, transparent 75%, var(--hint-negative) 20%)
}
</style>

