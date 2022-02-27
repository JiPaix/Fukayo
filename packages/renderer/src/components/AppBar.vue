<script lang="ts" setup>
import { useStore } from '/@/store/settings';

const settings = useStore();
</script>
<template>
  <v-theme-provider
    theme="dark"
    with-background
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
        />
      </v-btn>
      <v-btn
        class="mx-0 px-1"
        plain
        size="x-small"
      >
        <v-icon
          icon="mdi-window-maximize"
        />
      </v-btn>
      <v-btn
        class="mx-0 px-1"
        plain
        size="x-small"
      >
        <v-icon
          icon="mdi-window-close"
        />
      </v-btn>
    </v-app-bar>
  </v-theme-provider>
</template>
