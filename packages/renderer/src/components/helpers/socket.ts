import { socketManager } from '/@/socketClient';
import type { SocketStoreSettings } from '/@/socketClient';

export type authByLogin = {
  login: string
  password: string
}

export  function useSocket(settings:SocketStoreSettings, auth?: authByLogin){
    return socketManager(settings).connect(auth);
}
