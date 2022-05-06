/**
 * Payload to start the server
 * @important startPayload should also be defined in
 */
 export type startPayload = {
  login:string,
  password: string,
  port: number,
  ssl: 'false' | 'provided' | 'app',
  cert?: string | null,
  key?: string | null,
}

/** Response from server */
export type ForkResponse = {
  type: 'start' | 'shutdown' | 'pong',
  success: boolean,
  message?: string,
}
