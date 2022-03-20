<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useStore } from '/@/store/settings';
  import setupMenu from '/@/components/setupMenu.vue';
  import theWorld from '/@/components/theWorld.vue';
  const settings = useStore();
  const showSetup = ref(true);

  const showTheWorld = ref(false);

  watch(showSetup, (val) => {
    if(val === false) {
      setTimeout(() => {
        showTheWorld.value = true;
      }, 0);
    }
  });
</script>
<template>
  <v-app
    :theme="settings.theme"
    style="min-height: 100hv!important;"
  >
    <v-main>
      <v-container
        :fluid="showTheWorld"
      >
        <v-expand-transition>
          <setupMenu
            v-if="showSetup"
            @done="showSetup = false"
          />
        </v-expand-transition>
        <theWorld
          v-if="showTheWorld"
        />
      </v-container>
    </v-main>
  </v-app>
</template>

<style lang="css">
  html, body {
    overflow: auto!important;
  }
  .v-application {
    min-height: 100vh!important;
  }
  .v-field__input {
  color: inherit;
}
</style>

