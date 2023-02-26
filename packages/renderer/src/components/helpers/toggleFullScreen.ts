import { ref } from 'vue';

const isElectron = typeof window.apiServer !== 'undefined' ? true : false;

export const isFullScreen = ref(false);

export function toggleFullScreen() {
  if(isFullScreen.value) return windowed();
  else return fullscreen();
}

async function fullscreen() {
  isFullScreen.value = true;
  if(isElectron) window.apiServer.toggleFullScreen();
  else {
    const app = document.querySelector('#app');
    if(!app) return;
    await app.requestFullscreen();
  }
}


async function windowed() {
  isFullScreen.value = false;
  if(isElectron) window.apiServer.toggleFullScreen();
  else {
    await document.exitFullscreen();
  }
}
