import {createApp} from 'vue';
import App from '/@/App.vue';

// stores
import { store as storeSettings, key as keySettings } from './store/settings';

const myApp = createApp(App);
myApp.use(storeSettings, keySettings);


myApp.mount('#app');
// basically trying stuff
