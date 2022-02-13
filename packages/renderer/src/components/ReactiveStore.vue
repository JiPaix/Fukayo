<script lang="ts" setup>
import { ref } from 'vue';
import { useStore } from '/@/store/settings';
import { MutationTypes } from '/@/store/settings/mutations';
import { ActionTypes } from '../store/settings/actions';

const settings = useStore();
const name = ref('');

</script>

<template>
  <h1 @click="quit()">
    QUIT
  </h1>
  <p>
    user data:
    <code>
      {{ path }}
    </code>
  </p>
  <p>
    Name retrieved using getters: <b id="name">{{ settings.getters.nameWithMister }}</b>
  </p>
  <p>
    Load Another name using dispatch
    <button
      id="load-name"
      @click="settings.dispatch(ActionTypes.GET_NAME, 'John')"
    >
      LOAD
    </button>
  </p>

  <label for="name">
    Set Name using commit
    <input
      id="input-name"
      v-model="name"
      @input="settings.commit(MutationTypes.SET_NAME, name)"
    >
  </label>
  <br>
  <br>
  <code>packages/renderer/src/components/ReactiveStore.vue</code>
</template>
<script lang="ts">
export default {
  data() {
    return { path: '' };
  },
  created() {
    this.loadName();
  },
  methods: {
    loadName() {
      window.userData.configPath().then(path => {
        this.path = path;
      });
    },
    quit() {
      window.windowControl.quit();
    },
  },
};
</script>
