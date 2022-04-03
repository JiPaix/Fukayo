<script lang="ts" setup>
  import { ref } from 'vue';
  import { useQuasar } from 'quasar';
  import { useStore } from '/@/store/settings';
  import icon from '../../assets/icon.svg';
  import { useI18n } from 'vue-i18n';
  import { isLoginValid, isPasswordValid, passwordHint, isPortValid, isProvidedKeyValid, isProvidedCertificateValid, keyColor, certifColor } from './helpers/login';
  const $t = useI18n().t.bind(useI18n());
  const $q = useQuasar();
  const emit = defineEmits<{ (event: 'done'): void }>();

  const settings = useStore();

  const password = ref<string | null>(null);
  const showPassword = ref(false);

  const prompt = (title:string, kind:'cert'|'key', model?:string|null) => {
    $q.dialog({
      title,
      prompt: {
        model : model || '',
        isValid: val => kind === 'key' ? isProvidedKeyValid(val) : isProvidedCertificateValid(val), // << here is the magic
        type: 'textarea', // optional
      },
      cancel: true,
      persistent: true,
    }).onOk(data => {
      if(typeof data === 'string') {
        settings.server[kind] = data;
      }
    });
  };

  const starting = ref(false);

  const startServer = async () => {
    // checks
    if(!readyToStart()) return;
    if(!password.value) {
      $q.notify({
          type: 'negative',
          message: $t(passwordHint(password.value)),
          icon: 'error',
        });
        return;
    }
    // define the payload
    const payload = {
      login: settings.server.login || 'admin',
      password: password.value,
      port: settings.server.port,
      ssl: settings.server.ssl,
      cert: settings.server.cert,
      key: settings.server.key,
    };
    // start the server
    const response = await window.apiServer.startServer(payload);
    starting.value = false;
    // check the response
    if(response.success) {
      settings.server.accessToken = response.message.split('[split]')[0];
      settings.server.refreshToken = response.message.split('[split]')[1];
      emit('done');
    }
  };

  const readyToStart = () => {
    if(!isPasswordValid(password.value)) return false;
    if(!isPortValid(settings.server.port)) return false;
    if(settings.server.ssl === 'provided') {
      if(!isProvidedCertificateValid(settings.server.cert)) return false;
      if(!isProvidedKeyValid(settings.server.key)) return false;
    }
    return true;
  };
</script>
<template>
  <div
    class="row q-pa-lg"
  >
    <div class="col-12">
      <q-card
        dark
        bordered
        class="q-pa-lg"
      >
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
            {{ $t('app.name.value') }}
            <div class="text-body2 text-grey-7">
              {{ $t('app.description.value') }}
            </div>
          </div>
        </q-card-section>
        <q-separator
          dark
          color="grey-9"
          inset
          class="justify-center q-mt-md"
        />
        <q-card-section>
          <div class="text-h6">
            {{ $t('setup.message.value') }} :
          </div>
        </q-card-section>
        <q-form
          class="q-gutter-md"
          @submit.prevent="startServer"
        >
          <q-input
            v-model="settings.server.login"
            filled
            dense
            :rules="[isLoginValid]"
            bottoms-slots
            type="text"
            :label="$t('setup.setLogin.value')"
          />


          <q-input
            v-model="password"
            filled
            dense
            bottom-slots
            :rules="[isPasswordValid]"
            :type="showPassword ? 'text' : 'password'"
            :label="$t('setup.setPassword.value')"
          >
            <template #hint>
              <div v-html="$t(passwordHint(password))" />
            </template>
            <template #prepend>
              <q-icon
                :name="showPassword ? 'visibility' : 'visibility_off'"
                style="cursor:pointer;"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-input
            v-model.number="settings.server.port"
            filled
            dense
            name="port"
            type="number"
            :rules="[isPortValid]"
            bottom-slots
            :label="$t('setup.setPort.value')"
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
            <template #hint>
              <q-slider
                dense
                :model-value="settings.server.port"
                :min="1024"
                :max="65535"
                color="positive"
                label
                @change="settings.server.port = $event"
              />
            </template>
          </q-input>
          <q-card>
            <q-card-section>
              {{ $t('setup.security.choose.value') }}
            </q-card-section>
            <q-card-section>
              <q-list>
                <q-item
                  v-ripple
                  tag="label"
                >
                  <q-item-section avatar>
                    <q-radio
                      v-model="settings.server.ssl"
                      val="false"
                      color="negative"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('setup.security.none.value') }}</q-item-label>
                    <q-item-label caption>
                      {{ $t('setup.security.none.description.value') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item
                  v-ripple
                  tag="label"
                >
                  <q-item-section avatar>
                    <q-radio
                      v-model="settings.server.ssl"
                      val="app"
                      color="warning"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ $t('setup.security.app.value') }} <small>({{ $t('setup.security.selfsigned.value') }})</small>
                    </q-item-label>
                    <q-item-label
                      caption
                      class="flex"
                    >
                      <span>
                        {{ $t('setup.security.app.description.value', { appName: $t('app.name.value') }) }}
                      </span>
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
                      v-model="settings.server.ssl"
                      val="provided"
                      color="positive"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('setup.security.provided.value') }}</q-item-label>
                    <q-item-label caption>
                      {{ $t('setup.security.provided.description.value') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>

          <div v-if="settings.server.ssl === 'provided'">
            <q-btn @click="prompt($t('setup.security.pastcert.value'), 'cert', settings.server.cert)">
              <template #default>
                <span>{{ $t('setup.security.certificate.value') }}</span>
                <q-icon
                  right
                  name="lock"
                  :color="certifColor(settings.server.cert)"
                />
              </template>
            </q-btn>
            <q-btn @click="prompt($t('setup.security.pastprivkey.value'), 'key', settings.server.key)">
              <template #default>
                <span>{{ $t('setup.security.privkey.value') }}</span>
                <q-icon
                  right
                  name="key"
                  :color="keyColor(settings.server.key)"
                />
              </template>
            </q-btn>
          </div>
          <div class="row justify-end">
            <q-btn
              type="submit"
              size="xl"
              round
              :loading="starting"
              :color="!readyToStart() || starting ? 'warning' : 'negative'"
              :disabled="!readyToStart() || starting"
              icon="local_fire_department"
            />
          </div>
        </q-form>
      </q-card>
    </div>
  </div>
</template>
<style lang="css">
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button
{
  -webkit-appearance: none;
  margin: 0;
}

input[type=number]
{
  -moz-appearance: textfield;
}
</style>
