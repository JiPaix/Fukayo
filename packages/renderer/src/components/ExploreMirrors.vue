<script lang="ts" setup>
import { ref, computed, onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';
import type { socketClientInstance } from '../../../api/src/client/types';
import type { mirrorInfo } from '../../../api/src/models/types/shared';
import { useSocket } from './helpers/socket';
import { useStore as useSettingsStore } from '/@/store/settings';

const router = useRouter();
/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;

/** Mirrors info as retrieved from the server*/
const mirrorsRAW = ref<mirrorInfo[]>([]);

const mirrors = computed(() => {
  const enabled = mirrorsRAW.value.filter(mirror => mirror.enabled);
  return enabled;
});

// get available mirrors before rendering and start the search if params are present
onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getMirrors', (m) => {
    mirrorsRAW.value = m.sort((a, b) => a.name.localeCompare(b.name));
  });
});

</script>
<template>
  <q-list
    class="w-100 q-mt-md"
    separator
  >
    <q-item
      v-for="mirror in mirrors"
      :key="mirror.name"
      v-ripple
      class="q-mx-md q-my-xs"
      clickable
      :dark="settings.theme.includes('dark')"
      @click="router.push({
        name: 'explore_mirror',
        params: {
          mirror: mirror.name,
        },
      })"
    >
      <q-item-section avatar>
        <q-icon
          color="primary"
          :name="'img:'+mirror.icon"
        />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ mirror.displayName }}</q-item-label>
        <q-item-label
          caption
          lines="2"
        >
          <div>
            {{ mirror.host }}
          </div>
          <div class="flex q-mt-xs">
            <div
              v-for="lang in mirror.langs"
              :key="lang"
              class="fi"
              :class="'fi-'+$t('languages.'+lang+'.flag')"
              style="width:16px;"
            />
          </div>
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

