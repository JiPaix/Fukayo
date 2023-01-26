<script setup lang="ts">
import type { mirrorInfo } from '@api/models/types/shared';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useSocket } from '@renderer/components/helpers/socket';
import { useStore as useStoreSettings } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** props */
const props = defineProps<{
  mirror: mirrorInfo
}>();

const emit = defineEmits<{
  (eventName: 'updateSources', sources:mirrorInfo[]): void
}>();

// config
const
/** quasar */
$q = useQuasar(),
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** settings store */
settings = useStoreSettings();

// states
const
/** list of settings that needs a server's response to be confirmed */
modifying = ref<Record<'online'|'credentials', boolean>>({online: false, credentials: false});

// computed
const
/** icon representing the status of mirror */
mirrorStatusIcon = computed(() => {
  if(props.mirror.isDead) return { color: 'negative', icon: 'o_broken_image', tooltip: $t('settings.mirror_is_dead')};
  else if(!props.mirror.isOnline && props.mirror.selfhosted && props.mirror.options.host) return { color: 'red', icon: 'o_cloud_off', tooltip: $t('settings.source_is_offline') };
  else if(!props.mirror.isOnline && props.mirror.selfhosted) return {color: 'orange', icon: 'o_login', tooltip: $t('settings.source_requires_setup') };
  else if(!props.mirror.isOnline) return { color: 'negative', icon: 'o_cloud_off', tooltip: $t('settings.source_is_offline') };
  else if(!props.mirror.enabled) return { color: 'negative', icon: 'not_interested'};
  else return { color: 'positive', icon: 'done'};
});

/** delete key from record */
function omit<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/** return the value with type `T | undefined` */
function asTypeOrUndefined<T>(value: T): T|undefined {
  if(value) return value;
  return undefined;
}

/** return the translated option's name */
function optionLabel(propertyName:string) {
  switch (propertyName) {
    case 'enabled':
      return $t('settings.source.enabled');
    case 'cache':
      return $t('settings.cache');
    case 'adult':
      return $t('settings.source.adult');
    case 'markAsRead':
      return $t('settings.source.markAsRead');
    case 'login':
      return $t('setup.login');
    case 'password':
      return $t('setup.password');
    case 'host':
      return $t('settings.source.host');
    case 'port':
      return $t('setup.port');
    case 'protocol':
      return $t('settings.source.protocol');
    case 'dataSaver':
      return $t('settings.source.dataSaver');
    case 'excludedGroups':
      return $t('settings.source.excludedGroups');
      case 'excludedUploaders':
      return $t('settings.source.excludedUploaders');
    default:
      return `"${propertyName}"`;
  }
}

/** return a color given the option's name */
function toggleButtonColor(propertyName: string) {
  if(propertyName === 'enabled') return 'positive';
  if(propertyName === 'adult') return 'pink';
  return 'orange';
}

/** return an icon name given the option's name when setting is true */
function toggleButtonIconChecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power';
  if(propertyName === 'adult') return 'favorite';
  return '';
}

/** return an icon name given the option's name when setting is false */
function toggleButtonIconUnchecked(propertyName:string) {
  if(propertyName === 'enabled') return 'power_off';
  if(propertyName === 'adult') return 'child_friendly';
  return '';
}

/** change and save option */
async function changeOption(mirrorName:string, property:string, value:unknown) {
  const socket = await useSocket(settings.server);
  if(value === '') value = null;
  if(typeof value === 'string' && property === 'port') {
    const toNb = parseInt(value);
    if(!isNaN(toNb)) value = toNb;
  }

  socket.emit('changeMirrorSettings', mirrorName, { [property]: value }, (sources) => {
    emit('updateSources', sources);
  });
}

</script>

