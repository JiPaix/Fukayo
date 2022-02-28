import { ipcRenderer } from 'electron';

export async function quit() {
  await ipcRenderer.invoke('quit');
}

export async function minimize() {
  await ipcRenderer.invoke('minimize');
}

export async function maximize() {
  return ipcRenderer.invoke('maximize');
}
