import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from './socketEvents';

export type socketInstance = Socket<ClientToServerEvents, ServerToClientEvents>
