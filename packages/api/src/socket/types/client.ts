export type SocketClientConstructor = {
  accessToken?: string | null,
  refreshToken?: string | null,
  ssl: 'false' | 'provided' | 'app',
  port: number,
}

export type LoginAuth = { login: string, password:string }
