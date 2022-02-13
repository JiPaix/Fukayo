<script lang="ts" setup>
  import ReactiveCounter from './components/ReactiveStore.vue';
  import ReactiveHash from '/@/components/ReactiveHash.vue';
  import ElectronVersions from '/@/components/ElectronVersions.vue';
</script>
<template>
  <h1>{{ $t('homepage.hello') }}</h1>
  <fieldset>
    <legend>Vuex</legend>
    <ReactiveCounter />
  </fieldset>

  <fieldset>
    <legend>Test Node.js API</legend>
    <reactive-hash />
  </fieldset>

  <fieldset>
    <legend>Environment</legend>
    <electron-versions />
  </fieldset>
  <p>
    Edit
    <code>packages/renderer/src/App.vue</code> to test hot module replacement.
  </p>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 60px auto;
  max-width: 700px;
}
fieldset {
  margin: 2rem;
  padding: 1rem;
}
</style>
