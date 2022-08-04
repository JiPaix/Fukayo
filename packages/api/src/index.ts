import { env } from 'node:process';
import express from 'express';
import morgan from 'morgan';
import { Fork } from './app';
import { verify } from './utils/standalone';
import client from './client';
import { setupFileServFolder } from './utils/fileserv';
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

  // init the file server directory
  const fileDirectory = setupFileServFolder();

  // serve the files
  app.get('/files/:fileName', (req, res, next) => {
    const options = {
      root: fileDirectory,
      dotfiles: 'deny',
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true,
      },
    };
    const fileName = req.params.fileName;
    res.sendFile(fileName, options, (err) => {
      if (err) {
        next(err);
      }
    });
  });

  // force authentication for file requests
  app.use('/files', (req, res, next) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const strauth = Buffer.from(b64auth, 'base64').toString();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, login, password] = strauth.match(/(.*?):(.*)/) || [];
    if(login !== env.LOGIN || password !== env.PASSWORD) {
      // Access denied...
      res.set('WWW-Authenticate', 'Basic realm="401"'); // change this
      res.status(401).send('Authentication required.'); // custom message
    } else {
      // Access granted...
      next();
    }
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
