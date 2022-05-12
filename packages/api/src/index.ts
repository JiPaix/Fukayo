import { env } from 'node:process';
import express from 'express';
import morgan from 'morgan';
import { Fork } from './fork/index';
import { verify } from './standalone';
import client from './socket/client';

// verify process.env variables are set
verify();


// basic express setup
const app = express();

// serve APP
if(env.VIEW) {
  app.use(express.static(env.VIEW));
}

// custom 404 page
app.use((req, res, next) => {
  if(res.headersSent) return next();
  if(env.VIEW) res.status(404).json({error: 'not_found'});
  next();
});

// enable logging
if (env.MODE === 'development') {
  app.use(morgan('common'));
} else {
  app.use(morgan('[api] :method :url :status :response-time ms - :res[content-length]'));
}

export default function useFork():Promise<client> {
  return new Promise((resolve, reject) => {
    const fork = new Fork(app);
    let timeout: NodeJS.Timeout | undefined;
    if(!env.ELECTRON_RUN_AS_NODE) timeout = setTimeout(() => reject(new Error('timeout')), 10000);
    fork.once('start', ({success, message}) => {
      if(success && message) {
        if(!env.ELECTRON_RUN_AS_NODE) {
          setInterval(() => fork.restartPingTimeout(), 5000);
          if(timeout) clearTimeout(timeout);
        }
        return resolve(new client({
          accessToken: message.split('[split]')[0],
          refreshToken: message.split('[split]')[1],
          ssl: env.SSL,
          port: parseInt(env.PORT),
        }));
      }
      return reject(new Error(message));
    });
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
