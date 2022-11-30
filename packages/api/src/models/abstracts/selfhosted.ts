import Mirror from '@api/models/abstracts';
import type { MirrorConstructor } from './../types/constructor';

type options = {
  login?: string | null,
  password?: string | null,
  host?: string | null,
  port?: number | null,
  protocol: 'http' | 'https',
  markAsRead: boolean
}

export class SelfHosted extends Mirror<options> {
  selfhosted = true;
  #credentialRequired: boolean;
  constructor(opts: MirrorConstructor<options>, credentialRequired:boolean) {
    super(opts);
    this.#credentialRequired = credentialRequired;
  }

  public get enabled(): boolean {
    if(this.#credentialRequired) {
      const { enabled, host, port, password, login} = this.options;
      if(enabled && host && port && password && login && this.isOnline) return true;
      return false;
    } else {
      const { enabled, host, port } = this.options;
      if (enabled && host && port) return true;
      return false;
    }
  }

  set enabled(val: boolean) {
    this.options.enabled = val;
  }
}
