import crypto from 'node:crypto';
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import generateKeyPair from '../lib/certificate';
import IOWrapper from '../routes';
import type { ForkResponse, Message, StartMessage } from '../types';
import type { Server } from 'node:http';
import type { Server as httpsServer } from 'node:https';
import type { Express } from 'express';


const isMessage = (message: unknown): message is Message => {
  if(typeof message !== 'object') return false;
  if(!(message as Message).type) return false;
  return true;
};

export class Fork {
  private runner?: Server | httpsServer;
  private pingTimeout?: NodeJS.Timeout | undefined;
  private process: NodeJS.Process;
  private app: Express;
  private credentials: { login: string, password: string };

  constructor(process: NodeJS.Process, app: Express) {
    this.process = process;
    this.app = app;
    this.credentials = { login: 'admin', password: 'password' }; // temporary
    this.process.on('message', (m) => {
      this.redirect(m);
    });
  }

  private send(type: ForkResponse['type'], success?: ForkResponse['success'], message?: ForkResponse['message']) {
    if(this.process.send) this.process.send({type, success, message}, undefined, undefined, (e) => {
      if(e) {
        this.killRunner();
      }
    });
  }

  private restartPingTimeout() {
    if(this.pingTimeout) clearTimeout(this.pingTimeout);
    this.send('pong');
    this.pingTimeout = setTimeout(() => {
      this.killRunner();
    }, 10000);
  }

  private killRunner(expectReturn = false, message?: string) {
    if(!this.runner || this.process.send) return;
    if(this.runner.listening) this.runner.close(e => {
      if(expectReturn) this.send('shutdown', typeof e === 'undefined', e?.message || message);
      process.exit(0);
    });
  }

  private start(payload:StartMessage['payload']) {
    this.credentials = { login: payload.login, password: payload.password };
    try {
      // create the runner
      if(payload.ssl === 'false') this.http(payload.port);
      else if(payload.ssl === 'app') this.https(payload.port, payload.hostname);
      else if(payload.ssl === 'provided') this.httpsWithProvidedCert(payload.port, payload.cert, payload.key);
      this.startRunner();
    } catch(e) {
      if(e instanceof Error) this.send('start', false, e.message);
      else if(typeof e === 'string') this.send('start', false, e);
      else this.send('start', false, 'unknown_error');
      this.killRunner(false);
    }
  }

  private startRunner() {
    if(!this.runner) return this.killRunner(false);
    this.runner
      .once('listening', () => {
        const accessToken = crypto.randomBytes(32).toString('hex');
        const refreshToken = crypto.randomBytes(32).toString('hex');

        this.send('start', true, accessToken+'[split]'+refreshToken);
        if(this.runner /** should alway be true */) new IOWrapper(this.runner, this.credentials, {accessToken, refreshToken});
      })
      .on('error', (e) => this.killRunner(true, e.message));
  }

  private http(port: number) {
    this.runner = createHttp(this.app).listen(port);
  }

  private https(port: number, url?:string) {
    if(!url) return this.send('start', false, 'hostname_not_provided');
    const hostname = new URL(url).hostname;
    const pem = generateKeyPair(hostname, ['localhost']);
    this.runner = createHttps({
      cert: pem.hostCert.cert,
      key: pem.hostCert.key,
    }, this.app).listen(port);
  }

  private httpsWithProvidedCert(port: number, cert?: string | null, key?: string | null) {
    if(typeof cert !== 'string') return this.send('start', false, 'certificate_not_provided');
    if(typeof key !== 'string') return this.send('start', false, 'key_not_provided');
    this.runner = createHttps({
      cert: cert,
      key: key,
     }, this.app).listen(port);
  }

  private redirect(message: Message | unknown) {
    if(!isMessage(message)) return;
    else if(message.type === 'start') return this.start(message.payload);
    else if(message.type === 'shutdown') return this.killRunner(true);
    else if(message.type === 'ping') return this.restartPingTimeout();
    else this.send('start', false, 'ssl_type_not_provided');
  }
}
