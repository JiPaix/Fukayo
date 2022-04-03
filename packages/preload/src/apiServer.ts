import { ipcRenderer } from 'electron';
import type { startPayload } from '../../main/src/forkedAPI';

export async function startServer(payload:startPayload) {
  return ipcRenderer.invoke('start-server', payload);
}

export async function stopServer() {
  return ipcRenderer.invoke('stop-server');
}
