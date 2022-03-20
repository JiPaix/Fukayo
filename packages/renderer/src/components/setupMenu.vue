<script lang="ts" setup>
  import { ref } from 'vue';
  import { useStore } from '/@/store/settings';
  import icon from '../../assets/icon.svg';

  const emit = defineEmits<{ (event: 'done'): void }>();

  const settings = useStore();

  const password = ref<string | null>(null);
  const showPassword = ref(false);
  const isPasswordValid = () => {
    return password.value !== null && password.value.length >= 6;
  };
  const isPasswordStyle = (type: 'color' | 'icon') => {
    if(type === 'color') {
      if(password.value === null || password.value.length === 0) return 'warning';
      return isPasswordValid() ? 'success' : 'error';
    }
    if(password.value === null || password.value.length === 0) return 'mdi-timer-sand-empty';
    return isPasswordValid() ? 'mdi-check' : 'mdi-close';
  };

  const passwordHint = () => {
    // 8 chars, at least a symbol, a number and with upper and lower case chars
    const regex = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    if(password.value === null || password.value.length === 0) return 'setup.passwordHint.value';
    if(regex.test(password.value)) return 'setup.passwordHintStrong.value';
    if(password.value.length >= 8) return 'setup.passwordHintAverage.value';
    return 'setup.passwordHintWeak.value';
  };

  const isPortValid = () => {
    return settings.server.port >= 1024 && settings.server.port <= 65535;
  };
  const isPortStyle = (type: 'color' | 'icon') => {
    if(type === 'color') return isPortValid() ? 'success' : 'error';
    return isPortValid() ? 'mdi-check' : 'mdi-close';
  };

  const starting = ref(false);
  const serverError = ref<string | null>(null);

  const startServer = () => {
    if(password.value === null) {
      serverError.value = 'no password';
      return;
    }
    window.apiServer.startServer(settings.server.port, password.value).then(msg => {
      if(msg.success) {
        starting.value = false;
        emit('done');
      } else {
        starting.value = false;
        serverError.value = msg.message;
      }
    });
  };

</script>
<template>
  <v-card contained-text>
    <v-card-header>
      <v-card-avatar>
        <v-avatar
          class="logo"
          :image="icon"
          size="128"
        />
      </v-card-avatar>
      <v-card-header-text>
        <v-card-title>
          Welcome to {{ $t('app.name.value') }}
        </v-card-title>
        <v-card-subtitle>
          {{ $t('app.description.value') }}
        </v-card-subtitle>
      </v-card-header-text>
    </v-card-header>
    <v-card-text>
      {{ $t('setup.message.value') }}
    </v-card-text>
    <v-card-actions
      style="display:block!important;"
      class="ma-4"
    >
      <v-text-field
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        autofocus
        density="comfortable"
        :label="$t('setup.setPassword.value')"
        :hint="$t(passwordHint())"
        persistent-hint
      >
        <template #message>
          <div v-html="$t(passwordHint())" />
        </template>
        <template #prependInner>
          <v-icon
            class="mr-3"
            style="cursor:pointer;"
            :icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            @click="showPassword = !showPassword"
          />
        </template>
        <template #append>
          <v-icon
            small
            :color="isPasswordStyle('color')"
          >
            {{ isPasswordStyle('icon') }}
          </v-icon>
        </template>
      </v-text-field>
      <v-text-field
        v-model="settings.server.port"
        type="number"
        persistent-hint
        density="comfortable"
        :label="$t('setup.setPort.value')"
        :hint="$t('setup.portHint.value')"
        min="1024"
        max="65535"
      >
        <template #append>
          <v-icon
            small
            :color="isPortStyle('color')"
          >
            {{ isPortStyle('icon') }}
          </v-icon>
        </template>
      </v-text-field>
      <v-row class="mt-2 mx-4">
        <v-col>
          <v-alert
            v-if="serverError"
            border="start"
            type="error"
            density="compact"
            icon="mdi-firework"
          >
            {{ serverError }}
          </v-alert>
        </v-col>
        <v-col class="text-right">
          <v-btn
            :loading="starting"
            :color="!isPasswordValid() || !isPortValid() || starting ? '' : 'warning'"
            :disabled="!isPasswordValid() || !isPortValid() || starting"
            icon="mdi-fire"
            @click="startServer()"
          />
        </v-col>
      </v-row>
    </v-card-actions>
  </v-card>
</template>
<style lang="css">
  .v-avatar.logo img.v-img__img.v-img__img--contain {
    padding: 10%!important;
  }
</style>
