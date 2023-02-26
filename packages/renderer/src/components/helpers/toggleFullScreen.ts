import { ref } from 'vue';

const isElectron = typeof window.apiServer !== 'undefined' ? true : false;

export const isFullScreen = ref(false);

export function toggleFullScreen() {
  if(isElectron) window.apiServer.toggleFullScreen();
  else {
    const doc = window.document;
    const docEl = doc.documentElement;
    if(doc.fullscreenEnabled) doc.exitFullscreen.call(docEl);
    else docEl.requestFullscreen();
  }
  isFullScreen.value = !isFullScreen.value;
}

