import { MyMangaReaderCMS } from './abstracts/mymangareadercms';
import icon from './icons/fallenangels.png';

class FallenAngels extends MyMangaReaderCMS {
  constructor() {
    super({
      host: 'https://manga.fascans.com',
      althost: [],
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
    });
  }
}

const fa = new FallenAngels();
export default fa;
