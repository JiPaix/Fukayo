import { ipcRenderer } from 'electron';

export async function show() {
  const path = await ipcRenderer.invoke('userData');
  return path;
}
