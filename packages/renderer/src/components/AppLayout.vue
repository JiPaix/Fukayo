<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import QuickAdd from './dialogs/QuickAdd.vue';

defineProps<{
  /** App's logo */
  logo: string;
}>();

const drawer = ref(false),
      miniState = ref(true),
      quick = ref(false),
      $q = useQuasar(),
      route = useRoute(),
      router = useRouter();

defineExpose({ $q });

// quick add dialog
function quickadd() {
  quick.value = true;
  $q.dialog({
    component: QuickAdd,
  })
  .onCancel(()=> quick.value = false)
  .onDismiss(()=> quick.value = false)
  .onOk((manga:{mirror:string, lang:string, url:string}) => {
    const { mirror, lang, url } = manga;
    if(route.name === 'manga') router.replace({ name: 'manga', params: { mirror, lang, url } });
    else router.push({ name: 'manga', params: { mirror, lang, url } });
  });
}

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
          {{ $t('app.name') }}
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
              {{ $t('library.tab') }}
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
              {{ $t('explore.tab') }}
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
              {{ $t('search.tab') }}
            </q-item-section>
          </q-item>

          <q-item
            v-ripple
            clickable
            :active="route.name === 'quick'"
            @click="quickadd"
          >
            <q-item-section avatar>
              <q-icon name="electric_bolt" />
            </q-item-section>

            <q-item-section>
              {{ $t('dialog.quickadd.tab') }}
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
              {{ $t('settings.tab') }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        class="row bg-dark"
      >
        <router-view :key="route.fullPath" />
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css">
  .drawer, aside {
    background-color: #ff9800!important;
  }
</style>
