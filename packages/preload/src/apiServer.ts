import { ipcRenderer } from 'electron';

export async function startServer(port:number, password: string) {
  return ipcRenderer.invoke('start-server', {port, password});
}

export async function stopServer() {
  return ipcRenderer.invoke('stop-server');
}
