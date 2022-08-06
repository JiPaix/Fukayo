import type { LoginAuth, SocketClientConstructor } from '../../../../api/src/client/types';
import { socketManager  } from '/@/socketClient';

export function useSocket(settings:SocketClientConstructor, auth?: LoginAuth) {
  return socketManager(settings).connect(auth);
}
