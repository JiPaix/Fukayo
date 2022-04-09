<script lang="ts" setup>
import { ref } from 'vue';
import searchMangas from './searchMangas.vue';
import type { sock } from '../socketClient';

const props = defineProps<{
  logo: string;
  socket: sock
}>();

const leftDrawerOpen = ref(false);
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header
      elevated
      class="bg-grey-10 text-white"
      height-hint="98"
    >
      <q-toolbar>
        <q-btn
          dense
          flat
          round
          icon="menu"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <q-toolbar-title>
          <q-img
            :src="props.logo"
            width="40px"
            height="40px"
            fit="scale-down"
          />
          {{ $t('app.name.value') }}
        </q-toolbar-title>
      </q-toolbar>

      <q-tabs align="left">
        <q-route-tab
          :label="$t('searchMangas.tab.value')"
          @click="$q.dialog({component: searchMangas, componentProps: { socket }})"
        />
      </q-tabs>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      side="left"
      bordered
      :width="200"
      :breakpoint="700"
      class="bg-dark"
    >
      ij
      <!-- drawer content -->
    </q-drawer>

    <q-page-container />
  </q-layout>
</template>
<style lang="css">
  .drawer, aside {
    background-color: #ff9800!important;
  }
</style>
