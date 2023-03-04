import { AppFullscreen, Notify } from 'quasar';
import { ref } from 'vue';

const isElectron = typeof window.apiServer !== 'undefined' ? true : false;

export const isFullScreen = ref(false);

export const focusMode = ref(false);

export async function toggleFullScreen():Promise<void> {
  if(isElectron) return window.apiServer.toggleFullScreen();
  else return AppFullscreen.toggle();
}

export function notify(message: string) {
  Notify.create({
    icon: 'info',
    color: 'orange-7',
    position: 'top',
    message,
    html: true,
  });
}
