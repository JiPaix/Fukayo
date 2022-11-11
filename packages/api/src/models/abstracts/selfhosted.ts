import Mirror from '@api/models/abstracts';
import type { MirrorConstructor } from './../types/constructor';
import net from 'net';

type options = {
  login?: string | null,
  password?: string | null,
  host?: string | null,
  port?: number | null,
  protocol: 'http' | 'https',
  markAsRead: boolean
}

export class SelfHosted extends Mirror<options> {
  selfhosted = true;
  #credentialRequired: boolean;
  #online = false;
  constructor(opts: MirrorConstructor<options>, credentialRequired:boolean) {
    super(opts);
    this.#credentialRequired = credentialRequired;

    setTimeout(async () => {
      if(!this.options.host || !this.options.port) return;
      await this.#checkOnline(this.options.host, this.options.port);
    }, 30*1000);
  }

  async init() {
    const init = await super.init();
    if(this.options.host && this.options.port) await this.#checkOnline(this.options.host, this.options.port);
    return init;
  }

  #checkOnline(ip:string, port:number):Promise<boolean> {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    return new Promise(ok => {
      const resolve = (bool:boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        this.logger('is', bool ? 'online':'offline');
        this.#online = bool;
        ok(bool);
      };
      socket
        .on('connect', () => resolve(true))
        .on('error', ()=> resolve(false))
        .on('timeout', () => resolve(false))
        .connect(port, ip);
    });
  }

  public get enabled(): boolean {
    if(this.#credentialRequired) {
      const { enabled, host, port, password, login} = this.options;
      if(enabled && host && port && password && login && this.#online) return true;
      return false;
    } else {
      const { enabled, host, port } = this.options;
      if (enabled && host && port) return true;
      return false;
    }
  }

  set enabled(val: boolean) {
    this.options.enabled = val;
  }
}
