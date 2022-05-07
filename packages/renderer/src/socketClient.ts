import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../api/src/routes/types/socketEvents';
import type { authByLogin } from './components/helpers/socket';

export type SocketStoreSettings = {
  accessToken?: string | null
  refreshToken?: string | null
  ssl: 'false' | 'provided' | 'app'
  port: number
}
export type sock = Socket<ServerToClientEvents, ClientToServerEvents>
class socket {

  private socket?: sock;
  private settings: SocketStoreSettings;

  constructor(settings:SocketStoreSettings) {
    this.settings =  settings;

  }

  private removeListeners() {
    if(this.socket) {
      this.socket.removeAllListeners('token');
      this.socket.removeAllListeners('refreshToken');
      this.socket.removeAllListeners('unauthorized');
      this.socket.removeAllListeners('authorized');
      this.socket.removeAllListeners('connect_error');
    }
  }
  private initSocket() {
    if(!this.socket) throw Error('unreachable');
    this.removeListeners();
    this.socket.on('token', t => this.settings.accessToken = t);
    this.socket.on('refreshToken', t => this.settings.refreshToken = t);
    return this.socket;
  }

  private unplugSocket(reason?:string) {
    if(this.socket) {
      this.removeListeners();
      if(this.socket.connected) this.socket.disconnect();
    }
    return reason;
  }

  connect(auth?: authByLogin): Promise<sock> {
    return new Promise((resolve, reject) => {

      if(this.socket && !this.socket.disconnected) {
        console.log('providing already existing socket');
        return resolve(this.initSocket());
      }

      const authentification = auth ? auth : { token: this.settings.accessToken, refreshToken: this.settings.refreshToken };
      const socket:sock = io(this.getServer(),
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
        reject(this.unplugSocket(reason));
      });

      socket.once('connect_error', (e) => {
        if(e.message === 'xhr poll error') {
          reject(this.unplugSocket(e.message));
        }
      });
    });
  }

  private getServer() {
    const url = window.location.href;
    const location = 'localhost:'+this.settings.port;
    if(url.includes('file://')) {
      if(this.settings.ssl === 'false') return `http://${location}`;
      else return `https://${location}`;
    }
    if(window.apiServer) {
      if(window.apiServer.getEnv === 'development') {
      if(this.settings.ssl === 'false') return `http://${location}`;
      else return `https://${location}`;
      }
    }
    const host = url.split('/')[2].replace(/:\d+/g, '');
    const finalLocation = host+':'+this.settings.port;
    return url.includes('https') ? `https://${finalLocation}` : `http://${finalLocation}`;
  }
}

export function socketManager(settings:SocketStoreSettings) {
  return new socket(settings);
}
