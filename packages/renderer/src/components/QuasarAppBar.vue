<script lang="ts" setup>

</script>
<template>
  <div class="q-pa-md q-gutter-sm">
    <div class="q-pa-md q-gutter-sm">
      <q-banner
        rounded
        class="bg-purple-8 text-white"
      >
        that's a v-card replacement using quasar

        <template #action>
          <q-btn
            flat
            color="white"
            label="Continue as a Guest"
          />
          <q-btn
            flat
            color="white"
            label="Sign in"
          />
        </template>
      </q-banner>
    </div>

    <q-bar class="bg-black text-white">
      <div class="cursor-pointer">
        File
      </div>
      <div class="cursor-pointer">
        Edit
      </div>
      <div class="cursor-pointer gt-xs">
        View
      </div>
      <div class="cursor-pointer gt-xs">
        Window
      </div>
      <div class="cursor-pointer">
        Help
      </div>
      <q-space />
      <q-btn
        dense
        flat
        icon="minimize"
      />
      <q-btn
        dense
        flat
        icon="crop_square"
      />
      <q-btn
        dense
        flat
        icon="close"
      />
    </q-bar>
    <br>
    <br>
    <code>packages/renderer/src/components/QuasarAppBar.vue</code>
  </div>
</template>
