import type { ForkResponse, Message, StartMessage } from '@api/app/types';
import IOWrapper from '@api/server';
import generateKeyPair from '@api/utils/certificate';
import type { Buffer } from 'buffer';
import crypto from 'crypto';
import EventEmitter from 'events';
import type { Express } from 'express';
import { readFileSync } from 'fs';
import type { Server } from 'http';
import { createServer as createHttp } from 'http';
import type { Server as httpsServer } from 'https';
import { createServer as createHttps } from 'https';
import { env } from 'process';
import type TypedEmitter from 'typed-emitter';
import type internal from 'stream';

const isMessage = (message: unknown): message is Message => {
  if(typeof message !== 'object') return false;
  if(!(message as Message).type) return false;
  return true;
};

type ForkEvents = {
  start: (res:{ success: ForkResponse['success'], message?: ForkResponse['message'] }) => void
  shutdown: (res:{ success: ForkResponse['success'], message?: ForkResponse['message'] }) => void
  shutdownFromWeb: (res:{ success: ForkResponse['success'], message?: ForkResponse['message'] }) => void
  pong: (res:{ success: ForkResponse['success'], message?: ForkResponse['message'] }) => void
}

/**
 * ForkAPI
 */
export class Fork extends (EventEmitter as new () => TypedEmitter<ForkEvents>) {
  private runner?: Server | httpsServer;
  private pingTimeout?: NodeJS.Timeout | undefined;
  private app: Express;
  private credentials: { login: string, password: string };
  #wrapper?: IOWrapper;
  #sockets: Set<internal.Duplex> = new Set();
  constructor(app: Express) {
    super();
    this.app = app;
    this.credentials = { login: env.LOGIN || 'admin', password: env.PASSWORD || 'password' };
    process.on('message', (m) => {
      this.redirect(m);
    });
  }

  send(type: ForkResponse['type'], success?: ForkResponse['success'], message?: ForkResponse['message']) {
    this.emit(type, { success, message });
    if(process.send) process.send({type, success, message}, undefined, undefined, (e) => {
      if(e) {
        this.killRunner();
      }
    });
  }

  restartPingTimeout() {
    if(this.pingTimeout) clearTimeout(this.pingTimeout);
    this.send('pong');
    this.pingTimeout = setTimeout(() => {
      this.killRunner(false, 'timeout');
    }, 10000);
  }

  private async killRunner(expectReturn = false, message?: string) {
    if(this.runner && this.runner.listening) {
      this.#closeRunner();
      await new Promise(resolve => this.runner?.close(resolve));
      console.log('[api]', '(\x1b[33mweb-server\x1b[0m)', 'closed');
    }
    if(this.#wrapper) await this.#wrapper.shutdown();

    if(expectReturn) this.send('shutdown', true, message);
    process.exit(0);
  }

  start(payload:StartMessage['payload']) {
    this.credentials = { login: payload.login, password: payload.password };
    try {
      // create the runner
      if(payload.ssl === 'false') this.runner = this.http();
      else if(payload.ssl === 'app') this.runner = this.https(payload.hostname);
      else if(payload.ssl === 'provided') this.runner = this.httpsWithProvidedCert();
      return this.startRunner(payload.port);
    } catch(e) {
      if(e instanceof Error) this.send('start', false, e.message);
      else if(typeof e === 'string') this.send('start', false, e);
      else this.send('start', false, 'unknown_error');
      return this.killRunner(false);
    }
  }

  #closeRunner() {
    if(!this.runner) return;
    this.#sockets.forEach(s => s.destroy());
  }

  private startRunner(port:number) {
    if(!this.runner) return; // shouldn't happen
    this.runner
      .once('listening', this.event_start_listening.bind(this))
      .once('error', this.event_start_error.bind(this))
      .on('connection', socket => {
        this.#sockets.add(socket);
        socket.once('close', () => this.#sockets.delete(socket));
      })
      .listen(port);
  }

  private event_start_listening() {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    if(!this.runner) throw new Error('runner_not_created, unexpected');
    this.#wrapper = IOWrapper.getInstance(this.runner, this.credentials, { accessToken, refreshToken });
    this.send('start', true, accessToken+'[split]'+refreshToken);
    this.runner.off('error', this.event_start_error.bind(this));
  }

  private event_start_error(e:Error) {
    if(this.runner /** should not happen */) this.runner.off('listening', this.event_start_listening.bind(this));
    this.send('start', false, e.message);
    this.killRunner(true, e.message);
  }

  private http() {
    return createHttp(this.app);
  }

  private https(url?:string) {
    if(!url) throw 'hostname_not_provided';
    const hostname = new URL(url).hostname;
    const pem = generateKeyPair(hostname, ['localhost']);
    return createHttps({
      cert: pem.hostCert.cert,
      key: pem.hostCert.key,
    }, this.app);
  }

  private httpsWithProvidedCert() {
    if(typeof env.CERT !== 'string') throw 'certificate_not_provided';
    if(typeof env.KEY !== 'string') throw 'key_not_provided';
    const keycert = {
      cert: env.CERT as string | Buffer,
      key: env.KEY as string | Buffer,
    };
    if(!env.ELECTRON_RUN_AS_NODE) {
      keycert.cert = readFileSync(env.CERT);
      keycert.key = readFileSync(env.KEY);
    }
    return createHttps(keycert, this.app);
  }

  private redirect(message: Message | unknown) {
    if(!isMessage(message)) return;
    else if(message.type === 'start') return this.start(message.payload);
    else if(message.type === 'shutdown') return this.killRunner(true, message.type === 'shutdown' ? (message as ForkResponse).message : undefined);
    else if(message.type === 'ping') return this.restartPingTimeout();
    else this.send('start', false, 'ssl_type_not_provided');
  }
}
