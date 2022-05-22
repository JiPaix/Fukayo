<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
defineProps<{
  /** App's logo */
  logo: string;
}>();

const drawer = ref(false),
      miniState = ref(true),
      $q = useQuasar(),
      route = useRoute(),
      router = useRouter();

onBeforeMount(() => {
  if(!route.name) router.push({ name: 'home' });
});
</script>

<template>
  <q-layout view="hHh LpR fFf">
    <q-header
      elevated
      class="bg-grey-10 text-white"
      height-hint="98"
    >
      <q-toolbar>
        <q-toolbar-title>
          <q-img
            :src="logo"
            width="40px"
            height="40px"
            fit="scale-down"
          />
          {{ $t("app.name.value") }}
        </q-toolbar-title>
        <q-btn
          v-if="$q.screen.lt.md"
          dense
          flat
          round
          icon="menu"
          @click="drawer = !drawer"
        />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawer"
      show-if-above
      :side="$q.screen.lt.md ? 'right' : 'left'"
      :mini="miniState"
      :width="200"
      bordered
      class="bg-dark"
      @mouseover="miniState = false"
      @mouseout="miniState = true"
    >
      <q-scroll-area class="fit">
        <q-list padding>
          <q-item
            v-ripple
            clickable
            :active="route.name === 'home'"
            @click="router.push({ name: 'home' })"
          >
            <q-item-section avatar>
              <q-icon name="o_library_books" />
            </q-item-section>

            <q-item-section>
              {{ $t('library.tab.value') }}
            </q-item-section>
          </q-item>

          <q-item
            v-ripple
            clickable
            :active="route.name === 'explore' || route.name === 'explore_mirror'"
            @click="router.push({ name: 'explore' })"
          >
            <q-item-section avatar>
              <q-icon name="o_explore" />
            </q-item-section>

            <q-item-section>
              {{ $t('explore.tab.value') }}
            </q-item-section>
          </q-item>

          <q-item
            v-ripple
            clickable
            :active="route.name === 'search'"
            @click="router.push({ name: 'search' })"
          >
            <q-item-section avatar>
              <q-icon name="o_screen_search_desktop" />
            </q-item-section>

            <q-item-section>
              {{ $t('search.tab.value') }}
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item
            v-ripple
            clickable
            :active="route.name === 'settings'"
            @click="router.push({ name: 'settings' })"
          >
            <q-item-section avatar>
              <q-icon name="settings" />
            </q-item-section>

            <q-item-section>
              {{ $t('settings.tab.value') }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        class="row bg-dark"
      >
        <router-view />
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css">
  .drawer, aside {
    background-color: #ff9800!important;
  }
</style>
