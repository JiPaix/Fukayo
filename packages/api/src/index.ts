import { Fork } from '@api/app';
import client from '@api/client';
import type { ForkEnv } from '@api/types';
import { FileServer } from '@api/utils/fileserv';
import { verify } from '@api/utils/standalone';
import compression from 'compression';
import history from 'connect-history-api-fallback';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { join, resolve } from 'path';
import { env } from 'process';
import TokenDatabase from '@api/db/tokens';
import MangasDatabase from '@api/db/mangas';

export default function useFork(settings: ForkEnv = env):Promise<{ client: client, fork:Fork }> {

  // init the file server directory
  const fileServer = FileServer.getInstance('fileserver');

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

  // compress resources
  app.use(compression());

  // cors
  app.options('*', cors({
    origin: '*',
  }));

  // robots.txt
  app.get('/robots.txt', function (req, res) {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
});


  // serve the files
  app.get('/files/:fileName', (req, res, next) => {
    const token = req.query.token;
    if(typeof token !== 'string' || !TokenDatabase.getInstance().isValidAccessToken(token)) {
      return res.status(401).send('Authentication required.'); // custom message
    }

    const options = {
      root: fileServer.folder,
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
      } else {
        fileServer.renew(fileName);
      }
    });
  });

    // serve the files
  app.get('/cache/:folderName/:fileName', (req, res, next) => {
    const token = req.query.token;
    if(typeof token !== 'string' || !TokenDatabase.getInstance().isValidAccessToken(token)) {
      return res.status(401).send('Authentication required.'); // custom message
    }

    const options = {
      root: resolve(fileServer.cacheFolder, req.params.folderName),
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
      } else {
        fileServer.renew(fileName);
      }
    });
  });

  app.get('/covers/:fileName', async (req, res, next) => {
    const token = req.query.token;
    if(typeof token !== 'string' || !TokenDatabase.getInstance().isValidAccessToken(token)) {
      return res.status(401).send('Authentication required.'); // custom message
    }
    if(req.params.fileName.endsWith('.json')) res.status(404); // custom message
    const mangadb = await MangasDatabase.getInstance();
    const options = {
      root: mangadb.path,
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
      } else {
        fileServer.renew(fileName);
      }
    });
  });

  // serve the view if any
  if(env.VIEW) {
    app.use(express.static(env.VIEW));
    // proxy requests through a specified index page
    app.use(history({
      index: '/',
      rewrites: [{
        from: /^.*\/(.*\.\w{2,5})$/, // make sure ressource files are served through /file.ext instead of /requested/path/file.ext
        to: (context) => {
          return `/${context.match[1]}`;
        },
      }],
    }));
    // 2nd load of statics for unhandled history api fallback
    app.use(express.static(env.VIEW));
    app.get('*', (_req, res) => {
      try {
        if(!env.VIEW) throw new Error('unexpected error');
        res.sendFile(join(env.VIEW, 'index.html'));
      } catch (error) {
        res.json({ success: false, message: 'Something went wrong' });
      }
    });
  }

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
        const c = new client({
          accessToken: message.split('[split]')[0],
          refreshToken: message.split('[split]')[1],
          ssl: env.SSL,
          port: parseInt(env.PORT),
        });
        // return both a socket.io client and the fork
        return resolve({client: c, fork});
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

    // add route to interact with fork:
    // force authentication for file requests
    app.post('/kill', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
      const strauth = Buffer.from(b64auth, 'base64').toString();
      const splitIndex = strauth.indexOf(':');
      const login = strauth.substring(0, splitIndex);
      const password = strauth.substring(splitIndex + 1);
      if(login !== env.LOGIN || password !== env.PASSWORD) {
        // Access denied...
        res.set('WWW-Authenticate', 'Basic realm="401"'); // change this
        res.status(401).send('Authentication required.'); // custom message
      } else {
        // Access granted...
        res.status(200).send('killing the app');
        fork.send('shutdownFromWeb'); // forkAPI is listening this (in main package)
      }
    });

  });
}

if(env.ELECTRON_RUN_AS_NODE) {
  useFork().catch(console.error);
}
