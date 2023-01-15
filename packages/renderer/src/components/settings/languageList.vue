<script lang="ts" setup>
import type en from '@i18n/../locales/en.json';
import type { appLangsType, mirrorsLangsType } from '@i18n';
import { mirrorsLang } from '@i18n';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { QSelect } from 'quasar';

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
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());

// computed
const
model = computed(() => {
  return mirrorsLang.filter(l => !settings.i18n.ignored.includes(l)).filter(l => l !== 'xx')
    .map(l => {
      return {
        value: l,
        label: $t('languages.'+l),
      };
    });
}),
optionsRAW = mirrorsLang.filter(l => l !== 'xx')
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

function updateval(val: { value: mirrorsLangsType, label: string }[]) {
  if(!val || !val.length) return clear();
  const values = val.map(x=>x.value);
  settings.i18n.ignored = mirrorsLang.filter(l => !values.includes(l));
}

function remove(val:mirrorsLangsType) {
  settings.i18n.ignored.push(val);
}

function clear() {
  settings.i18n.ignored = mirrorsLang.filter(l => l !== 'xx');
}

function selectAll() {
  settings.i18n.ignored = [];
}

function unselectAll() {
  settings.i18n.ignored = mirrorsLang.filter(l => l !== 'xx');
}
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
    <!-- <q-card-section class="row">
      <div
        v-for="(lang ,i) in models"
        :key="i"
        class="col-lg-2 col-sm-4"
      >
        <q-checkbox
          :model-value="!settings.i18n.ignored.includes(lang)"
          :label="$t(`languages.${lang}`)"
          color="orange-4"
          keep-color
          @update:model-value="(val:boolean) => updateval(lang, val)"
        />
      </div>
    </q-card-section> -->
  </q-card>
</template>
