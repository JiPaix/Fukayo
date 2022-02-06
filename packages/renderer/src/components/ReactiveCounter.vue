<script lang="ts" setup>
import {ref} from 'vue';

const count = ref(0);
</script>

<template>
  <button @click="count++">
    Beta count {{ count }}
  </button>
  <br><br>
  <code>packages/renderer/src/components/ReactiveCounter.vue</code>
</template>
