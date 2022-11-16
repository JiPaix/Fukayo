import MangasDB from '@api/db/mangas';
import mirrors from '@api/models';
import icon from '@api/models/icons/tachidesk-importer.png';
import Importer from '@api/models/imports/abstracts';
import type ImporterInterface from '@api/models/imports/interfaces';
import type Tachidesk from '@api/models/tachidesk';
import { isErrorMessage } from '@api/models/types/errors';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/availableLangs';
import type { ImportResults } from './types';

const tachidesk = mirrors.find(m=> m.name === 'tachidesk') as typeof Tachidesk;

class TachideskImporter extends Importer implements ImporterInterface {
  constructor() {
    super(tachidesk.name, tachidesk.host, tachidesk.displayName, icon);
  }

  get showInfo(): { url: string; name: string; displayName: string; enabled: boolean; icon: string; } {
    return { url: tachidesk.host, name: tachidesk.name, displayName: tachidesk.displayName, enabled: tachidesk.enabled, icon };
  }
  async getMangas(socket: socketInstance, id: number, langs: mirrorsLangsType[]) {
    let cancel = false;

    const stopListening = () => {
      cancel = true;
      socket.removeListener('disconnect', stopListening);
      socket.removeListener('stopShowImports', stopListening);
    };

    socket.once('disconnect', stopListening);
    socket.once('stopShowImports', stopListening);

    const lists = await tachidesk.getLists();
    if(isErrorMessage(lists)) {
      socket.emit('showImports', id, lists);
      socket.removeAllListeners('showImports');
      return;
    }

    socket.emit('showImports', id, lists.length);

    const db = await MangasDB.getInstance();
    const indexes = (await db.getIndexes()).filter(m => m.mirror.name === tachidesk.name && m.mirror.version === tachidesk.version);

    const nodb:typeof lists = [];
    const indb:ImportResults[] = [];

    for(const m of lists) {
      const lookup = indexes.find(f => f.id == m.id);
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
          name: tachidesk.name,
          langs: tachidesk.mirrorInfo.langs,
        },
      });
    }
    stopListening();
    if(!cancel) tachidesk.getMangasToImport(id, socket, langs, nodb);
  }

}

const tachideskImporter = new TachideskImporter();
export default tachideskImporter;
