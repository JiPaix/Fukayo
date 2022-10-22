import type { LoginAuth, SocketClientConstructor } from '@api/client/types';
import { socketManager } from '@renderer/socketClient';

export function useSocket(settings:SocketClientConstructor, auth?: LoginAuth) {
  return socketManager(settings).connect(auth);
}
