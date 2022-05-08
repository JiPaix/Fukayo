import { join } from 'node:path';
import { env } from 'node:process';
import express from 'express';
import morgan from 'morgan';
import { Fork } from './fork/index';
import { verify } from './standalone';

if(!env.ELECTRON_RUN_AS_NODE) {
  verify();
}

// basic express setup
const app = express();

// serve APP
if(!env.ELECTRON_RUN_AS_NODE && env.VIEW) {
  app.use('/', express.static(env.VIEW));
} else {
  app.use('/', express.static(join(__dirname, '../', '../', 'renderer', 'dist')));
}

// custom 404 page
app.use((req, res, next) => {
  if(res.headersSent) return next();
  res.status(404).json({error: 'not_found'});
  next();
});

// enable logging
if (env.MODE === 'development') {
  app.use(morgan('common'));
} else {
  app.use(morgan('[api] :method :url :status :response-time ms - :res[content-length]'));
}

new Fork(app);
