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

// // vuetify
// import { createVuetify } from '@vuetify/nightly';
// import '@mdi/font/css/materialdesignicons.css';
// import '@vuetify/nightly/styles';
// const vuetify = createVuetify();

// quasar
import { Quasar, Dialog, Notify, Loading } from 'quasar';
import '@quasar/extras/roboto-font/roboto-font.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@quasar/extras/material-icons-outlined/material-icons-outlined.css';
import '@quasar/extras/material-icons-round/material-icons-round.css';
import 'quasar/dist/quasar.css';

// pinia stores
import { createPinia } from 'pinia';
import { piniaLocalStorage } from './store/localStorage';
const pinia = createPinia();
pinia.use(piniaLocalStorage);

// flags
import 'flag-icons';

// init
const myApp = createApp(App);
myApp.use(Quasar, {
  plugins: {Dialog, Notify, Loading},
  config: {
    brand: {
      primary: '#3d75ad',
      secondary: '#4da89f',
      accent: '#9C27B0',

      dark: '#1d1d1d',

      positive: '#3b9c52',
      negative: '#b53645',
      info: '#61c1d4',
      warning: '#dbb54d',
    },
  },
});
myApp.use(pinia);
myApp.use(i18n);
// myApp.use(vuetify);
myApp.mount('#app');
