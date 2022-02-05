import {createApp} from 'vue';
import App from '/@/App.vue';
import { Quasar } from 'quasar';

// Import Quasar css
import 'quasar/dist/quasar.css';
// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css';

const myApp = createApp(App);

myApp.use(Quasar, {
  plugins: {}, // import Quasar plugins and add here
  /*
  config: {
    brand: {
      // primary: '#e46262',
      // ... or all other brand colors
    },
    notify: {...}, // default set of options for Notify Quasar plugin
    loading: {...}, // default set of options for Loading Quasar plugin
    loadingBar: { ... }, // settings for LoadingBar Quasar plugin
    // ..and many more (check Installation card on each Quasar component/directive/plugin)
  }
  */
});

myApp.mount('#app');
