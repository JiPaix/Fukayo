import socket from '@api/client';
import type { SocketClientConstructor } from '@api/client/types';

let sock:socket|null = null;

export function socketManager(settings: SocketClientConstructor) {
  if(sock) return sock;
  sock = new socket(settings);
  return sock;
}
