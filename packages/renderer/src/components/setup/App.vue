<script lang="ts" setup>
import icon from '@assets/icon.svg';
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { certifColor, hostNameHint, isHostNameValid, isLoginValid, isPasswordValid, isPortValid, isProvidedCertificateValid, isProvidedKeyValid, keyColor, passwordHint } from '@renderer/components/helpers/login';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** emit */
const emit = defineEmits<{
  (eventName: 'done'): void
  (eventName: 'loading', value: boolean): void
}>();

// settings
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n()),
/** quasar */
$q = useQuasar(),
/** stored settings */
settings = useSettingsStore();

// states
const
/** toggler to show the password */
showPassword = ref(false),
/** show a loading screen while the server starts */
starting = ref(false);

// computed
const
readyToStart = computed(() => {
  if(!isLoginValid(settings.server.login)) return false;
  if(!isPasswordValid(settings.server.password)) return false;
  if(!isPortValid(settings.server.port)) return false;
  if(settings.server.ssl === 'provided') {
    if(!isProvidedCertificateValid(settings.server.cert)) return false;
    if(!isProvidedKeyValid(settings.server.key)) return false;
  }
  if(settings.server.ssl === 'app') {
    if(!isHostNameValid(settings.server.hostname)) return false;
  }
  return true;
});

/** display a prompt and ask user for a key+cert */
function prompt (title:string, kind:'cert'|'key', model?:string|null) {
  $q.dialog({
    title,
    prompt: {
      model : model || '',
      isValid: val => kind === 'key' ? isProvidedKeyValid(val) : isProvidedCertificateValid(val), // << here is the magic
      type: 'textarea', // optional
    },
    cancel: {
      label: $t('setup.security.cancel'),
      color: 'dark',
    },
    ok: {
      label: $t('setup.security.ok'),
      color: 'orange',
    },
    persistent: true,
  }).onOk(data => {
    if(typeof data === 'string') {
      settings.server[kind] = data;
    }
  });
}

/**
 * starts the server
 */
async function startServer () {
  // checks
  if(!readyToStart.value) return;
  emit('loading', true);
  starting.value = true;
  // define the payload
  const payload = {
    login: settings.server.login || 'admin',
    password: settings.server.password as string,
    port: settings.server.port,
    hostname: settings.server.hostname,
    ssl: settings.server.ssl,
    cert: settings.server.cert,
    key: settings.server.key,
  };
  // start the server
  const response = await window.apiServer.startServer(payload);
  starting.value = false;
  emit('loading', false);
  // check the response
  if(response.message) {
    if(response.success) {
      settings.server.accessToken = response.message.split('[split]')[0];
      settings.server.refreshToken = response.message.split('[split]')[1];
      emit('done');
    } else {
      $q.notify({ message: response.message, type: 'negative' });
    }
  }
}

