<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useI18n } from 'vue-i18n';
import { useSocket } from './components/helpers/socket';
import { useFavicon } from '@vueuse/core';
import Setup from '/@/components/setup/App.vue';
import Login from '/@/components/login/App.vue';
import AppLayout from '/@/components/AppLayout.vue';
import favicon from '../assets/icon.svg';
import type { LoginAuth } from '../../api/src/client/types';

/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** load favicon */
useFavicon(favicon); // change favicon
/** stored settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();
$q.dark.set(settings.theme === 'dark');
$q.loading.hide();
const loading = ref(false);

/** is client using electron? */
const isElectron = typeof window.apiServer !== 'undefined' ? true : false;
/** display a 'bad password' message in child component */
const badPassword = ref(false);
/** are we logged in? */
const connected = ref(false);

/**
 * Connect to the websocket server
 * @param {authByLogin} auth user login and password
 * @param beforeMount weither or not the function was called by vue itself
 */
async function connect(auth?: LoginAuth, beforeMount?: boolean) {
  $q.loading.show();
  loading.value = true;
  try {
    await useSocket(settings.server, auth);
    connected.value = true;
    badPassword.value = false;
    loading.value = false;
    $q.loading.hide();
  } catch(e) {
    $q.loading.hide();
    loading.value = false;
    if(e === 'badpassword') badPassword.value = true;
    else {
      badPassword.value = false;
      // do not show error if we connect wasn't explicitly called by the user
      if(beforeMount) return;
      $q.notify({
        message: $t('setup.error'),
        caption: typeof e === 'string' ? e : $t('setup.unexpectederror'),
        color: 'negative',
      });
    }
  }
}

/**
 * try to connect non-electron browser to the websocket server using stored credentials
 */
onBeforeMount(()=> {
  if(!isElectron) {
    const [host, port] = new URL(window.location.href).host.split(':');
    settings.server.hostname = host;
    settings.server.port = parseInt(port);
  }
  connect(undefined, true);
});
</script>
<template>
  <q-layout>
    <q-page-container>
      <q-page>
        <div v-if="!loading">
          <div v-if="!connected">
            <!-- Setup page if client is electron -->
            <setup
              v-if="isElectron"
              @done="connect"
            />
            <!-- Login page if client is not electron -->
            <login
              v-else
              :bad-password="badPassword"
              @done="connect"
            />
          </div>
          <!-- Main page once client is connected -->
          <app-layout
            v-else
            :logo="favicon"
          />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css">
  html, body {
    overflow: auto!important;
  }
  .w-100 {
    width: 100%!important;
  }
  .w-50 {
    width: 50%!important;
  }
  .cursor-pointer {
    cursor: pointer;
  }
</style>

