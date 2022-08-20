import type { ForkResponse, startPayload } from '@api/app/types';
import type { ForkEnv } from '@api/types';
import type { ChildProcess } from 'child_process';
import { fork } from 'child_process';
import { app } from 'electron';
import { join } from 'path';

const apiPath = join(__dirname, '..', '..', 'api', 'dist', 'index.cjs.js');
const wait = (s: number) => new Promise(resolve => setTimeout(resolve, s*1000));

export class forkAPI {

  private startPending = false;
  private stopPending = false;

  private pingInterval?: NodeJS.Timeout;
  private pongTimeout?: NodeJS.Timeout;

  private fork?: ChildProcess;
  private forkEnv: ForkEnv;

  constructor(payload: startPayload) {
    this.forkEnv = {
      LOGIN: payload.login,
      PASSWORD: payload.password,
      PORT: payload.port.toString(),
      HOSTNAME: payload.hostname,
      SSL: payload.ssl,
      VIEW: join(__dirname, '..', '..', 'renderer', 'dist'),
      CERT: typeof payload.cert === 'string' ? payload.cert : undefined,
      KEY: typeof payload.key  === 'string' ? payload.key : undefined,
      USER_DATA: app.getPath('userData'),
      DOWNLOAD_DATA: app.getPath('downloads'),
      MODE: import.meta.env.MODE,
    };
  }

  get running() {
    return !!this.fork;
  }

  get port() { return this.forkEnv.PORT; }
  get login() { return this.forkEnv.LOGIN; }
  get password() { return this.forkEnv.PASSWORD; }
  get ssl() { return this.forkEnv.SSL; }
  get hostname() { return this.forkEnv.HOSTNAME; }
  get cert() { return this.forkEnv.CERT; }
  get key() { return this.forkEnv.KEY; }

  private get startPayload():startPayload {
    if(!this.port || !this.password || !this.ssl) throw new Error('startPayload should be defined in init');
    return {
      login: this.login,
      port: parseInt(this.port),
      hostname: this.hostname,
      password: this.password,
      ssl: this.ssl,
      cert: this.cert,
      key: this.key,
    };
  }

  async init() {
    if(this.stopPending || this.startPending) await wait(10);
    if(this.stopPending || this.startPending) this.forceShutdown();
    const forkenv = { ...process.env, ...this.forkEnv };
    this.fork = fork(apiPath, {
      env: forkenv,
    });
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
          this.start();
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
      this.start();
    }, 10000);

    this.fork.on('message', (msg: ForkResponse) => {
      if(msg.type !== 'pong') return;
      // reset pong timeout if fork responds
      if(this.pongTimeout) clearTimeout(this.pongTimeout);
      this.pongTimeout = setTimeout(() => {
        this.forceShutdown();
        if(!this.password) throw new Error('pong shouldn\'t be called before init');
        this.start();
      }, 10000);
    });
  }

  public async start():Promise<ForkResponse> {
    // init the fork if it hasn't been already
    if(!this.fork) this.init();
    // if fork is already in the process of being started or stoped, wait for it to finish
    if(this.stopPending || this.startPending) await wait(5);
    // if fork is still in the process of being started or stoped after waiting, force shutdown (could happen if process hangs)
    if(this.stopPending || this.startPending) this.forceShutdown();
    // starting the fork
    return new Promise(resolve => {
      // setting up a 60 seconds timeout after which we force shutdown
      const timeout = setTimeout(() => {
        this.forceShutdown();
        resolve({ type: 'start', success: false, message: 'timeout' });
      }, 60*1000);
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
