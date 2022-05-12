import type { LoginAuth, SocketClientConstructor } from '../../../../api/src/socket/types/client';
import { socketManager  } from '/@/socketClient';

export function useSocket(settings:SocketClientConstructor, auth?: LoginAuth){
  return socketManager(settings).connect(auth);
}
