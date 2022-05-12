import { env } from 'node:process';
import express from 'express';
import morgan from 'morgan';
import { Fork } from './fork/index';
import { verify } from './standalone';
import client from './socket/client';
import type { ForkEnv } from './types';

export default function useFork(settings: ForkEnv = env):Promise<client> {
  // put settings in global scope
  if(settings) {
    let k:keyof typeof settings;
    for (k in settings) {
        if(k === 'SSL') env[k] = settings[k] as 'app' | 'provided' | 'false';
        else env[k] = settings[k] as string;
    }
  }
  // verify settings (type and value)
  verify();

  // Express config
  const app = express();

  // serve the view if any
  if(env.VIEW) {
    app.use(express.static(env.VIEW));
  }

  // 403-404 handler
  app.use((req, res, next) => {
    if(res.headersSent) return next();
    if(env.VIEW) res.status(404).json({error: 'not_found'});
    else res.status(403).send('Forbidden');
    next();
  });

  // enable logging
  if (env.MODE === 'development') {
    app.use(morgan('common'));
  } else {
    app.use(morgan('[api] :method :url :status :response-time ms - :res[content-length]'));
  }

  // starting the server
  return new Promise((resolve, reject) => {
    const fork = new Fork(app);

    // timeout on startup
    let timeout: NodeJS.Timeout | undefined;
    // pings to keep the server alive
    let pings:() => NodeJS.Timer | undefined;

    // The ForkAPI handles that for us, but we need to do it manually when used standalone
    if(!env.ELECTRON_RUN_AS_NODE) {
      timeout = setTimeout(() => reject(new Error('timeout')), 10000);
      pings = () => setInterval(() => fork.restartPingTimeout(), 5000);
    }

    // listening for the start message
    fork.once('start', ({success, message}) => {
      if(success && message) {
        // clear timeout and start pinging if standalone
        if(!env.ELECTRON_RUN_AS_NODE) {
          if(pings) pings();
          if(timeout) clearTimeout(timeout);
        }
        // return a socket.io client
        return resolve(new client({
          accessToken: message.split('[split]')[0],
          refreshToken: message.split('[split]')[1],
          ssl: env.SSL,
          port: parseInt(env.PORT),
        }));
      }
      return reject(new Error(message));
    });
    // The ForkAPI handles that for us, but we need to do it manually when used standalone
    if(!env.ELECTRON_RUN_AS_NODE) {
      fork.start({
        login: env.LOGIN,
        password: env.PASSWORD,
        port: parseInt(env.PORT),
        hostname: env.HOSTNAME,
        ssl: env.SSL,
        cert: env.CERT,
        key: env.KEY,
       });
    }

  });
}

if(env.ELECTRON_RUN_AS_NODE) {
  useFork().catch(console.error);
}
