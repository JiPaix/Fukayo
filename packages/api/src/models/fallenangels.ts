import { MyMangaReaderCMS } from '@api/models/abstracts/mymangareadercms';
import icon from '@api/models/icons/fallenangels.png';

class FallenAngels extends MyMangaReaderCMS {
  constructor() {
    super({
      version: 1,
      isDead: false,
      host: 'https://manga.fascans.com',
      name: 'fallenangels',
      displayName: 'Fallen Angels',
      langs: ['en'],
      icon,
      manga_page_appended_string: 'Manga ',
      meta: {
        speed: 0.3,
        quality: 0.4,
        popularity: 0.3,
      },
      options: {
        cache:true,
        enabled: true,
      },
      requestLimits: {
        time: 400,
        concurrent: 1,
      },
    });
  }
}

const fa = new FallenAngels();
export default fa;
