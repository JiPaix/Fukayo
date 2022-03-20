import {createApp} from 'vue';
import App from '/@/App.vue';

// locales
import { createI18n } from 'vue-i18n';
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
import { createVuetify } from '@vuetify/nightly';
import '@mdi/font/css/materialdesignicons.css';
import '@vuetify/nightly/styles';
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