<template>
  <q-expansion-item
    :key="mirror.name"
    :dense="$q.screen.gt.md"
    group="sources"
    :icon="'img:'+mirror.icon"
    :label="mirror.displayName"
    class="shadow-2"
    :dark="$q.dark.isActive"
    :class="$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-2'"
  >
    <template #header>
      <div class="flex items-center q-mr-auto">
        <q-icon
          :name="'img:'+mirror.icon"
          size="16px"
        />
        <q-icon
          :name="mirrorStatusIcon.icon"
          :color="mirrorStatusIcon.color"
          size="16px"
          class="q-mx-xs"
        >
          <q-tooltip v-if="mirrorStatusIcon.tooltip">
            {{ mirrorStatusIcon.tooltip }}
          </q-tooltip>
        </q-icon>
        <span>{{ mirror.displayName }}</span>
      </div>
    </template>
    <q-list
      separator
      :dark="$q.dark.isActive"
      :dense="$q.screen.gt.md"
    >
      <!-- Customized Enable -->
      <q-item
        :dense="$q.screen.gt.md"
        class="flex items-center"
        clickable
        :dark="$q.dark.isActive"
        style="background:rgba(255, 255, 255, 0.3)"
        :class="$q.dark.isActive ? '' : 'bg-white'"
        @click="changeOption(mirror.name, 'enabled', !mirror.options.enabled)"
      >
        <q-item-section>
          <q-item-label>
            {{ optionLabel('enabled') }}
          </q-item-label>
        </q-item-section>
        <q-item-section
          side
        >
          <q-toggle
            :size="$q.screen.gt.md ? 'md' : 'xl'"
            :dense="$q.screen.gt.md"
            :color="toggleButtonColor('enabled')"
            :checked-icon="toggleButtonIconChecked('enabled')"
            :unchecked-icon="toggleButtonIconUnchecked('enabled')"
            :model-value="mirror.options.enabled"
            :dark="$q.dark.isActive"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'enabled', v)"
          />
        </q-item-section>
      </q-item>
      <!-- We exclude some properties so we can customize them -->
      <div
        v-for="(value, propertyName) in omit(mirror.options, ['enabled', 'login', 'password', 'host', 'port', 'protocol', 'excludedGroups', 'excludedUploaders'])"
        :key="propertyName"
      >
        <q-item
          :dense="$q.screen.gt.md"
          class="flex items-center"
          :clickable="typeof value === 'boolean'"
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          @click="typeof value === 'boolean' ? changeOption(mirror.name, propertyName, !value) : null"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel(propertyName) }}
            </q-item-label>
          </q-item-section>
          <q-item-section
            v-if="typeof value === 'boolean'"
            side
          >
            <q-toggle
              :size="$q.screen.gt.md ? 'md' : 'xl'"
              :color="toggleButtonColor(propertyName)"
              :checked-icon="toggleButtonIconChecked(propertyName)"
              :unchecked-icon="toggleButtonIconUnchecked(propertyName)"
              :model-value="value"
              :dense="$q.screen.gt.md"
              :dark="$q.dark.isActive"
              @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
            />
          </q-item-section>
          <q-item-section
            v-if="typeof value === 'string' || typeof value === 'number'"
            side
          >
            <q-input
              :dense="$q.screen.gt.md"
              :debounce="500"
              :type="typeof value === 'number' ? 'number' : 'text'"
              :model-value="value"
              :dark="$q.dark.isActive"
              @update:model-value="(v:unknown) => changeOption(mirror.name, propertyName, v)"
            >
              <template #after>
                <q-btn
                  class="q-mr-sm q-ml-lg"
                  round
                  :dense="$q.screen.gt.md"
                  icon="save"
                />
              </template>
            </q-input>
          </q-item-section>
        </q-item>
      </div>
      <!-- Customized Login -->
      <div v-if="mirror.options.hasOwnProperty('login')">
        <div
          dense
          style="background:rgba(255, 255, 255, 0.2)"
          class="flex flex-center justify-center items-center"
        >
          <span class="text-h6 ">{{ $t('settings.credentials').toLocaleUpperCase() }}</span>
        </div>
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('login') }}
            </q-item-label>
          </q-item-section>
          <q-input
            type="text"
            :dense="$q.screen.gt.md"
            outlined
            hide-bottom-space
            stack-label
            :debounce="500"
            :model-value="asTypeOrUndefined(mirror.options.login as string) || ''"
            :dark="$q.dark.isActive"
            :loading="modifying['credentials']"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'login', v)"
          >
            <template #append>
              <q-icon
                v-if="!modifying['credentials']"
                :name="mirror.loggedIn ? 'check' : 'close'"
                :color="mirror.loggedIn ? 'positive' : 'negative'"
              />
            </template>
          </q-input>
        </q-item>
      </div>
      <!-- Customized Password -->
      <div v-if="mirror.options.hasOwnProperty('password')">
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('password') }}
            </q-item-label>
          </q-item-section>
          <q-input
            type="password"
            :dense="$q.screen.gt.md"
            :debounce="500"
            outlined
            :model-value="asTypeOrUndefined(mirror.options.password as string) || ''"
            :dark="$q.dark.isActive"
            :loading="modifying['credentials']"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'password', v)"
          >
            <template #append>
              <q-icon
                v-if="!modifying['credentials']"
                :name="mirror.loggedIn ? 'check' : 'close'"
                :color="mirror.loggedIn ? 'positive' : 'negative'"
              />
            </template>
          </q-input>
        </q-item>
      </div>
      <!-- Customized host -->
      <div v-if="mirror.options.hasOwnProperty('host')">
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('host') }}
            </q-item-label>
          </q-item-section>
          <q-input
            type="text"
            :dense="$q.screen.gt.md"
            :debounce="500"
            outlined
            :model-value="asTypeOrUndefined(mirror.options.host as string) || ''"
            :dark="$q.dark.isActive"
            :loading="modifying['online']"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'host', v)"
          >
            <template #append>
              <q-icon
                v-if="!modifying['online']"
                :name="mirror.isOnline ? 'check' : 'close'"
                :color="mirror.isOnline ? 'positive' : 'negative'"
              />
            </template>
          </q-input>
        </q-item>
      </div>
      <!-- Customized port -->
      <div v-if="mirror.options.hasOwnProperty('port')">
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('port') }}
            </q-item-label>
          </q-item-section>
          <q-input
            type="number"
            :dense="$q.screen.gt.md"
            outlined
            :debounce="500"
            :model-value="asTypeOrUndefined(mirror.options.port as number) || 8080"
            :dark="$q.dark.isActive"
            :loading="modifying['online']"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'port', v)"
          >
            <template #append>
              <q-icon
                v-if="!modifying['online']"
                :name="mirror.isOnline ? 'check' : 'close'"
                :color="mirror.isOnline ? 'positive' : 'negative'"
              />
            </template>
          </q-input>
        </q-item>
      </div>
      <!-- Customized protocol -->
      <div v-if="mirror.options.hasOwnProperty('protocol')">
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('protocol') }}
            </q-item-label>
          </q-item-section>
          <q-select
            outlined
            :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
            :dense="$q.screen.gt.md"
            :options-dense="$q.screen.gt.md"
            :model-value="asTypeOrUndefined(mirror.options.protocol as string) || 'http'"
            :dark="$q.dark.isActive"
            :options="['http', 'https']"
            :loading="modifying['online']"
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'protocol', v)"
          >
            <template #append>
              <q-icon
                v-if="!modifying['online']"
                :name="mirror.isOnline ? 'check' : 'close'"
                :color="mirror.isOnline ? 'positive' : 'negative'"
              />
            </template>
          </q-select>
        </q-item>
      </div>
      <!-- Excluded Groups -->
      <div v-if="mirror.options.hasOwnProperty('excludedGroups')">
        <q-item
          :dense="$q.screen.gt.md"
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('excludedGroups') }}
            </q-item-label>
          </q-item-section>
          <q-select
            :dense="$q.screen.gt.md"
            :options-dense="$q.screen.gt.md"
            :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
            :model-value="mirror.options.excludedGroups"
            :label="$t('settings.source.excludedGroupsHints')"
            filled
            use-input
            use-chips
            multiple
            hide-dropdown-icon
            new-value-mode="add-unique"
            reactive-rules
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'excludedGroups', v)"
          />
        </q-item>
      </div>
      <!-- Excluded Uploaders -->
      <div v-if="mirror.options.hasOwnProperty('excludedUploaders')">
        <q-item
          :dark="$q.dark.isActive"
          style="background:rgba(255, 255, 255, 0.3)"
          :class="$q.dark.isActive ? '' : 'bg-white'"
          :dense="$q.screen.gt.md"
        >
          <q-item-section>
            <q-item-label>
              {{ optionLabel('excludedUploaders') }}
            </q-item-label>
          </q-item-section>
          <q-select
            color="orange"
            :behavior="$q.screen.lt.md ? 'dialog': 'menu'"
            :dense="$q.screen.gt.md"
            :options-dense="$q.screen.gt.md"
            :model-value="mirror.options.excludedUploaders"
            :label="$t('settings.source.excludedGroupsHints')"
            filled
            use-input
            use-chips
            multiple
            hide-dropdown-icon
            new-value-mode="add-unique"
            reactive-rules
            @update:model-value="(v:unknown) => changeOption(mirror.name, 'excludedUploaders', v)"
          />
        </q-item>
      </div>
    </q-list>
  </q-expansion-item>
</template>
