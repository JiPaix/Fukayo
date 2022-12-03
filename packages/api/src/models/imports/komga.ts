import MangasDB from '@api/db/mangas';
import mirrors from '@api/models';
import icon from '@api/models/icons/komga-importer.png';
import Importer from '@api/models/imports/abstracts';
import type ImporterInterface from '@api/models/imports/interfaces';
import type { ImportResults } from '@api/models/imports/types';
import type Komga from '@api/models/komga';
import { isErrorMessage } from '@api/models/types/errors';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n/availableLangs';

const komga = mirrors.find(m=> m.name === 'komga') as typeof Komga;

class KomgaImporter extends Importer implements ImporterInterface {
  constructor() {
    super(komga.name, komga.host, komga.displayName, icon);
  }

  get showInfo(): { url: string; name: string; displayName: string; enabled: boolean; icon: string; } {
    return { url: komga.host, name: komga.name, displayName: komga.displayName, enabled: komga.enabled, icon };
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

    const lists = await komga.getLists();
    if(isErrorMessage(lists)) {
      socket.emit('showImports', id, lists);
      socket.removeAllListeners('showImports');
      return;
    }
    this.logger('[api]', 'importing', lists.length, 'mangas');
    socket.emit('showImports', id, lists.length);

    const db = await MangasDB.getInstance();
    const indexes = (await db.getIndexes()).filter(m => m.mirror.name === komga.name && m.mirror.version === komga.version);

    const nodb:typeof lists = [];
    const indb:ImportResults[] = [];

    for(const m of lists) {
      if(cancel) break;
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
          name: komga.name,
          langs: komga.mirrorInfo.langs,
        },
      });
    }
    socket.emit('showImports', id, indb.length+nodb.length);
    socket.emit('showImports', id, indb);
    if(!cancel) {
      stopListening();
      komga.getMangasToImport(id, socket, langs, nodb);
    }
  }

}

const komgaImporter = new KomgaImporter();
export default komgaImporter;
