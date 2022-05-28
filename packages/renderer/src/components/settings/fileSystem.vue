<script lang="ts" setup>
import { ref, computed, onBeforeMount } from 'vue';
import { useQuasar, format } from 'quasar';
import { useSocket } from '../helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';
import type { socketClientInstance } from '../../../../api/src/client/types';

const $q = useQuasar();
defineExpose({ $q });
const settings = useSettingsStore();
let socket:socketClientInstance|undefined;
const size = ref(0);
const files = ref<string[]>([]);

const humanreadable = computed(() => {
  return format.humanStorageSize(size.value);
});

function emptyCache() {
  socket?.emit('emptyCache', files.value);
  files.value = [];
  size.value = 0;
}

// get available mirrors before rendering and start the search if params are present
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getCacheSize', (length, f) => {
    size.value = length;
    files.value = f;
  });
});
</script>

<template>
  <q-list separator>
    <q-item
      v-ripple
      clickable
      @click="emptyCache"
    >
      <q-item-section avatar>
        <q-icon
          color="primary"
          name="cached"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>{{ $t('settings.cache') }}</q-item-label>
        <q-item-label
          caption
          lines="2"
        >
          <div>{{ humanreadable }}</div>
          <div class="text-grey">
            {{ files.length }} {{ $t('settings.file', files.length) }}
          </div>
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-icon
          color="negative"
          name="delete"
        />
      </q-item-section>
    </q-item>
  </q-list>
</template>