onMounted(() => {
  if(readyToStart.value) return startServer();
});
</script>
<template>
  <div
    style="overflow:auto;"
    class="fullscreen bg-dark"
    @keyup="$event => $event.key === 'Enter' && readyToStart ? startServer() : null"
  >
    <div
      class="row q-pa-xl"
    >
      <div class="col-12">
        <q-card-section
          horizontal
          class="items-center justify-center"
        >
          <q-avatar class="q-mr-md">
            <img
              :src="icon"
            >
          </q-avatar>
          <div class="text-h6">
            {{ $t('app.name') }}
            <div class="text-body2 text-grey-7">
              {{ $t('app.description') }}
            </div>
          </div>
        </q-card-section>
        <q-separator
          class="q-mt-md q-mx-xl"
          dark
          color="grey-9"
          size="1px"
        />
      </div>
      <div class="col-12 q-pa-lg q-mt-lg">
        <div class="text-h6 q-mb-lg">
          {{ $t('setup.message') }}
        </div>
      </div>
      <div class="col-6 row q-pa-lg items-center q-mt-lg">
        <div class="col-12">
          <q-input
            v-model="settings.server.login"
            class="col-3 offset-2"
            name="login"
            outlined
            dense
            :rules="[isLoginValid]"
            :bottoms-slots="false"
            type="text"
            :label="$t('setup.login')"
          />
        </div>
        <div class="col-12">
          <q-input
            v-model="settings.server.password"
            name="password"
            outlined
            dense
            class="col-3 offset-1"
            :color="settings.server.password === null || isPasswordValid(settings.server.password) ? 'white': 'negative'"
            bottom-slots
            :type="showPassword ? 'text' : 'password'"
            :label="$t('setup.password')"
          >
            <template #hint>
              <div
                :class="settings.server.password === null || isPasswordValid(settings.server.password) ? 'text-white': 'text-negative'"
                v-html="$t(passwordHint(settings.server.password))"
              />
            </template>
            <template #prepend>
              <q-icon
                :class="settings.server.password === null || isPasswordValid(settings.server.password) ? 'text-white': 'text-negative'"
                :name="showPassword ? 'visibility' : 'visibility_off'"
                style="cursor:pointer;"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
        </div>
        <div class="col-12">
          <q-input
            v-model.number="settings.server.port"
            name="port"
            outlined
            dense
            class="col-3 offset-4"
            type="number"
            :rules="[isPortValid]"
            bottom-slots
            :label="$t('setup.port')"
          >
            <template #append>
              <div
                class="column q-pa-none"
              >
                <q-icon
                  size="sm"
                  style="margin-bottom:-4px;cursor:pointer;"
                  dense
                  name="expand_less"
                  @click="settings.server.port++"
                />
                <q-icon
                  size="sm"
                  style="margin-top:-4px;cursor:pointer;"
                  dense
                  name="expand_more"
                  @click="settings.server.port--"
                />
              </div>
            </template>
            <template #error>
              {{ $t('setup.port_error') }}
            </template>
          </q-input>
        </div>
        <div class="col-12">
          <q-checkbox
            v-model="settings.server.autostart"
            dense
            :label="$t('app.autostart')"
            type="checkbox"
            checked-icon="task_alt"
            unchecked-icon="highlight_off"
          />
        </div>
      </div>
      <div class="col-6 q-pa-lg">
        <q-list
          bordered
          class="rounded-borders"
          separator
        >
          <q-item style="background-color: rgba(255, 255, 255, 0.28);">
            <q-item-section>
              <q-item-label>{{ $t('setup.security.choose') }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-ripple
            tag="label"
          >
            <q-item-section avatar>
              <q-radio
                id="no-ssl"
                v-model="settings.server.ssl"
                val="false"
                color="negative"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t('setup.security.none') }}</q-item-label>
              <q-item-label caption>
                {{ $t('setup.security.none_description') }}
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            v-ripple
            tag="label"
          >
            <q-item-section avatar>
              <q-radio
                id="app-ssl"
                v-model="settings.server.ssl"
                val="app"
                color="warning"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ $t('setup.security.app') }} <small>({{ $t('setup.security.selfsigned') }})</small>
              </q-item-label>
              <q-item-label
                caption
                class="flex"
              >
                <span>
                  {{ $t('setup.security.app_description', { appName: $t('app.name') }) }}
                </span>
                <q-slide-transition>
                  <div
                    v-if="settings.server.ssl === 'app'"
                  >
                    <q-input
                      v-model="settings.server.hostname"
                      class="q-mt-sm q-ml-auto "
                      dense
                      :autofocus="!isHostNameValid(settings.server.hostname)"
                      bottom-slots
                      clearable
                      no-error-icon
                      name="hostname"
                      :error="hostNameHint(settings.server.hostname) !== ''"
                      :type="'text'"
                      :label="$t('setup.address')"
                    >
                      <template
                        #prepend
                      >
                        <q-icon
                          name="public"
                        />
                      </template>
                      <template #hint>
                        <div v-html="$t('setup.address_hint')" />
                      </template>
                      <template #error>
                        <div v-html="$t(hostNameHint(settings.server.hostname))" />
                      </template>
                    </q-input>
                  </div>
                </q-slide-transition>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-ripple
            tag="label"
          >
            <q-item-section
              avatar
              top
            >
              <q-radio
                id="user-ssl"
                v-model="settings.server.ssl"
                val="provided"
                color="positive"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t('setup.security.provided') }}</q-item-label>
              <q-item-label caption>
                {{ $t('setup.security.provided_description') }}
              </q-item-label>
              <q-slide-transition>
                <div
                  v-if="settings.server.ssl === 'provided'"
                  class="flex q-mt-sm"
                >
                  <q-btn
                    push
                    class="q-mx-sm"
                    dense
                    @click="prompt($t('setup.security.pastcert'), 'cert', settings.server.cert)"
                  >
                    <template #default>
                      <span>{{ $t('setup.security.certificate') }}</span>
                      <q-icon
                        right
                        name="lock"
                        :color="certifColor(settings.server.cert)"
                      />
                    </template>
                  </q-btn>
                  <q-btn
                    push
                    class="q-mx-sm"
                    dense
                    @click="prompt($t('setup.security.pastprivkey'), 'key', settings.server.key)"
                  >
                    <template #default>
                      <span>{{ $t('setup.security.privkey') }}</span>
                      <q-icon
                        right
                        name="key"
                        :color="keyColor(settings.server.key)"
                      />
                    </template>
                  </q-btn>
                </div>
              </q-slide-transition>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      <div class="w-100 text-center q-mt-xl q-">
        <q-btn
          id="start"
          size="100px"
          round
          :loading="starting"
          :color="!readyToStart ? 'warning' : 'negative'"
          :disabled="!readyToStart || starting"
          icon="local_fire_department"
          @click="() => readyToStart ? startServer() : null"
        />
      </div>
    </div>
  </div>
</template>
<style lang="css">
.w-30 {
  width: 30%;
}
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button
{
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

input[type=number]
{
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
