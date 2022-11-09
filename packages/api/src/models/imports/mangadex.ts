import MangasDB from '@api/db/mangas';
import mirrors from '@api/models';
import icon from '@api/models/icons/mangadex-importer.png';
import Importer from '@api/models/imports/abstracts';
import type ImporterInterface from '@api/models/imports/interfaces';
import type { ImportResults } from '@api/models/imports/types';
import type MangaDex from '@api/models/mangadex';
import { isErrorMessage } from '@api/models/types/errors';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';


const mangadex = mirrors.find(m=> m.name === 'mangadex') as typeof MangaDex;

class MangadexImporter extends Importer implements ImporterInterface {
  constructor() {
    super(mangadex.name, mangadex.host, mangadex.displayName, icon);
  }
  get #enabled():boolean {
    if(!mangadex) throw Error('couldnt find mangadex mirror impl.');
    const {login, password} = mangadex.options;
    const hasLogin = typeof login === 'string' && login.length > 0;
    const hasPassword = typeof password === 'string' && password.length > 0;
    return mangadex.enabled && mangadex.loggedIn && hasLogin && hasPassword;
  }

  get #login() {
    if(!mangadex) throw Error('couldnt find mangadex mirror impl.');
    return mangadex.options.login;
  }

  get #password() {
    if(!mangadex) throw Error('couldnt find mangadex mirror impl.');
    return mangadex.options.password;
  }

  get showInfo(): { url: string; name: string; displayName: string; enabled: boolean; icon: string; } {
      return {
        url: mangadex.host,
        name: mangadex.name,
        displayName: mangadex.displayName,
        enabled: this.#enabled,
        icon: icon,
      };
  }

  async getMangas(socket: socketInstance, id:number, langs:mirrorsLangsType[]) {
    let cancel = false;

    socket.on('stopShowImports', () => {
      cancel = true;
      socket.removeAllListeners('stopShowImports');
    });

    if(!mangadex) throw Error('couldnt find mangadex mirror impl.');
    const lists = await mangadex.getLists();
    if(isErrorMessage(lists)) {
      socket.emit('showImports', id, lists);
      socket.removeAllListeners('showImports');
      return;
    }

    const db = await MangasDB.getInstance();
    /** this id is a test entry from mangadex: f9c33607-9180-4ba6-b85c-e4b5faee7192 */
    const mangas = Array.from(new Set(lists.map(l => l.relationships.filter(m => m.type === 'manga').map(m=> m.id)).flat()));
    const indexes = (await db.getIndexes()).filter(m => m.mirror.name === mangadex.name && m.mirror.version === mangadex.version);
    const nodb:string[] = [];
    const indb:ImportResults[] = [];

    for(const m of mangas) {
      const lookup = indexes.find(f => f.id === m);
      if(!lookup) {
        nodb.push(m);
        continue;
      }
      const res = await db.get({id: lookup.id, langs: lookup.langs });
      if(!res) continue;
      indb.push({
        name: res.name,
        langs: res.langs,
        inLibrary: true,
        url: res.url,
        covers: res.covers,
        mirror: {
          name: mangadex.name,
          langs: mangadex.mirrorInfo.langs,
        },
      });
    }

    socket.emit('showImports', id, nodb.length+indb.length);
    if(indb.length) socket.emit('showImports', id, indb);
    if(!cancel) {
      socket.removeAllListeners('stopShowImports');
      mangadex.getMangasFromList(id, socket, langs, nodb);
    }
  }
}

const mangadexImporter = new MangadexImporter();
export default mangadexImporter;
