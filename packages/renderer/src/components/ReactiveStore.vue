<script lang="ts" setup>
import { ref } from 'vue';
import { useStore } from '/@/store/settings';
import { MutationTypes } from '/@/store/settings/mutations';
import { ActionTypes } from '../store/settings/actions';

const settings = useStore();
const name = ref('');

</script>

<template>
  <p>
    user data path:
    <code>
      {{ settings.state.userDataPath }}
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
