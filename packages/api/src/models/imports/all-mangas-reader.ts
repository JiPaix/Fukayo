import MangasDB from '@api/db/mangas';
import mirrors from '@api/models';
import type Mirror from '@api/models/abstracts';
import type { SelfHosted } from '@api/models/abstracts/selfhosted';
import icon from '@api/models/icons/amr-importer.png';
import Importer from '@api/models/imports/abstracts';
import type ImporterInterface from '@api/models/imports/interfaces';
import type { ImportResults } from '@api/models/imports/types';
import type MirrorInterface from '@api/models/interfaces';
import type { SearchResult } from '@api/models/types/search';
import type { socketInstance } from '@api/server/types';
import type { mirrorsLangsType } from '@i18n';
import { ISO3166_1_ALPHA2_TO_ISO639_1, mirrorsLang } from '@i18n';


type TypeExport = {
  /** source */
  m: string
  /** mangas name */
  n: string
  /** url */
  u: string
  /** last chapter read url */
  l:string
  /** last update time */
  ut: number
  /** read */
  r: 0 | 1
  /** lang */
  g: string
  /** webtoon */
  wt: boolean
  /** display name */
  dn: string
  /** layout */
  y: 1 | 0
  /** categories */
  c: string[]
}


const amr = {
  name: 'amr',
  url: 'xxx',
  host: 'xxx',
  displayName: 'All Mangas Reader',
  enabled: true,
  icon,
};

class AMRImporter extends Importer implements ImporterInterface {
  constructor() {
    super(amr.name, amr.host, amr.displayName, amr.icon);
  }

  get showInfo(): { url: string; name: string; displayName: string; enabled: boolean; icon: string; } {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { host, ...rest } = amr;
    return rest;
  }

  async getMangas(socket: socketInstance, id: number, langs: mirrorsLangsType[], json:string) {
    let cancel = false;

    const stopListening = () => {
      cancel = true;
      socket.removeListener('disconnect', stopListening);
      socket.removeListener('stopShowImports', stopListening);
    };

    socket.once('disconnect', stopListening);
    socket.once('stopShowImports', stopListening);

    try {
      const { mangas } = JSON.parse(json) as { mangas: Partial<TypeExport>[] };
      socket.emit('showImports', id, mangas.length);
      for(const manga of mangas) {
        if(cancel) break;
        if(!manga.u) return;
        if(!manga.n) return;

        const langs = manga.g ? [ISO3166_1_ALPHA2_TO_ISO639_1(manga.g)] : mirrorsLang.map(x=>x);
        const host = new URL(manga.u).host;

        const mirror = mirrors.find(m => m.host.includes(host) || (m as unknown as SelfHosted).options.host?.includes(host) || m.althost?.some(ma => ma.includes(host)));
        if(!mirror) return socket.emit('showImports', id, { name: manga.n, mirror: undefined, langs });

        const results = await this.#fetchdb(manga.u, manga.n, mirror, langs, id);
        const matchingResults = results.filter(r => r.name === manga.n || manga.u?.includes(r.url));

        if(matchingResults.length) socket.emit('showImports', id, matchingResults);
        else socket.emit('showImports', id, { name: manga.n, mirror: undefined, langs });
      }

    } catch(e) {
      this.logger('failed import', e);
    }
    socket.emit('showImports', id, { done: true });
  }
  async #fetchdb(url:string):Promise<ImportResults[]>
  async #fetchdb(url:string, name:string, mirror: Mirror<Record<string, unknown>> & MirrorInterface, langs: mirrorsLangsType[], id: number):Promise<ImportResults[]>
  async #fetchdb(url:string, name?:string, mirror?: Mirror<Record<string, unknown>> & MirrorInterface, langs?: mirrorsLangsType[], id?: number):Promise<ImportResults[]> {
    const db = await MangasDB.getInstance();
    const indexes = await db.getIndexes();
    const indexesSharingSameURL = indexes.filter(i => url.includes(i.url));
    if(!indexesSharingSameURL.length && !mirror) return [];
    if(indexesSharingSameURL.length) {
      return (await db.getAll())
        .filter(m => indexesSharingSameURL.some(f => f.id === m.id))
        .map(res => {
          return {
            name: res.name,
            langs: res.langs,
            inLibrary: true,
            url: res.url,
            covers: res.covers,
            mirror: {
              name: res.mirror.name,
              langs: res.langs,
            },
          };
        });
    } else {
      if(!name || !mirror || !langs || !id) throw Error('missing args');
      this.logger('searching in', mirror.name);
      mirror.search(name, langs, this, id);
      const toReturn:Set<ImportResults> = new Set();

      return new Promise(resolve => {
        this.on('searchInMirrors', (id, mangas) => {

          if(Array.isArray(mangas)) {
            this.logger('found something', mangas.length);
            mangas.forEach(m => toReturn.add({
              name: m.name,
              langs: m.langs,
              inLibrary: false,
              url: m.url,
              covers: m.covers,
              mirror: {
                name: m.mirrorinfo.name,
                langs: m.mirrorinfo.langs,
              },
            }));
          } else if(typeof (mangas as SearchResult).inLibrary !== 'undefined') {
            const m = mangas as SearchResult;
            this.logger('found something', m.name);
            toReturn.add({
              name: m.name,
              langs: m.langs,
              inLibrary: false,
              url: m.url,
              covers: m.covers,
              mirror: {
                name: m.mirrorinfo.name,
                langs: m.mirrorinfo.langs,
              },
            });
          } else {
            this.logger('something wrong?', mangas);
            this.removeAllListeners('searchInMirrors');
            resolve(Array.from(toReturn));
          }
        });
      });
    }
  }

}

const AmrImporter = new AMRImporter();
export default AmrImporter;
