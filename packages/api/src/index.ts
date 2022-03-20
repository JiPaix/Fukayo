import type { Server } from 'http';
import express, { Router, json } from 'express';
import { join } from 'path';
import mirrorRoutes from './routes/api/mirrors';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';

console.log('dirname', __dirname);

// basic express setup
const app = express();
app.use(helmet());
app.use(cors());

// define api sub-routes
const mirrors = Router();
mirrors.use('/mirrors', mirrorRoutes);

// define api main route
const api = Router();
api.use(json());
api.use('/api', mirrors);
api.use('/api', express.static(join(__dirname, '../', 'docs', 'API')));
// pass all routes to express
app.use(api);


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

let runner: Server | undefined;

type ForkResponse = {
  type: 'start' | 'shutdown' | 'pong',
  success: boolean,
  message?: string,
}

type ShutdownMessage = {
  type: 'shutdown';
}

type StartMessage = {
  type: 'start';
  port: string;
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
    if(runner) runner.close();
    process.exit(0);
  }, 10000);
}

process.on('message', (msg:Message) => {

  if(msg.type === 'shutdown') {
    console.log('[api]', 'Requested shutdown');
    if(runner) runner.close((err) => {
      if(err && process.send) process.send({type: 'shutdown', success: false, message: err.message+'\nFORCED EXIT'});
      if(process.send) process.send({type: 'shutdown', success: true});
      process.exit(0);
    });
  }

  if(msg.type === 'start') {
    console.log('[api]', 'Requested server start on port', msg.port);
    const timeout = setTimeout(() => {
      if(runner) runner.removeAllListeners();
      if(process.send) process.send({type: 'start', success: false, message: 'timeout_in_fork'} as ForkResponse);
    }, 5000);

      runner = app.listen(parseInt(msg.port));
      runner.on('listening', () => {
        console.log('[api]' , 'Starting server on port', msg.port);
        if(process.send) process.send({type: 'start', success: true} as ForkResponse);
        restartPingTimeout();
        clearTimeout(timeout);
      });
      runner.on('error', (err) => {
        console.error('[api]', err);
        if(process.send) process.send({type: 'start', success: false, message: err.message} as ForkResponse);
        clearTimeout(timeout);
      });
  }
  if(msg.type === 'ping') {
    if(process.send) process.send({type: 'pong'}, undefined, undefined, (err) => {
      if(err) process.exit(0);
      restartPingTimeout();
    });
  }
});

export const server = app;
