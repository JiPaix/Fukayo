<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { format, useQuasar } from 'quasar';
import { computed, onBeforeMount, ref } from 'vue';

const $q = useQuasar();
const settings = useSettingsStore();
let socket:socketClientInstance|undefined;
const size = ref(0);
const files = ref(0);

const humanreadable = computed(() => {
  return format.humanStorageSize(size.value);
});

function emptyCache() {
  socket?.emit('emptyCache');
  files.value = 0;
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
      :dark="$q.dark.isActive"
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
            {{ files }} {{ $t('settings.file', files) }}
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
