import { ipcRenderer } from 'electron';

export async function quit() {
  await ipcRenderer.invoke('quit-app');
}
