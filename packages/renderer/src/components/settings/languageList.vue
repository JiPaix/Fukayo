<script lang="ts" setup>
import type SettingsDB from '@api/db/settings';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { QSelect } from 'quasar';
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  stepper?: boolean;
}>();


/** emits */
const emit = defineEmits<{
  (event: 'continue'): void
}>();

// settings
const
/** stored settings */
settings = useSettingsStore(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
currentSettings = ref<SettingsDB['data']>();

// computed
const
model = computed(() => {
  return (currentSettings.value?.langs || [])
    .map(l => {
      return {
        value: l,
        label: $t('languages.'+l),
      };
    });
}),
optionsRAW = mirrorsLang
  .map(l => {
    return {
      value: l,
      label: $t('languages.'+l),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

// states
const
/** QSelect options */
options = ref(optionsRAW),
/** QSelect template ref */
qselect = ref<null|InstanceType<typeof QSelect>>(null);


function filterFn (val:string, update:(callbackFn:() => void)=>void) {
  if (val === '') {
    update(() => {
      options.value = optionsRAW;
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    options.value = optionsRAW.filter(v => v.label.toLowerCase().indexOf(needle) > -1);
  });
}

function resetFilter() {
  if(!qselect.value) return;
  qselect.value.updateInputValue('');
}

async function updateval(val: { value: mirrorsLangsType, label: string }[]) {
  if(!val || !val.length) return clear();
  if(!currentSettings.value) return;
  const values = val.map(x=>x.value);
  const socket = await useSocket(settings.server);
  socket.emit('changeSettings', { ...currentSettings.value, langs: values }, (newSettings) => {
    currentSettings.value = newSettings;
  });
}

async function remove(val:mirrorsLangsType) {
  if(!currentSettings.value) return;
  const socket = await useSocket(settings.server);
  const values = currentSettings.value.langs.filter(l => l !== val);
  socket.emit('changeSettings', { ...currentSettings.value, langs: values }, (newSettings) => {
    currentSettings.value = newSettings;
  });
}

async function clear() {
  if(!currentSettings.value) return;
  const socket = await useSocket(settings.server);
  socket.emit('changeSettings', { ...currentSettings.value, langs: ['xx'] }, (newSettings) => {
    currentSettings.value = newSettings;
  });
}

async function selectAll() {
  if(!currentSettings.value) return;
  const socket = await useSocket(settings.server);
  socket.emit('changeSettings', { ...currentSettings.value, langs: mirrorsLang as unknown as mirrorsLangsType[] }, (newSettings) => {
    currentSettings.value = newSettings;
  });
}

async function unselectAll() {
  if(!currentSettings.value) return;
  const socket = await useSocket(settings.server);
  socket.emit('changeSettings', { ...currentSettings.value, langs: ['xx'] }, (newSettings) => {
    currentSettings.value = newSettings;
  });
}

onBeforeMount(async () => {
  const socket = await useSocket(settings.server);
  socket.emit('getSettings', (globalSettings) => {
    currentSettings.value = globalSettings;
  });
});
</script>
<template>
  <q-card
    class="w-100"
    flat
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? 'bg-dark': 'bg-grey-2'"
  >
    <q-card-section
      class="row items-center"
    >
      <q-banner
        class="q-mx-auto w-100"
        :class="$q.dark.isActive ? 'bg-grey-9 text-white': 'bg-grey-3 text-black'"
      >
        <template #avatar>
          <q-icon
            name="translate"
          />
        </template>
        {{ $t('settings.language.description') }}
        <template #action>
          <q-btn
            flat
            :label="$t('settings.language.selectall')"
            @click="selectAll"
          />
          <q-btn
            flat
            :label="$t('settings.language.unselectall')"
            @click="unselectAll"
          />
          <q-btn
            v-if="props.stepper"
            color="orange"
            push
            :label="$t('settings.confirm')"
            class="q-ml-auto"
            @click="emit('continue')"
          />
        </template>
        <q-select
          ref="qselect"
          v-model:model-value="model"
          color="orange"
          :options="options"
          :options-dense="$q.screen.gt.md"
          :label="$t('languages').toLocaleUpperCase()"
          behavior="dialog"
          use-input
          use-chips
          multiple
          hide-bottom-space
          item-aligned
          clearable
          autocomplete="label"
          input-debounce="0"
          @filter="filterFn"
          @update:model-value="updateval"
          @add="resetFilter"
          @clear="clear"
        >
          <template #selected-item="scope">
            <q-chip
              :color="scope.index % 2 === 0 ? 'orange' : 'orange-3'"
              text-color="black"
              dense
              square
              removable
              @remove="remove(scope.opt.value)"
            >
              <span class="text-weight-bold">{{ scope.opt.label }}</span>
            </q-chip>
          </template>
        </q-select>
      </q-banner>
    </q-card-section>
    <q-card-section />
  </q-card>
</template>
