import { join } from 'node:path';
import express from 'express';
import morgan from 'morgan';
import { Fork } from './fork/index';

// basic express setup
const app = express();

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
if (process.env['MODE'] === 'development') {
  app.use(morgan('common'));
} else {
  app.use(morgan('[api] :method :url :status :response-time ms - :res[content-length]'));
}

new Fork(app);
