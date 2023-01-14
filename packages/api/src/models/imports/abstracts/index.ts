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
    if(env.MODE === 'development') console.log('[api]', `(\x1b[32m${this.name}\x1b[0m)` ,...args);
  }
}
