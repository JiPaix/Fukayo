<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import { useStore as useSettingsStore } from '/@/store/settings';
import { useI18n } from 'vue-i18n';
import { useSocket } from './components/helpers/socket';
import { useFavicon } from '@vueuse/core';
import setupPage from '/@/components/setupPage.vue';
import loginPage from '/@/components/loginPage.vue';
import mainPage from '/@/components/mainPage.vue';
import favicon from '../assets/icon.svg';
import type { authByLogin } from './components/helpers/socket';

/** vue-i18n */
const $t = useI18n().t.bind(useI18n());
/** load favicon */
useFavicon(favicon); // change favicon
/** stored settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();
$q.dark.set(true);
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
async function connect(auth?: authByLogin, beforeMount?: boolean) {
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
        message: $t('setup.error.value'),
        caption: typeof e === 'string' ? e : $t('setup.error.unexpectedError.value'),
        color: 'negative',
      });
    }
  }
}

/**
 * try to connect non-electron browser to the websocket server using stored credentials
 */
onBeforeMount(()=> {
  connect(undefined, true);
});
</script>
<template>
  <q-layout dark>
    <q-page-container>
      <q-page dark>
        <div v-if="!loading">
          <div v-if="!connected">
            <!-- Setup page if client is electron -->
            <setupPage
              v-if="isElectron"
              @done="connect"
            />
            <!-- Login page if client is not electron -->
            <loginPage
              v-else
              :bad-password="badPassword"
              @done="connect"
            />
          </div>
          <!-- Main page once client is connected -->
          <mainPage
            v-else-if="connected"
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

