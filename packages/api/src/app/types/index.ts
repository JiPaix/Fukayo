export type Message = ShutdownMessage | StartMessage | PingMessage;

export type ShutdownMessage = {
  type: 'shutdown'|'shutdownFromWeb';
}

export type StartMessage = {
  type: 'start';
  payload: startPayload
}

export type PingMessage = {
  type: 'ping';
}

export type ForkResponse = {
  type: 'start' | 'shutdown' | 'shutdownFromWeb' | 'pong',
  success?: boolean,
  message?: string,
}

export type startPayload = {
  login: string,
  password: string,
  port: number,
  hostname?: string,
  ssl: 'false' | 'provided' | 'app',
  cert?: string | null,
  key?: string | null,
}
