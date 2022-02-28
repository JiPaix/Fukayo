<script lang="ts" setup>
  import ElectronVersions from '/@/components/ElectronVersions.vue';
  import AppBarVue from '/@/components/AppBar.vue';
  import { useStore } from '/@/store/settings';

  const settings = useStore();
  const isElectron = window.windowControl !== undefined;
  const versions = isElectron && window.versions !== undefined;
</script>
<template>
  <v-app :theme="settings.global.theme">
    <AppBarVue v-if="isElectron" />
    <!-- Sizes your content based upon application components -->
    <v-main>
      <!-- Provides the application the proper gutter -->
      <h1>{{ $t('homepage.hello') }}</h1>
      <fieldset>
        <legend>Environment</legend>
        <electron-versions v-if="versions" />
      </fieldset>

      <!-- <h1>{{ $t('homepage.hello') }}</h1>
        <fieldset>
          <legend>Vuex</legend>
          <ReactiveCounter />
        </fieldset>

        <fieldset>
          <legend>Test Node.js API</legend>
          <reactive-hash />
        </fieldset>


        <p>
          Edit
          <code>packages/renderer/src/App.vue</code> to test hot module replacement.
        </p> -->
    </v-main>
  </v-app>
</template>
<style>
html, body {
  overflow-y: hidden!important;
}
body {
  margin: 0;
  padding: 0;
}
.v-app-bar {
  padding: 0!important;
}
.v-container {
  overflow: auto;
  position: absolute;
  height: 100%;
}
</style>
<style scoped>
fieldset {
  margin: 2rem;
  padding: 1rem;
}

</style>
