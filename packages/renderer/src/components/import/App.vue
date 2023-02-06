<script lang="ts" setup>
import type Importer from '@api/models/imports/interfaces';
import type { CantImportResults, ImportResults } from '@api/models/imports/types';
import type { importErrorMessage } from '@api/models/types/errors';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { routeTypeHelper } from '@renderer/components/helpers/routePusher';
import { useSocket } from '@renderer/components/helpers/socket';
import { isCantImport, isImportErrorMessage, isManga, isMangaInDB, isTaskDone } from '@renderer/components/helpers/typechecker';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import type { QTableProps } from 'quasar';
import { QTable, useQuasar } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { transformIMGurl } from '../helpers/transformIMGurl';


// config
const
/** quasar */
$q = useQuasar(),
/** router */
router = useRouter(),
/** user settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());


// globals
const
/** is electron */
isElectron = typeof window.apiServer !== 'undefined' ? true : false,
/** table column */
columns:QTableProps['columns'] = [
  {
    name: 'covers',
    label: $t('import.cover').toLocaleUpperCase(),
    align: 'left',
    field: (row:ImportResults) => row.covers,
    sortable: false,
  },
  {
    name: 'name',
    required: true,
    label: $t('mangas.title').toLocaleUpperCase(),
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

// states
const
/** list of importers */
importers = ref<Importer['showInfo'][]>([]),
/** list of importers that need configuration */
disabledimporters = ref<Importer['showInfo'][]>([]),
/** selected importer */
currentImporter = ref<Importer['showInfo']|null>(null),
/** list of mangas */
mangas = ref<(ImportResults|CantImportResults)[]>([]),
/** list of languages */
langs = ref(mirrorsLang as unknown as mirrorsLangsType[]),
/** errors */
error = ref<null|importErrorMessage>(null),
/** loading mangas */
loading = ref(false),
/** importing to db */
importing = ref(false),
/** nb of expected results */
expected = ref(0),
/** table pagination */
pagination = ref({rowsPerPage: 0}),
/** selected mangas in table */
selection = ref<ImportResults[]>([]),
/** show/hide the dialog */
showDialog = ref(false);
// /** QTable */
// table = ref<QTable>();

// computed
const
/** fetch progress */
progress = computed(() => {
  return mangas.value.length/expected.value;
}),
/** parent's QHeader height */
headerSize = computed(() => {
  const div = document.querySelector<HTMLDivElement>('#top-header');
  if(div) return div.offsetHeight;
  else return 0;
});

function getMangas(importer: Importer['showInfo'], json?:boolean) {
if(!json) return getMangasInternal(importer);
  $q.dialog({
    title: importer.displayName,
    message: 'import the data',
    prompt: {
      model: '',
      isValid: AMRValidJSON,
      type: 'textarea',
    },
    cancel: true,
    persistent: true,
  }).onOk(data => {
    getMangasInternal(importer, data);
  });

}

function AMRValidJSON(str:string) {
  if(typeof str !== 'string') return false;
  if(str.length < 1) return false;
  try {
    const json = JSON.parse(str);
    if(!Array.isArray(json.mangas)) return false;
    const manga = json.mangas[0] as Record<string, string> | undefined;
    if(!manga || !manga.u) return false;
    return true;
  } catch {
    return false;
  }
}

async function getMangasInternal(importer: Importer['showInfo'], json?:string) {
  mangas.value = [];
  error.value = null;
  expected.value = 0;
  loading.value = true;
  showDialog.value = true;
  importing.value = false;
  currentImporter.value = importer;
  const socket = await useSocket(settings.server);
  const reqId = Date.now();
  socket.emit('showImports', reqId, importer.name, langs.value, json);

}

async function startImport() {
  const reqId = Date.now();
  let counter = selection.value.length;
  importing.value = true;
  const socket = await useSocket(settings.server);
  selection.value.filter(s=> !s.inLibrary || !isCantImport(s)).forEach((s) =>{
    socket.emit('showManga', reqId, { mirror: s.mirror.name, langs: langs.value, url: s.url});
  });
  socket.on('showManga', (id, manga) => {
    if(id!==reqId) return;
    if(isManga(manga)) {
      if(isMangaInDB(manga)) {
        selection.value = selection.value.filter(v => v.url !== manga.url);
        counter = counter-1;
        if(counter === 0) importing.value = false;
        const mg = (mangas.value.filter(m => !isCantImport(m)) as ImportResults[]).find(v => v.url === manga.url);
        if(mg) mg.inLibrary = true;
      } else {
        socket.emit('addManga', { manga }, (res => {
          selection.value = selection.value.filter(v => v.url !== res.url);
          counter = counter-1;
          if(counter === 0) importing.value = false;
          const mg = (mangas.value.filter(m => !isCantImport(m)) as ImportResults[]).find(v => v.url === manga.url);
          if(mg) mg.inLibrary = true;
        }));
      }

    } else {
      counter = counter-1;
      if(counter === 0) importing.value = false;
    }
  });
}

function searchElseWhere(name: string, langs?: mirrorsLangsType[]) {
  const routeParams = router.resolve({name: 'search', query: { q: name, langs }});
  if(isElectron) {
    router.push(routeParams);
  } else {
    window.open(routeParams.href, '_blank');
  }
}

/** get list of import sources */
async function On() {
  const socket = await useSocket(settings.server);

  function getLanguages():Promise<void> {
    return new Promise(resolve => {
      socket.emit('getSettings', (globalSettings) => {
        langs.value = globalSettings.langs;
        resolve();
      });
    });
  }

  await getLanguages();

  socket.emit('getImports', true, (imps) => {
    imps.forEach(im=> {
      if(im.enabled) importers.value.push(im);
      else disabledimporters.value.push(im);
    });
    importers.value = importers.value.sort((a, b) => a.name.localeCompare(b.name));
    disabledimporters.value = disabledimporters.value.sort((a, b) => a.name.localeCompare(b.name));
  });

  socket.on('showImports', (id, resp) => {
    if(typeof resp === 'number') expected.value = resp;
    else if(isImportErrorMessage(resp)) {
      error.value = resp;
      socket.removeAllListeners('showImports');
    }
    else if (isTaskDone(resp)) {
      expected.value = mangas.value.length;
      loading.value = false;
      socket.removeAllListeners('showImports');
    } else {
      if(Array.isArray(resp)) resp.forEach(r => mangas.value.push(r));
      else mangas.value.push(resp);
    }
  });
}

async function Off() {
  const socket = await useSocket(settings.server);
  socket.removeAllListeners('showImports');
  socket.removeAllListeners('showManga');
  socket.emit('stopShowImports');
  selection.value = [];
  mangas.value = [];
}



// reset values if user closes dialog
watch(showDialog, async (nval) => {
  if(!nval) Off();
});

onBeforeMount(On);
onBeforeUnmount(Off);

</script>
<template>
  <q-layout
    view="lHh lpr lFf"
    container
    :style="'height: '+($q.screen.height-headerSize)+'px'"
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
                @click="getMangas(importer, importer.name === 'amr')"
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
              class="q-mt-md table"
              :rows="mangas"
              :columns="columns"
              selection="multiple"
              binary-state-sort
              row-key="name"
              dense
              :rows-per-page-options="[0]"
              column-sort-order="ad"
            >
              <template #top>
                <div
                  v-if="currentImporter"
                  class="flex items-center w-100 justify-between q-py-md"
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
                  <q-circular-progress
                    v-if="progress !== 1"
                    size="100px"
                    color="orange"
                    class="q-ml-md"
                    :show-value="true"
                    :indeterminate="isNaN(progress)"
                    :value="progress*100"
                    :thickness="0.1"
                    :center-color="$q.dark.isActive ? 'grey-8': 'grey-3'"
                  >
                    <template #default>
                      <span class="text-caption">
                        {{ mangas.length }} / {{ expected }}
                      </span>
                    </template>
                  </q-circular-progress>
                  <div
                    v-else
                    style="height:100px"
                  />
                  <q-btn
                    color="orange"
                    size="lg"
                    class="q-ml-auto"
                    :disable="!selection.length"
                    :label="$t('import.start_import')"
                    :loading="importing"
                    @click="startImport"
                  />
                </div>
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
                  @click="props.row.inLibrary ? props.selected = !props.selected : null"
                >
                  <q-td>
                    <q-checkbox
                      v-if="props.row.inLibrary"
                      :model-value="props.selected"
                      @update:model-value="props.selected = !props.selected"
                    />
                    <q-btn
                      v-if="isCantImport(props.row)"
                      flat
                      icon="search"
                      @click="searchElseWhere(props.row.name, props.row.langs)"
                    >
                      <q-tooltip>
                        {{ $t('import.search_elsewhere') }}
                      </q-tooltip>
                    </q-btn>
                  </q-td>
                  <q-td
                    key="covers"
                    :props="props"
                  >
                    <q-img
                      v-if="props.row.covers && props.row.covers.length"
                      :src="transformIMGurl(props.row.covers[0], settings)"
                    />
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
