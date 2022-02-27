import {createApp} from 'vue';
import App from '/@/App.vue';

// locales
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';
const i18n = createI18n({
  legacy: false,
  locale: navigator.language,
  globalInjection: true,
  fallbackLocale: 'en',
  messages: {
    en,
    fr,
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
