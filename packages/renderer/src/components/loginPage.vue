<script lang="ts" setup>
  import { ref } from 'vue';
  import type { authByLogin } from './helpers/login';
  import { useStore } from '/@/store/settings';
  import icon from '../../assets/icon.svg';
  import { useI18n } from 'vue-i18n';

  defineProps({
    badPassword: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits<{ (event: 'done', auth: authByLogin): void }>();
  const $t = useI18n().t.bind(useI18n());
  const settings = useStore();

  const login = ref(settings.server.login);
  const password = ref<string|null>(null);
  const loading = ref(false);
  const showPassword = ref(false);
  const readyToStart = () => {
    return login.value && password.value;
  };
  const connect = () => {
    if(!password.value || !login.value) return;
    loading.value = true;
    settings.server.login = login.value;
    emit('done', { login: login.value, password: password.value });
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
          <q-form
            class="q-gutter-md"
            @submit.prevent="connect"
          >
            <q-input
              v-model="settings.server.login"
              filled
              dense
              bottoms-slots
              type="text"
              :label="$t('setup.setLogin.value')"
            />
            <q-input
              v-model="password"
              filled
              dense
              bottom-slots
              :type="showPassword ? 'text' : 'password'"
              :label="$t('setup.setPassword.value')"
            >
              <template #prepend>
                <q-icon
                  :name="showPassword ? 'visibility' : 'visibility_off'"
                  style="cursor:pointer;"
                  @click="showPassword = !showPassword"
                />
              </template>
            </q-input>

            <div class="fit row wrap justify-end items-center content-center">
              <q-banner
                v-if="badPassword"
                inline-actions
                class="text-white bg-negative"
              >
                {{ $t('setup.badPassword.value') }}
                <template #action>
                  <q-btn
                    flat
                    color="white"
                    :label="$t('setup.retry.value')"
                  />
                </template>
              </q-banner>
              <q-btn
                v-else
                size="xl"
                round
                :loading="loading"
                :color="!readyToStart() ? 'warning' : 'negative'"
                :disabled="!readyToStart()"
                icon="local_fire_department"
                type="submit"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>
