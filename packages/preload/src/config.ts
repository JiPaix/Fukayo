import { ipcRenderer } from 'electron';

export async function configPath() {
  const path = await ipcRenderer.invoke('userData');
  return path;
}
