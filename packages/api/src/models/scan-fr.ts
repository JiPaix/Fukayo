import { MyMangaReaderCMS } from './abstracts/mymangareadercms';
import icon from './icons/scanfr.png';

class scanfr extends MyMangaReaderCMS<{ enabled: boolean}> {
  constructor() {
    super({
      host: 'https://www.scan-fr.org',
      althost: ['https://.scan-fr.org', 'https://www.scan-fr.cc', 'https://scan-fr.cc'],
      name: 'scanfr',
      displayName: 'Scan-FR',
      langs: ['fr'],
      icon,
      cache: true,
      chapter_selector: 'ul.chapterszozo a[href*=\'/manga/\']',
      manga_page_appended_string: 'Manga ',
      meta: {
        speed: 0.3,
        quality: 0.7,
        popularity: 0.5,
      },
      options: {
        enabled: true,
      },
    });
  }
}

const scan_fr = new scanfr();
export default scan_fr;
