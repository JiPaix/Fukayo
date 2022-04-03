import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../api/src/routes/index';
import io from 'socket.io-client';
import type { authByLogin } from './components/helpers/login';

type settings = {
  accessToken?: string | null
  refreshToken?: string | null
  ssl: 'false' | 'provided' | 'app'
  port: number
}
export type sock = Socket<ServerToClientEvents, ClientToServerEvents>
class socket {

  public connected: boolean;

  private socket?: sock;
  private password?: string;
  private needLogin: boolean;
  private settings: settings;

  constructor(settings:settings) {
    this.settings =  settings;
    this.connected = false;
    this.needLogin = false;
  }
  get auth() {
    if(this.settings.accessToken && this.settings.refreshToken) {
      return {
        accessToken: this.settings.accessToken,
        refreshToken: this.settings.refreshToken,
      };
    }
  }
  get use() {
    if(!this.socket) this.connect();
    if(!this.socket) throw Error('call use before connect');
    return this.socket;
  }
  get login() {
    return this.connected && this.needLogin;
  }
  connect(auth?: authByLogin) {
    if(this.socket && !this.socket.disconnected) return this.socket;
    const authentification = auth ? auth : { token: this.settings.accessToken, refreshToken: this.settings.refreshToken };
    const socket:sock = io(this.getServer(),
    {
      auth: authentification,
      reconnection: true,
    });

    socket.on('connect', () => this.connected = true);
    socket.on('connect_error', (e) => {
      this.connected = false;
      if(e.message === 'xhr poll error') {
        socket.disconnect();
      }
    });
    socket.on('disconnect', ()=> this.connected = false);
    socket.on('token', t => this.settings.accessToken = t);
    socket.on('refreshToken', t => this.settings.refreshToken = t);

    return socket;
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

let socketInstance: socket;
export function socketManager(settings:settings) {
  if(socketInstance) return socketInstance;
  socketInstance = new socket(settings);
  return socketInstance;
}
