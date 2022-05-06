import { ipcRenderer } from 'electron';

export type Paths =
  'userData'| 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

export async function getPath(path: Paths): Promise<string> {
  return ipcRenderer.invoke('get-path', path);
}
