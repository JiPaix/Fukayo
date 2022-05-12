import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ForkResponse, startPayload } from '../app/types';
import type { ClientToServerEvents, LoginAuth, SocketClientConstructor } from './types';
import type { ServerToClientEvents } from '../server/types';

declare global {
  interface Window { readonly apiServer: { startServer: (payload: startPayload) => Promise<ForkResponse>; stopServer: () => Promise<ForkResponse>; getEnv: string; } }
}

/**
 * Initialize the socket.io client.
 */
export default class socket {

  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private settings: SocketClientConstructor;

  constructor(settings: SocketClientConstructor) {
    this.settings = settings;
  }

  private removeListeners() {
    if(!this.socket) return;
    this.socket.removeAllListeners('token');
    this.socket.removeAllListeners('refreshToken');
    this.socket.removeAllListeners('unauthorized');
    this.socket.removeAllListeners('authorized');
    this.socket.removeAllListeners('connect_error');
  }

  private initSocket() {
    if(!this.socket) throw Error('unreachable');
    this.removeListeners();
    this.socket.on('token', t => this.settings.accessToken = t);
    this.socket.on('refreshToken', t => this.settings.refreshToken = t);
    return this.socket;
  }

  private unplugSocket(socket:Socket<ServerToClientEvents, ClientToServerEvents>, reason?:string) {
    if(socket) {
      this.removeListeners();
      socket.disconnect();
    }
    return reason;
  }

  private getServer() {
    const location = 'localhost:'+this.settings.port;
    // When the server is running in standalone mode, the client uses localhost
    if(!window) return (this.settings.ssl === 'false' ? 'http://': 'https://') + location;

    const url = window.location.href;

    // Case where the client is running in electron
    if(url.includes('file://')) {
      if(this.settings.ssl === 'false') return 'http://' + location;
      return 'https://' + location;
    }

    if(window.apiServer) {
      if(window.apiServer.getEnv === 'development') {
        if(this.settings.ssl === 'false') return 'http://' + location;
        return 'https://' + location;
      }
    }

    const host = url.split('/')[2].replace(/:\d+/g, '');
    const finalLocation = host+':'+this.settings.port;
    if(this.settings.ssl === 'false') return 'http://' + finalLocation;
    return 'https://' + finalLocation;
  }
  connect(auth?: LoginAuth): Promise<Socket<ServerToClientEvents, ClientToServerEvents>> {
    return new Promise((resolve, reject) => {

      if(this.socket && !this.socket.disconnected) {
        console.log('providing already existing socket');
        return resolve(this.initSocket());
      }

      const authentification = auth ? auth : { token: this.settings.accessToken, refreshToken: this.settings.refreshToken };
      const socket:Socket<ServerToClientEvents, ClientToServerEvents> = io(this.getServer(),
      {
        auth: authentification,
        reconnection: true,
      });

      socket.once('authorized', () => {
        this.socket = socket;
        resolve(this.initSocket());
      });

      socket.once('unauthorized', () => {
        const reason = auth ? 'badpassword' : 'expiredtoken';
        reject(this.unplugSocket(socket, reason));
      });

      socket.once('connect_error', (e) => {
        if(e.message === 'xhr poll error') {
          reject(this.unplugSocket(socket, e.message));
        }
      });
    });
  }
}
