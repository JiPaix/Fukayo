import {createApp} from 'vue';
import App from '/@/App.vue';

// stores
import { store as storeSettings, key as keySettings } from './store/settings';
import { createI18n } from 'vue-i18n';

// locales
import en from './locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: navigator.language,
  globalInjection: true,
  fallbackLocale: 'en',
  messages: {
    en,
  },
});

// vuetify
import { createVuetify } from 'vuetify';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
const vuetify = createVuetify();
const myApp = createApp(App);
myApp.use(storeSettings, keySettings);
myApp.use(i18n);
myApp.use(vuetify);
myApp.mount('#app');
// basically trying stuff
