<script lang="ts" setup>
import { useStore } from '/@/store/settings';
import { ref } from 'vue';
const maximized = ref(false);
const control = window.windowControl;
const settings = useStore();

const maximize = () => {
  window.windowControl.maximize().then(v => {
    maximized.value = v;
  });
};

</script>
<template>
  <v-theme-provider
    theme="dark"
    with-background
    style="-webkit-app-region: drag"
  >
    <v-app-bar
      app
      flat
      height="28"
    >
      <v-app-bar-title>
        <v-img
          src="assets/icon_128.png"
          width="18"
        />
      </v-app-bar-title>

      <v-spacer />
      Some app
      <v-spacer />
      <v-btn
        class="mx-0 px-1"
        plain
        @click="settings.global.theme === 'light' ? settings.global.theme = 'dark' : settings.global.theme = 'light'"
      >
        <v-icon
          icon="mdi-theme-light-dark"
          color="yellow"
        />
      </v-btn>
      <v-btn
        class="mx-0 px-1"
        plain
        size="x-small"
      >
        <v-icon
          icon="mdi-window-minimize"
          @click="control.minimize()"
        />
      </v-btn>
      <v-btn
        class="mx-0 px-1"
        plain
        size="x-small"
      >
        <v-icon
          :icon="maximized ? 'mdi-window-restore' : 'mdi-window-maximize'"
          @click="maximize()"
        />
      </v-btn>
      <v-btn
        class="mx-0 px-1"
        plain
        size="x-small"
      >
        <v-icon
          icon="mdi-window-close"
          @click="control.quit()"
        />
      </v-btn>
    </v-app-bar>
  </v-theme-provider>
</template>
<style scoped>
.v-app-bar {
  user-select: none;
  -webkit-user-select: none;
  -webkit-app-region: drag;
}
.v-app-bar .v-btn {
  -webkit-app-region: no-drag;
}
</style>
