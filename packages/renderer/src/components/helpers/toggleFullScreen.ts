import { ref } from 'vue';
import { AppFullscreen } from 'quasar';

const isElectron = typeof window.apiServer !== 'undefined' ? true : false;

export const isFullScreen = ref(false);

export async function toggleFullScreen():Promise<void> {
  if(isElectron) return window.apiServer.toggleFullScreen();
  else return AppFullscreen.toggle();
}
