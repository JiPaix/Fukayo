/* eslint-disable semi */
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';

export default interface ImporterInterface {
  name: string;
  url: string;
  icon: string;
  displayName: string;
  get #enabled():boolean
  get #login(): string
  get #password(): string
  get showInfo(): { url: string, name: string, displayName: string, enabled: boolean, icon:string }
  getMangas(socket: socketInstance, id:number, langs:mirrorsLangsType[], json?:string):void
}
