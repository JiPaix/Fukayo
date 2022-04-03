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
  import type { authByLogin } from './components/helpers/login';


  useFavicon(favicon); // change favicon

  // load settings
  const settings = useSettingsStore();

  // load quasar, and show loading screen
  const $q = useQuasar();
  $q.dark.set(true);
  $q.loading.show();
  const loading = ref(true);

  // helpers
  const isBrowser = typeof window.apiServer === 'undefined' ? true : false;

  // watchers for socket connection
  const badPassword = ref(false);
  const connected = ref(false);

  // connect to socket server with login and password or token if exists
  const useSocket = (auth?: authByLogin) => {
    const sock = socketManager(settings.server).connect(auth);

    sock.on('connect', () => {
      connected.value = true;
      badPassword.value = false;
      $q.loading.hide();
      loading.value = false;
    });


    sock.on('connect_error', (e) => {
      if(e.message === 'unauthorized') {
        // bad password or token (need to login again)
        badPassword.value = true;
      }
      connected.value = false;
      // hide loading screen
      $q.loading.hide();
      loading.value = false;
    });

    sock.on('disconnect', () => connected.value = false);

    // refresh token is only sent on login
    sock.on('refreshToken', (t) => settings.server.refreshToken = t);

    // token is sent on login and on refresh
    sock.on('token', (t) => settings.server.accessToken = t);
    return sock;
  };

  // attempt to login with localStorage token
  let socket = useSocket();

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
              @done="socket = useSocket($event)"
            />
            <!-- Setup page if client is electron -->
            <setupPage
              v-else
              @done="socket = useSocket()"
            />
          </div>
          <mainPage
            v-else
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
</style>

