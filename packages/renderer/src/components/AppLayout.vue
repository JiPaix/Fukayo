<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import QuickAdd from './dialogs/QuickAdd.vue';
import { useSocket } from './helpers/socket';
import { useStore as useSettingsStore } from '../store/settings';
import type { socketClientInstance } from '../../../api/src/client/types';

defineProps<{
  /** App's logo */
  logo: string;
}>();

let socket:socketClientInstance|undefined;

const drawer = ref(false),
      miniState = ref(true),
      quick = ref(false),
      $q = useQuasar(),
      route = useRoute(),
      router = useRouter(),
      settings = useSettingsStore();
// are mangas updating in the background?
const updating = ref(true);

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

onBeforeMount(async () => {
  if(!route.name) router.push({ name: 'home' });
  if(!socket) socket = await useSocket(settings.server);
  socket.on('startMangasUpdate', () => {
    updating.value = true;
  });
  socket.emit('isUpdating', (resp) => {
    updating.value = resp;
  });
  socket.on('finishedMangasUpdate', () => {
    setTimeout(() => {
      updating.value = false;
    }, 1000);
  });
});




async function forceupdate() {
  updating.value = true;
  if(!socket) socket = await useSocket(settings.server);
  socket?.emit('forceUpdates');
}

function toggleDarkMode() {
  if (settings.theme === 'dark') {
    settings.theme = 'light';
    $q.dark.set(false);
  } else {
    settings.theme = 'dark';
    $q.dark.set(true);
  }
}
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
          dense
          flat
          round
          icon="contrast"
          @click="toggleDarkMode"
        />
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
      :dark="$q.dark.isActive"
      show-if-above
      :side="$q.screen.lt.md ? 'right' : 'left'"
      :mini="miniState"
      :width="200"
      bordered
      :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
      @mouseover="miniState = false"
      @mouseout="miniState = true"
    >
      <q-scroll-area
        class="fit"
        :dark="$q.dark.isActive"
      >
        <q-list
          padding
          :dark="$q.dark.isActive"
        >
          <q-item
            v-ripple
            clickable
            :active="route.name === 'home'"
            :dark="$q.dark.isActive"
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
            :dark="$q.dark.isActive"
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
            :dark="$q.dark.isActive"
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
            :dark="$q.dark.isActive"
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
          <q-separator :dark="$q.dark.isActive" />
          <q-item
            v-ripple
            :dark="$q.dark.isActive"
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
          <q-separator :dark="$q.dark.isActive" />
          <q-item
            v-ripple
            :dark="$q.dark.isActive"
            :clickable="!updating"
            :disable="updating"
            @click="forceupdate"
          >
            <q-item-section avatar>
              <q-icon
                v-if="!updating"
                name="refresh"
              />
              <q-spinner
                v-else
                color="primary"
                size="sm"
              />
            </q-item-section>

            <q-item-section>
              {{ $t('mangas.forceupdate') }}
            </q-item-section>
          </q-item>
          <q-item
            v-ripple
            :dark="$q.dark.isActive"
            clickable
            :active="route.name === 'logs'"
            @click="router.push({ name: 'logs' })"
          >
            <q-item-section avatar>
              <q-icon name="timeline" />
            </q-item-section>

            <q-item-section>
              {{ $t('settings.logs') }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        class="row"
        :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-2'"
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
