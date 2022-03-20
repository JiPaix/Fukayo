import Mirror from './model';
import icon from './icons/mangahasu.png';
import type MirrorInterface from './model/types';
import type { SearchResult } from './types/search';
import type { ChapterErrorMessage, ChapterPageErrorMessage, MangaErrorMessage, SearchErrorMessage } from './types/errorMessages';
import type { MangaPage } from './types/manga';
import type { ChapterPage } from './types/chapter';

class MangaHasu extends Mirror implements MirrorInterface { 

  host = 'https://mangahasu.se';
  displayName = 'MangaHasu';
  name = 'mangahasu';
  enabled = true;
  langs = ['en'];
  headless = true;
  
  regexes = {
    manga: new RegExp(`^${this.host}\\/.*-\\w{3,4}-p\\d+\\.html$`, 'gmi'),
    chapter: new RegExp(`^${this.host}\\/.*\\/.*-\\w{3,4}-c\\d+\\.html$`, 'gmi'),
    chapter_info: new RegExp('(Vol\\s(\\d+)\\s)?Chapter\\s([0-9]+(\\.)?([0-9]+)?)(:\\s(.*))?', 'gmi'),
  };
  
  constructor() {
    super({icon});
  }

  async search(query:string):Promise<SearchResult[]|SearchErrorMessage> {
    const url = `${this.host}/advanced-search.html?keyword=${query}`;
    const results:SearchResult[] = [];
    try {
      const res = await this.fetch({url});
      
      const $ = this.loadHTML(res.data);
      for(const el of $('div.div_item')) {
        
        const cover = $('div.wrapper_imgage > a > img', el).attr('src');
        const name = $('a.name-manga > h3', el).text().trim();
        const link = $('a.name-manga', el).attr('href');
  
        if(!name || !link) continue;
  
        let last_release: SearchResult['last_release'];
        const last_chapter = $('a.name-chapter > span', el).text().trim();
        const match = this.regexes.chapter_info.exec(last_chapter);
  
        if(!match) last_release = {name: last_chapter.replace(/Chapter/gi, '').trim()};
  
        if(match && typeof match === 'object') {
          const [, , volumeNumber, chapterNumber, , , , chapterName] = match;
          last_release = {
            name: chapterName ? chapterName.trim() : undefined,
            volume: volumeNumber ? parseInt(volumeNumber) : undefined,
            chapter: chapterNumber ? parseFloat(chapterNumber) : 0,
          };
        }
  
        results.push({
          name,
          link,
          cover,
          last_release,
          lang: 'en',
        });
      }
      return results;
    } catch(e) {
      if(e instanceof Error) return {error: 'search_error', trace: e.message};
      if(typeof e === 'string') return {error: 'search_error', trace: e};
      return {error: 'search_error'};
    }
  }

  async manga(link:string): Promise<MangaPage | MangaErrorMessage> {
    const url = `${this.host}/${link}`;
    const isMangaPage = this.regexes.manga.test(url);
    if(!isMangaPage) return {error: 'manga_error_invalid_link'};

    try {
      const res = await this.fetch({url});

      const $ = this.loadHTML(res.data);
      const name = $('.info-title > h1').text().trim();
      const synopsis = $('.content-info:contains("Summary") > div').text().trim();
      const covers = [];
      const cover = $('.info-img > img').attr('src');
      if(cover) covers.push(cover);
      const chapters:MangaPage['chapters'] = [];

      for(const [i, el] of $('td.name > a').toArray().reverse().entries()) {

        const current_chapter = $(el).text().trim();
        const link = $(el).attr('href');
        if(!link) continue;
        const match = this.regexes.chapter_info.exec(current_chapter);
        let release: MangaPage['chapters'][0] | undefined = undefined; 

        if(!match) release = {name: current_chapter.replace(/Chapter/gi, '').trim(), number: i, volume: 0, link};
  
        if(match && typeof match === 'object') {
          const [, , , , , , , chapterName] = match;
          release = {
            name: chapterName ? chapterName.trim() : current_chapter.replace(/Chapter/gi, '').trim(),
            volume: 0,
            number: i,
            link,
          };
        }
        if(release) chapters.push(release);
      }
      return { langs: this.langs, mirror: this.name, name, synopsis, covers, chapters };
    } catch(e) {
      if(e instanceof Error) return {error: 'manga_error', trace: e.message};
      if(typeof e === 'string') return {error: 'manga_error', trace: e};
      return {error: 'manga_error'};
    }
  }

  async chapter(link: string): Promise<(ChapterPage|ChapterPageErrorMessage)[] | ChapterErrorMessage> {
    const url = `${this.host}/${link}`;
    const isChapterPage = this.regexes.chapter.test(url);
    if(!isChapterPage) return {error: 'chapter_error_invalid_link'};

    try {
      const res = await this.fetch({url});
      const $ = this.loadHTML(res.data);

      const images:(ChapterPage|ChapterPageErrorMessage)[] = [];

      for(const [i, el] of $('.img > img').toArray().entries()) {
        const src = $(el).attr('src');
        if(src) images.push({src, index: i});
        else images.push({error: 'chapter_error_no_image', url: url.replace(this.host, ''), index: i});
      }

      return images;

    } catch(e) {
      if(e instanceof Error) return {error: 'chapter_error', trace: e.message};
      if(typeof e === 'string') return {error: 'chapter_error', trace: e};
      return {error: 'chapter_error'};
    }
  }

  async retryChapterImage(link: string, index: number): Promise<ChapterPage | ChapterPageErrorMessage> {
    const url = `${this.host}/${link}`;
    const isChapterPage = this.regexes.chapter.test(url);
    if(!isChapterPage) return {error: 'chapter_error_invalid_link', index};
    
    try {
      const res = await this.fetch({url});
      const $ = this.loadHTML(res.data);

      const img = $('.img > img')[index];
      if(!img) return {error: 'chapter_error_no_image', url: url.replace(this.host, ''), index};
      const src = $(img).attr('src');
      if(!src) return {error: 'chapter_error_no_image', url: url.replace(this.host, ''), index};
      return {src, index};
    } catch(e) {
      if(e instanceof Error) return {error: 'chapter_error', trace: e.message, index};
      if(typeof e === 'string') return {error: 'chapter_error', trace: e, index};
      return {error: 'chapter_error', index};
    }
  }
}


const mangahasu = new MangaHasu();
export default mangahasu;