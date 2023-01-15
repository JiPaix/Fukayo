<script lang="ts" setup>
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { format, useQuasar } from 'quasar';
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// config
const
/** quasar */
$q = useQuasar(),
/** settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// states
const
/** cache size in bytes */
size = ref(0),
/** number of files present in cache */
files = ref(0);

// computed
const
/** cache size in a human readable string */
humanreadable = computed(() => {
  return format.humanStorageSize(size.value);
});

async function emptyCache() {
  const socket = await useSocket(settings.server);
  socket.emit('emptyCache');
  files.value = 0;
  size.value = 0;
}

/** get the cache size and nb of files */
async function On() {
  const socket = await useSocket(settings.server);
  socket.emit('getCacheSize', (length, f) => {
    size.value = length;
    files.value = f;
  });
}

onBeforeMount(On);
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
