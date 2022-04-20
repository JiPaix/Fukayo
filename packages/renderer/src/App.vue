<script lang="ts" setup>
  import { ref } from 'vue';
  import { useQuasar } from 'quasar';
  import { useStore as useSettingsStore } from '/@/store/settings';
  import setupPage from '/@/components/setupPage.vue';
  import loginPage from '/@/components/loginPage.vue';
  import mainPage from '/@/components/mainPage.vue';
  import { useFavicon } from '@vueuse/core';
  import favicon from '../assets/icon.svg';
  import { socketManager } from '/@/socketClient';
  import type { sock} from '/@/socketClient';
  import type { authByLogin } from './components/helpers/login';


  useFavicon(favicon); // change favicon

  // load settings
  const settings = useSettingsStore();

  // load quasar, and show loading screen
  const $q = useQuasar();
  $q.dark.set(true);
  $q.loading.hide();
  const loading = ref(false);

  // helpers
  const isBrowser = typeof window.apiServer === 'undefined' ? true : false;

  // watchers for socket connection
  const badPassword = ref(false);
  const connected = ref(false);



const socket = ref<sock|undefined>();
  // connect to socket server with login and password or token if exists
  const useSocket = (auth?: authByLogin) => {
    $q.loading.show();
    const loading = ref(true);

    socketManager(settings.server).connect(auth).then((sock)=> {
      socket.value = sock;
      connected.value = true;
      badPassword.value = false;
      $q.loading.hide();
      loading.value = false;
    }).catch(r => {
      $q.loading.hide();
      loading.value = false;
      if(r === 'badpassword') {
        badPassword.value = true;
      } else {
        badPassword.value = false;
      }
    });

  };



</script>
<template>
  <q-layout dark>
    <q-page-container>
      <q-page dark>
        <div v-if="!loading">
          <div v-if="!connected">
            <!-- Login page if client is not electron -->
            <loginPage
              v-if="isBrowser"
              :bad-password="badPassword"
              @done="useSocket"
            />
            <!-- Setup page if client is electron -->
            <setupPage
              v-else
              @done="useSocket"
            />
          </div>
          <mainPage
            v-else-if="connected && typeof socket !== 'undefined'"
            :logo="favicon"
            :socket="socket"
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
  .cursor-pointer {
    cursor: pointer;
  }
</style>

