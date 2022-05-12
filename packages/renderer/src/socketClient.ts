import socket from '../../api/src/socket/client';
import type { SocketClientConstructor } from '../../api/src/socket/types/client';

export function socketManager(settings: SocketClientConstructor) {
  return new socket(settings);
}
