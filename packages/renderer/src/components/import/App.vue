<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type Importer from '@api/models/imports/interfaces';
import type { ImportResults } from '@api/models/imports/types';
import type { importErrorMessage } from '@api/models/types/errors';
import type en from '@i18n/../locales/en.json';
import type { appLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import { useSocket } from '@renderer/components/helpers/socket';
import { isImportErrorMessage, isManga, isMangaInDB, isTaskDone } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import type { QTableProps } from 'quasar';
import { QTable, useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { transformIMGurl } from '../helpers/transformIMGurl';
import { useRouter } from 'vue-router';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';

/** settings */
const settings = useSettingsStore();
/** quasar */
const $q = useQuasar();
/** vue-i18n */
const $t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
/** router */
const router = useRouter();
/** socket */
let socket:socketClientInstance|undefined;
/** list of importers */
const importers = ref<Importer['showInfo'][]>([]);
/** list of importers that need configuration */
const disabledimporters = ref<Importer['showInfo'][]>([]);
/** selected importer */
const currentImporter = ref<Importer['showInfo']|null>(null);
/** list of mangas */
const mangas = ref<ImportResults[]>([]);
/** errors */
const error = ref<null|importErrorMessage>(null);
/** loading mangas */
const loading = ref(false);
/** importing to db */
const importing = ref(false);
/** nb of expected results */
const expected = ref(0);
/** table pagination */
const pagination = ref({rowsPerPage: 0});
/** selected mangas in table */
const selection = ref<ImportResults[]>([]);
/** show/hide the dialog */
const showDialog = ref(false);
/** table elem */
const table = ref<QTable>();
/** fetch progress */
const progress = computed(() => {
  return Math.round((mangas.value.length*expected.value) / 100);
});
/** table column */
const columns:QTableProps['columns'] = [
  {
    name: 'covers',
    label: 'cover',
    align: 'left',
    field: (row:ImportResults) => row.covers,
    sortable: false,
  },
  {
    name: 'name',
    required: true,
    label: 'name',
    align: 'left',
    field: (row:ImportResults) => row.name,
    sortable: true,
  },
  {
    name: 'inLibrary',
    required: true,
    label: 'in library',
    align: 'right',
    field: (row:ImportResults) => row.inLibrary,
    format: val => `${val}`,
    sortable: true,
  },
];

onBeforeMount(async () => {
  await On();
});

onBeforeUnmount(async () => {
  await Off();
});

watch(showDialog, async (nval) => {
  if(!nval) {
    if(!socket) socket = await useSocket(settings.server);
    socket.removeAllListeners('showImports');
    socket.emit('stopShowImports');
    selection.value = [];
    mangas.value = [];
  }
});

async function Off() {
  if(!socket) socket = await useSocket(settings.server);
  socket.removeAllListeners('showImports');
  socket.removeAllListeners('showManga');
  socket.emit('stopShowImports');
}

async function On() {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('getImports', true, (imps) => {
    imps.forEach(im=> {
      if(im.enabled) importers.value.push(im);
      else disabledimporters.value.push(im);
    });
  });
}

async function getMangas(importer: Importer['showInfo']) {
  mangas.value = [];
  error.value = null;
  expected.value = 0;
  loading.value = true;
  showDialog.value = true;
  importing.value = false;
  currentImporter.value = importer;
  if(!socket) socket = await useSocket(settings.server);
  const reqId = Date.now();
  socket.emit('showImports',reqId, importer.name, mirrorsLang.filter(l=> !settings.i18n.ignored.includes(l)));
  socket.on('showImports', (id, resp) => {
    if(reqId !== id) return;
    if(typeof resp === 'number') expected.value = resp;
    else if(isImportErrorMessage(resp)) {
      error.value = resp;
      socket?.removeAllListeners('showImports');
    }
    else if (isTaskDone(resp)) {
      expected.value = 100;
      loading.value = false;
      socket?.removeAllListeners('showImports');
    } else {
      if(Array.isArray(resp)) resp.forEach(r => mangas.value.push(r));
      else mangas.value.push(resp);
    }
  });
}

async function startImport() {
  const reqId = Date.now();
  let counter = selection.value.length;
  importing.value = true;
  if(!socket) socket = await useSocket(settings.server);
  selection.value.filter(s=> !s.inLibrary).forEach((s) =>{
    socket?.emit('showManga', reqId, { mirror: s.mirror.name, langs: mirrorsLang.filter(l=> !settings.i18n.ignored.includes(l)), url: s.url});
  });
  socket.on('showManga', (id, manga) => {
    if(id!==reqId) return;
    if(isManga(manga)) {
      if(isMangaInDB(manga)) {
        selection.value = selection.value.filter(v => v.url !== manga.url);
        counter = counter-1;
        if(counter === 0) importing.value = false;
        const mg = mangas.value.find(v => v.url === manga.url);
        if(mg) mg.inLibrary = true;
      } else {
        socket?.emit('addManga', { manga }, (res => {
          selection.value = selection.value.filter(v => v.url !== res.url);
          counter = counter-1;
          if(counter === 0) importing.value = false;
          const mg = mangas.value.find(v => v.url === res.url);
          if(mg) mg.inLibrary = true;
        }));
      }

    } else {
      counter = counter-1;
      if(counter === 0) importing.value = false;
    }
  });
}

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-50)+'px'"
    class="shadow-2"
    :class="$q.dark.isActive ? 'bg-dark text-white' : 'bg-grey-2 text-black'"
  >
    <q-page-container>
      <q-page class="w-100 q-pa-md">
        <div class="flex column">
          <span class="text-h2">{{ $t('import.title') }}</span>
          <span class="text-caption">{{ $t('import.subtitle') }}</span>
        </div>
        <div
          class="row q-mt-xl"
        >
          <q-expansion-item
            v-if="importers && importers.length"
            class="w-100 shadow-2"
            :label="$t('import.active_sources')"
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
          >
            <q-list
              :dark="$q.dark.isActive"
              separator
            >
              <q-item
                v-for="importer in importers"
                :key="importer.name"
                style="background:rgba(255, 255, 255, 0.3)"
                :class="$q.dark.isActive ? '' : 'bg-white'"
                clickable
                @click="getMangas(importer)"
              >
                <q-item-section>
                  <q-item-label class="text-h6">
                    <q-icon
                      size="lg"
                      :name="'img:'+importer.icon"
                    />
                    {{ importer.displayName }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
          <q-expansion-item
            v-if="disabledimporters && disabledimporters.length"
            class="w-100 shadow-2"
            :label="$t('import.sources_config_required')"
            :dark="$q.dark.isActive"
            :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
          >
            <q-list
              :dark="$q.dark.isActive"
              separator
            >
              <q-item
                v-for="importer in disabledimporters"
                :key="importer.name"
                style="background:rgba(255, 255, 255, 0.3)"
                :class="$q.dark.isActive ? '' : 'bg-white'"
                clickable
                @click="router.push(routeTypeHelper('settings', { tab: 'sources' }))"
              >
                <q-item-section>
                  <q-item-label class="text-h6">
                    <q-icon
                      size="lg"
                      :name="'img:'+importer.icon"
                    />
                    {{ importer.displayName }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
          <q-dialog
            v-model="showDialog"
            full-width
          >
            <q-table
              v-if="!error"
              ref="table"
              v-model:selected="selection"
              v-model:pagination="pagination"
              card-class="shadow-3"
              class="q-mt-md"
              :rows="mangas"
              :columns="columns"
              selection="multiple"
              binary-state-sort
              row-key="name"
              dense
              :loading="loading"
              virtual-scroll
              :rows-per-page-options="[0]"
              column-sort-order="ad"
            >
              <template #loading>
                <q-linear-progress
                  :loading="loading"
                  color="orange"
                  :value="progress"
                />
              </template>
              <template #top>
                <div
                  v-if="currentImporter"
                  class="flex"
                >
                  <q-chip
                    :color="$q.dark.isActive ? 'grey-9' : 'grey-3'"
                    size="xl"
                  >
                    <q-avatar
                      :icon="'img:'+currentImporter.icon"
                      size="xl"
                    />
                    <span class="text-h6">{{ currentImporter.displayName }}</span>
                  </q-chip>
                </div>

                <q-btn
                  color="orange"
                  size="lg"
                  class="q-ml-auto q-mb-lg q-mt-sm"
                  :disable="!selection.length"
                  :label="$t('import.start_import')"
                  :loading="importing"
                  @click="startImport"
                />
              </template>
              <template #header="props">
                <q-tr
                  :props="props"
                >
                  <q-th
                    key="select"
                    class="text-left"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-3'"
                  >
                    <q-checkbox
                      :model-value="props.selected"
                      @update:model-value="props.selected = !props.selected"
                    />
                  </q-th>
                  <q-th
                    v-for="col in props.cols"
                    :key="col.name"
                    :props="props"
                    class="text-orange text-uppercase"
                    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-3'"
                    :style="col.name === 'covers' ? 'text-align: center!important;': ''"
                  >
                    {{ col.label }}
                  </q-th>
                </q-tr>
              </template>
              <template #body="props">
                <q-tr
                  :props="props"
                  @click="mangas.find(m=>m.name === props.row.name && m.inLibrary === false) ? props.selected = !props.selected : null"
                >
                  <q-td>
                    <q-checkbox
                      v-if="mangas.find(m=>m.name === props.row.name && m.inLibrary === false)"
                      :model-value="props.selected"
                      @update:model-value="props.selected = !props.selected"
                    />
                  </q-td>
                  <q-td
                    key="covers"
                    :props="props"
                  >
                    <q-img :src="transformIMGurl(props.row.covers[0], settings)" />
                  </q-td>
                  <q-td
                    key="name"
                    :props="props"
                  >
                    <span class="text-body1">{{ props.row.name }}</span>
                  </q-td>
                  <q-td
                    key="inLibrary"
                    :props="props"
                  >
                    <span
                      v-if="props.row.inLibrary"
                      class="text-body1 text-positive"
                    >
                      {{ $t('import.in_library') }}
                    </span>
                    <span
                      v-else
                      class="text-body1 text-negative"
                    >
                      {{ $t('import.not_in_library') }}
                    </span>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
            <div v-else>
              <q-banner
                class="text-white bg-negative q-mx-lg"
              >
                <template #avatar>
                  <q-icon
                    name="signal_wifi_off"
                    color="white"
                  />
                </template>
                <p class="text-h5">
                  {{ $t('import.failed') }}:
                </p>
                <span class="text-caption">{{ error.trace === 'unauthorized' ? $t('import.unauthorized') : error.trace || error.error }}</span>
                <template #action>
                  <q-btn
                    flat
                    color="white"
                    :label="$t('import.close')"
                    @click="showDialog = false"
                  />
                </template>
              </q-banner>
            </div>
          </q-dialog>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
<style lang="css" scoped>
  thead tr th {
    position: sticky;
    z-index: 1;
  }

  thead tr:first-child th {
    top: 0;
  }
</style>
