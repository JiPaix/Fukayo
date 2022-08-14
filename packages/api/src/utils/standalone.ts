import { env } from 'process';
import fs from 'fs';
import { resolve } from 'path';

/**
 * Function to check if the environment is valid.
 */
export function verify() {
  const t = types();
  if(t.length) {
    t.forEach((key) => console.log(`${key.name} ${key.type}`));
    process.exit(1);
  }
}

function types() {
  const types = [];
  if(!env.LOGIN) types.push({ name: 'LOGIN', type: 'is missing' });
  else if(typeof env.LOGIN !== 'string') types.push({ name: 'LOGIN', type: 'is not a string' });
  else if(env.LOGIN.length < 3) types.push({ name: 'LOGIN', type: 'is too short' });

  if(!env.PASSWORD) types.push({ name: 'PASSWORD', type: 'is missing' });
  else if(typeof env.PASSWORD !== 'string') types.push({ name: 'PASSWORD', type: 'is not a string' });
  else if(env.PASSWORD.length < 6) types.push({ name: 'PASSWORD', type: 'is too short (min 6 characters)' });

  if(!env.PORT) types.push({ name: 'PORT', type: 'is missing' });
  else if(typeof env.PORT !== 'string') types.push({ name: 'PORT', type: 'is not a string' });
  else {
    const port = parseInt(env.PORT);
    if(isNaN(port)) types.push({ name: 'PORT', type: 'is not a number' });
    else if(port < 1024 || port > 65535) types.push({ name: 'PORT', type: 'is out of range (1024-65535)' });
  }

  if(env.VIEW) {
    if(typeof env.VIEW !== 'string') types.push({ name: 'VIEW', type: 'is not a string' });
    else if(!fs.existsSync(resolve(env.VIEW))) types.push({ name: 'VIEW', type: 'is not a valid path' });
    else if(!fs.statSync(resolve(env.VIEW)).isDirectory()) types.push({ name: 'VIEW', type: 'is not a directory' });
  }

  if(!env.USER_DATA) {
    const newPath = resolve(__dirname, 'user_data');
    env.USER_DATA = newPath;
    fs.mkdirSync(resolve(__dirname, 'user_data'));
  }

  if(!env.DOWNLOAD_DATA) {
    const newPath = resolve(__dirname, 'downloads');
    env.DOWNLOAD_DATA = newPath;
    fs.mkdirSync(resolve(__dirname, 'downloads'));
  }
  else if(typeof env.DOWNLOAD_DATA !== 'string') types.push({ name: 'DOWNLOAD_DATA', type: 'is not a string' });
  else if(!fs.existsSync(env.DOWNLOAD_DATA)) types.push({ name: 'DOWNLOAD_DATA', type: 'folder does not exist' });
  else if(!fs.lstatSync(env.DOWNLOAD_DATA).isDirectory()) types.push({ name: 'DOWNLOAD_DATA', type: 'is not a folder' });

  if(env.MODE) {
    if(typeof env.MODE !== 'string') types.push({ name: 'MODE', type: 'is not a string' });
    else if(env.MODE !== 'production' && env.MODE !== 'development') types.push({ name: 'MODE', type: 'has an invalid value (production or development)' });
  }

  if(!env.SSL) types.push({ name: 'SSL', type: 'missing' });
  else if(typeof env.SSL !== 'string') types.push({ name: 'SSL', type: 'is not a string' });
  else if(env.SSL !== 'app' && env.SSL !== 'provided' && env.SSL !== 'false') types.push({ name: 'SSL', type: 'has an invalid value ("app", "provided" or "false")' });
  else if(env.SSL === 'app') {
    if(!env.HOSTNAME) types.push({ name: 'HOSTNAME', type: 'is missing' });
  }
  else if(env.SSL === 'provided') {
    if(!env.CERT) types.push({ name: 'CERT', type: 'is missing' });
    if(!env.KEY) types.push({ name: 'KEY', type: 'is missing' });
    if(typeof env.CERT === 'string' && typeof env.KEY === 'string') {
      if(!fs.existsSync(env.CERT)) types.push({ name: 'CERT', type: 'file does not exist' });
      if(!fs.existsSync(env.KEY)) types.push({ name: 'KEY', type: 'file does not exist' });
      if(!fs.lstatSync(env.CERT).isFile()) types.push({ name: 'CERT', type: 'is not a file' });
      if(!fs.lstatSync(env.KEY).isFile()) types.push({ name: 'KEY', type: 'is not a file' });
    }
    else {
      if(typeof env.CERT !== 'string') types.push({ name: 'CERT', type: 'is not a string' });
      if(typeof env.KEY !== 'string') types.push({ name: 'KEY', type: 'is not a string' });
    }
  }
  return types;
}
