import type { ServerToClientEvents } from '@api/server/types';
import EventEmitter from 'events';
import type TypedEmitter from 'typed-emitter';
import { env } from 'process';

export default class Importer extends (EventEmitter as new () => TypedEmitter<ServerToClientEvents>) {
  name: string;
  url: string;
  icon: string;
  displayName: string;
  constructor(name: string, url: string, displayName: string, icon: string) {
    super();
    this.name = name;
    this.url = url;
    this.displayName = displayName;
    this.icon = icon;
  }
  protected logger(...args: unknown[]) {
    const prefix = env.VERBOSE === 'true' ? `${new Date().toLocaleString()} [api] (${this.constructor.name})` : `[api] (\x1b[32m${this.constructor.name}\x1b[0m)`;
    if(env.MODE === 'development' || env.VERBOSE === 'true') console.log(prefix ,...args);
  }
}
