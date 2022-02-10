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
    Name retrieved using getters: <b id="name">{{ settings.getters.nameWithMister }}</b>
  </p>
  <p>
    Load Another name using dispatch
    <q-btn
      id="load-name"
      size="sm"
      label="LOAD"
      @click="settings.dispatch(ActionTypes.GET_NAME, 'John')"
    />
  </p>

  <q-input
    v-model="name"
    label="use commit to change name"
  >
    <template #after>
      <q-btn
        round
        dense
        flat
        icon="send"
        @click="settings.commit(MutationTypes.SET_NAME, name)"
      />
    </template>
  </q-input>
  <br>
  <br>
  <code>packages/renderer/src/components/ReactiveCounter.vue</code>
</template>
