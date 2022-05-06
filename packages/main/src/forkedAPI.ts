import { fork } from 'child_process';
import { app } from 'electron';
import { resolve } from 'path';
import type { ChildProcess } from 'child_process';
import type { ForkResponse, startPayload } from './types/forkedAPI';

const apiPath = resolve(__dirname, '../', '../', 'api', 'dist', 'index.js');
const wait = (s: number) => new Promise(resolve => setTimeout(resolve, s*1000));

export class ForkedAPI {

  private fork?: ChildProcess;
  private startPending = false;
  private stopPending = false;

  private pingInterval?: NodeJS.Timeout;
  private pongTimeout?: NodeJS.Timeout;
  private port?: number;
  private password?: string;
  private ssl?: startPayload['ssl'];
  private cert?: string | null;
  private key?: string | null;
  private userdata = app.getPath('userData');
  private appdata = app.getPath('appData');
  private tempdata = app.getPath('temp');
  private picturedata = app.getPath('pictures');
  private login = 'admin';

  get running() {
    return !!this.fork;
  }

  private get startPayload():startPayload {
    if(!this.port || !this.password || !this.ssl) throw new Error('startPayload should be defined in init');
    return {
      login: this.login,
      port: this.port,
      password: this.password,
      ssl: this.ssl,
      cert: this.cert,
      key: this.key,
    };
  }

  async init(payload: startPayload) {
    this.login = payload.login;
    this.port = payload.port;
    this.password = payload.password;
    this.ssl = payload.ssl;
    this.cert = payload.cert;
    this.key = payload.key;
    if(this.stopPending || this.startPending) await wait(10);
    if(this.stopPending || this.startPending) this.forceShutdown();
    this.fork = fork(apiPath, {env: {
      ...process.env,
      USER_DATA: this.userdata,
      APP_DATA: this.appdata,
      TEMP_DATA: this.tempdata,
      PICTURE_DATA: this.picturedata,
      MODE: import.meta.env.MODE,
    }});
  }

  private ping() {
    // send ping to fork every 5 seconds
    if(!this.fork) return;
    if(this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.fork?.send({type: 'ping'}, (err) => {
        if(err) {
          console.error(err);
          this.forceShutdown();
          if(!this.password) throw new Error('ping shouldn\'t be called before init');
          this.start(this.startPayload);
        }
      });
    }
    , 5000);
  }

  private pong() {
    if(!this.fork) return;
    if(this.pongTimeout) clearTimeout(this.pongTimeout);
    // if fork doesn't send pong in 10 seconds, force restart
    this.pongTimeout = setTimeout(() => {
      this.forceShutdown();
      if(!this.password) throw new Error('pong shouldn\'t be called before init');
      this.start(this.startPayload);
    }, 10000);

    this.fork.on('message', (msg: ForkResponse) => {
      if(msg.type !== 'pong') return;
      // reset pong timeout if fork responds
      if(this.pongTimeout) clearTimeout(this.pongTimeout);
      this.pongTimeout = setTimeout(() => {
        this.forceShutdown();
        if(!this.password) throw new Error('pong shouldn\'t be called before init');
        this.start(this.startPayload);
      }, 10000);
    });



  }

  public async start(payload: startPayload):Promise<ForkResponse> {
    // init the fork if it hasn't been already
    if(!this.fork) this.init(payload);
    // if fork is already in the process of being started or stoped, wait for it to finish
    if(this.stopPending || this.startPending) await wait(5);
    // if fork is still in the process of being started or stoped after waiting, force shutdown (could happen if process hangs)
    if(this.stopPending || this.startPending) this.forceShutdown();

    // starting the fork
    return new Promise(resolve => {
      // setting up a 5 second timeout after which we force shutdown
      const timeout = setTimeout(() => {
        this.forceShutdown();
        resolve({ type: 'start', success: false, message: 'timeout' });
      }, 5000);
      // sending start message to fork and setting up a watch to see if it responds
      this.fork?.send({type: 'start', payload: this.startPayload});
      this.startPending = true;
      // if fork responds, clear timeout, watcher and resolve
      const listener = (msg: ForkResponse) => {
        if(msg.type === 'start') {
          clearTimeout(timeout);
          this.fork?.removeListener('message', listener);
          this.startPending = false;
          if(msg.success) {
            this.ping();
            this.pong();
          } else {
            this.forceShutdown();
          }
          resolve(msg);
        }

      };
      this.fork?.on('message', listener);
    });
  }

  public async stop():Promise<ForkResponse> {
    // if fork was starting, wait for it to finish
    if(!this.fork && this.startPending) await wait(5);

    // if fork is already in the process of being started or stoped, wait for it to finish
    else if(this.fork && (this.stopPending || this.startPending)) await wait(5);

    // if fork is still in the process of being started or stoped after waiting, force shutdown (could happen if process hangs)
    if(this.stopPending || this.startPending) {
      this.forceShutdown();
      return new Promise(r => r({ type: 'shutdown', success: false, message: 'timeout' }));
    }

    // stoping the fork
    return new Promise(resolve => {
      // setting up a 5 second timeout after which we force shutdown
      const timeout = setTimeout(() => {
        this.forceShutdown();
        resolve({ type: 'shutdown', success: false, message: 'timeout' });
      }, 5000);

      // sending stop message to fork and setting up a watch to see if it responds
      this.fork?.send({type: 'shutdown'});
      this.stopPending = true;

      // if fork responds, clear timeout, watcher and resolve
      const listener = (msg: ForkResponse) => {
        if(msg.type === 'shutdown' && msg.success) {
          clearTimeout(timeout);
          this.fork?.removeListener('message', listener);
          this.startPending = false;
          if(this.pongTimeout) clearTimeout(this.pongTimeout);
          if(this.pingInterval) clearInterval(this.pingInterval);
          resolve(msg);
        }
      };
      this.fork?.on('message', listener);
    });
  }

  private forceShutdown() {
    if(this.fork) {
      this.fork.kill(0);
      this.fork = undefined;
    }
    this.startPending = false;
    this.stopPending = false;
  }
}
