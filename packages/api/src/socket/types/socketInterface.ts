import type { Socket } from 'socket.io';
import type { Socket as SocketClient } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './socketEvents';

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>
export type socketClientInstance = SocketClient<ServerToClientEvents, ClientToServerEvents>
