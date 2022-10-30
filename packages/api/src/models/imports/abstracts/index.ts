import type { ServerToClientEvents } from '@api/server/types';
import EventEmitter from 'events';
import type TypedEmitter from 'typed-emitter';

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
}
