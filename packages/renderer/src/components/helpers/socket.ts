import type { SocketStoreSettings } from '/@/socketClient';
import { socketManager } from '/@/socketClient';

export  function useSocket(settings:SocketStoreSettings) {
    return socketManager(settings).connect();
}
