<script lang="ts" setup>
import type { LoginAuth } from '@api/client/types';
import favicon from '@assets/icon.svg';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import AppLayout from '@renderer/components/AppLayout.vue';
import { useSocket } from '@renderer/components/helpers/socket';
import { isFullScreen, toggleFullScreen } from '@renderer/components/helpers/toggleFullScreen';
import Login from '@renderer/components/login/App.vue';
import Setup from '@renderer/components/setup/App.vue';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { useFavicon } from '@vueuse/core';
import { Loading, QSpinnerRadio, useQuasar } from 'quasar';
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// settings
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** stored settings */
settings = useSettingsStore();

// globals
const
/** is client using electron? */
isElectron = typeof window.apiServer !== 'undefined' ? true : false;

// states
const
/** show connection circulare progress */
loading = ref(false),
/** display a 'bad password' message in child component */
badPassword = ref(false),
/** are we logged in? */
connected = ref(false);


/** Display a full screen spinner waiting for internet connection */
function waitForConnectivity() {
  Loading.show({
    spinner: QSpinnerRadio,
    boxClass: 'fullscreen bg-dark',
    backgroundColor: 'dark',
    customClass: 'loader',
    group: 'connectivity',
    message: `${$t('app.loading.checking_internet')}<br/><span class="text-amber text-italic">${$t('app.loading.checking_internet_takes_a_while')}</span>`,
    messageColor: 'orange-2',
    html: true,
  });
}

/** call `waitForConnectivity` and display another full screen spinner waiting for the API to start */
function waitForStart() {
  waitForConnectivity();
  Loading.show({
    boxClass: 'fullscreen bg-dark',
    backgroundColor: 'dark',
    customClass: 'loader',
    group: 'start',
    message: `${$t('app.loading.initializing')}<br/><span class="text-amber text-italic">${$t('app.loading.please_wait')}</span>`,
    messageColor: 'orange-2',
    html: true,
  });
}

/**
 * Connect to the websocket server
 * @param {authByLogin} auth user login and password
 * @param beforeMount weither or not the function was called by vue itself
 */
async function connect(auth?: LoginAuth, beforeMount?: boolean):Promise<unknown> {
  Loading.hide('start');
  loading.value = false;
  badPassword.value = false;
  waitForConnectivity();

  let socket: Awaited<ReturnType<typeof useSocket>> | undefined;
  try {
    socket = await useSocket(settings.server, auth);
    connected.value = true;
    badPassword.value = false;
    socket.on('connectivity', (value) => {
      if(value) Loading.hide('connectivity');
      else waitForConnectivity();
    });
  } catch(e) {
    if(socket) socket.off('connectivity');
    if(isElectron && !beforeMount) return setTimeout(() => connect(auth, beforeMount), 1000);
    Loading.hide();
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



function listenFullScreenEvents() {
  if(!isElectron) watch(() => $q.fullscreen.isActive, val => isFullScreen.value = val);
  else window.apiServer.onFullScreen(fs => isFullScreen.value = fs);

  document.addEventListener('keyup', e => {
    if(e.key !== 'F11') return;
    e.preventDefault();
    return toggleFullScreen();
  }, { passive: false });
}

/**
 * try to connect non-electron browser to the websocket server using stored credentials
 */
function On() {
  listenFullScreenEvents();
  if(!isElectron) {
    const [host, port] = new URL(window.location.href).host.split(':');
    settings.server.ssl = new URL(window.location.href).protocol === 'https:' ? 'app' : 'false';
    settings.server.hostname = settings.server.ssl === 'false' ? 'http://' : 'https://' + host;
    settings.server.port = parseInt(port);
  }
  waitForStart();
  connect(undefined, true);
}


/** load favicon */
useFavicon(favicon); // change favicon
/** define dark/light mode */
$q.dark.set(settings.theme === 'dark');
/** hide initial spinner */
$q.loading.hide();

onBeforeMount(On);
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
              @loading="waitForStart"
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
  .loader > .q-loading__box {
    justify-content: center;
  }
</style>

