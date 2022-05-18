import socket from '../../api/src/client';
import type { SocketClientConstructor } from '../../api/src/client/types';

export function socketManager(settings: SocketClientConstructor) {
  return new socket(settings);
}
