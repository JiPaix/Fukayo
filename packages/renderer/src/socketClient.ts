import socket from '../../api/src/client';
import type { SocketClientConstructor } from '../../api/src/client/types';

let sock:socket|null = null;

export function socketManager(settings: SocketClientConstructor) {
  if(sock) return sock;
  sock = new socket(settings);
  return sock;
}
