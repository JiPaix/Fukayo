import { socketManager } from '/@/socketClient';
import type { authByLogin } from './login';
import type { SocketStoreSettings } from '/@/socketClient';


export  function useSocket(settings:SocketStoreSettings, auth?: authByLogin){
    return socketManager(settings).connect(auth);
}
