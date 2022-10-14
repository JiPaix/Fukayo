import { MyMangaReaderCMS } from '@api/models/abstracts/mymangareadercms';
import icon from '@api/models/icons/scanfr.png';

class scanfr extends MyMangaReaderCMS<{ enabled: boolean}> {
  constructor() {
    super({
      version: 1,
      isDead: false,
      host: 'https://www.scan-fr.org',
      althost: ['https://.scan-fr.org', 'https://www.scan-fr.cc', 'https://scan-fr.cc'],
      name: 'scanfr',
      displayName: 'Scan-FR',
      langs: ['fr'],
      icon,
      chapter_selector: 'ul.chapterszozo a[href*=\'/manga/\']',
      manga_page_appended_string: 'Manga ',
      meta: {
        speed: 0.3,
        quality: 0.7,
        popularity: 0.5,
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

const scan_fr = new scanfr();
export default scan_fr;
