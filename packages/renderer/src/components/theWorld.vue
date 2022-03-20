<script lang="ts" setup>
  import { ref } from 'vue';
  import { useStore } from '/@/store/settings';
  const settings = useStore();

  const list = ref<any>(null);


  async function getList() {
    const res = await fetch('http://localhost:'+settings.server.port+'/api/mirrors/list');
    list.value = await res.json();
  }
  getList();


</script>
<template>
  <h3>
    Example fetched from http://localhost:{{ settings.server.port }}/api/mirrors/list
  </h3>
  <v-btn
    :href="'http://localhost:' + settings.server.port+'/api'"
    target="_blank"
    color="primary"
    class="my-2"
  >
    Try it your self
  </v-btn>
  <pre>
    {{ list }}
  </pre>
</template>
