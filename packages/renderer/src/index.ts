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

// pinia stores
import { createPinia } from 'pinia';
import { piniaLocalStorage } from './store/localStorage';
const pinia = createPinia();
pinia.use(piniaLocalStorage);

// init
const myApp = createApp(App);
myApp.use(pinia);
myApp.use(i18n);
myApp.use(vuetify);
myApp.mount('#app');
