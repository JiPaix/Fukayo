import type { Server } from 'http';
import type { Server as httpsServer } from 'https';
import crypto from 'crypto';
import { createServer as createHttp } from 'http';
import { createServer as createHttps } from 'https';
import express from 'express';
import { join } from 'path';
import morgan from 'morgan';
import generateKeyPair from './lib/certificate';
import IOWrapper from './routes';

// basic express setup
const app = express();

// default credentials, these are placeholders and will be changed by the user at startup
const CREDENTIALS = {
  login: 'admin',
  password: 'password',
};


// serve APP
app.use('/', express.static(join(__dirname, '../', '../', 'renderer', 'dist')));
app.use('/', express.static(join(__dirname, '../', '../', 'renderer', 'dist', 'index.html')));

// custom 404 page
app.use((req, res, next) => {
  if(res.headersSent) return next();
  res.status(404).json({error: 'not_found'});
  next();
});

// enable logging
if (process.env.MODE === 'development') {
  app.use(morgan('common'));
} else {
  app.use(morgan('[api] :method :url :status :response-time ms - :res[content-length]'));
}

let runner: Server | httpsServer | undefined;

type ForkResponse = {
  type: 'start' | 'shutdown' | 'pong',
  success: boolean,
  message?: string,
}

type startPayload = {
  login: string,
  password: string,
  port: number,
  ssl: 'false' | 'provided' | 'app',
  cert?: string | null,
  key?: string | null,
}

type ShutdownMessage = {
  type: 'shutdown';
}

type StartMessage = {
  type: 'start';
  payload: startPayload
}
type PingMessage = {
  type: 'ping';
}
type Message = ShutdownMessage | StartMessage | PingMessage;


let pingTimeout: NodeJS.Timeout | undefined;

/**
 * Make sure the fork close itself if it lost connection to its parent
 */
function restartPingTimeout() {
  if(pingTimeout) clearTimeout(pingTimeout);
  pingTimeout = setTimeout(() => {
    killRunner();
  }, 10000);
}

process.on('message', (msg:Message) => {

  // on shutdown requests
  if(msg.type === 'shutdown') {
    console.log('[api]', 'shutdown request received');
    killRunner(true);
  }

  // on start requests
  if(msg.type === 'start') {
    console.log('[api]', 'start request received');
    setAppPassword(msg.payload.login, msg.payload.password);
    // set a timeout
    const timeout = setTimeout(() => {
      killRunner(true, 'timeout_in_fork');
    }, 5000);

    // start http|s server
    switch (msg.payload.ssl) {
      // no ssl
      case 'false':
          console.log('[api]', 'no ssl');
          runner = createHttp(app).listen(msg.payload.port);
        break;
      // user provided ssl
      case 'provided':
        if(typeof msg.payload.cert !== 'string' && process.send) return respond('start', false, 'certificate_not_provided');
        if(typeof msg.payload.key !== 'string' && process.send) return respond('start', false, 'key_not_provided');
        if(typeof msg.payload.key === 'string' && typeof msg.payload.cert === 'string') {
          console.log('[api]', 'provided SSL');
          runner = createHttps({
            cert: msg.payload.cert,
            key: msg.payload.key,
           }, app).listen(msg.payload.port);
        }
        break;
      // use app ssl
      case 'app':
        console.log('[api]', 'app SSL');
        // eslint-disable-next-line no-case-declarations
        const pem = generateKeyPair('api', ['localhost']);
        runner = createHttps({
          cert: pem.hostCert.cert,
          key: pem.hostCert.key,
        }, app).listen(msg.payload.port);
        break;
      // should never happen
      default: return respond('start', false, 'ssl_type_not_provided');
    }

    // double check but should never happen
    if(!runner) {
      respond('start', false, 'fork_failed_to_start');
      return killRunner();
    }

    // storing error listener so we can remove it later
    const errorListener = (err: Error) => {
      if(timeout) clearTimeout(timeout);
      respond('start', false, err.message);
      killRunner();
    };

    // handle success and errors
    runner
      .once('listening', () => {
        console.log('[api]', 'fork listening on port', msg.payload.port);
        clearTimeout(timeout);
        const accessToken = crypto.randomBytes(32).toString('hex');
        const refreshToken = crypto.randomBytes(32).toString('hex');

        respond('start', true, accessToken+'[split]'+refreshToken);
        runner?.removeListener('error', errorListener);
        startSocketIO({accessToken, refreshToken});
      })
      .once('error', errorListener);
  }

  // on ping requests
  if(msg.type === 'ping') {
    if(process.send) process.send({type: 'pong'}, undefined, undefined, (err) => {
      if(err) killRunner();
      restartPingTimeout();
    });
  }
});

function killRunner(expectReturn = false, message?: string) {
  if(!runner) return;
  if(runner && runner.listening) runner.close((err) => {
    if(err && process.send && expectReturn) process.send({type: 'shutdown', success: false, message: err.message+'\nFORCED EXIT'} as ForkResponse);
    else if(process.send && expectReturn) process.send({type: 'shutdown', success: true, message} as ForkResponse);
  });
  process.exit(0);
}

function respond(type: ForkResponse['type'], success: ForkResponse['success'], message?: ForkResponse['message']) {
  if(process.send) process.send({type, success, message});
}

function setAppPassword(userLogin: string, userPassword:string) {
  CREDENTIALS.login = userLogin;
  CREDENTIALS.password = userPassword;
}



function startSocketIO({accessToken, refreshToken}: {accessToken: string, refreshToken: string}) {
  if(!runner) return;
  new IOWrapper(runner, CREDENTIALS, {accessToken, refreshToken});
}

export const server = app;
