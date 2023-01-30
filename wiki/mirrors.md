# Creating new mirrors/sources
Here we will describes all the steps needed in order to create a new source.
## What you'll need
- The main URL of the source
- a regex that matches relative links to **any** manga page
- a regex that matches relative links to **any** chapter
- a 16x16 icon which can be display in both dark and light mode: **black or white backgrounds must be replaced with transparency**
## What you might need
- The URL to their API/backend
- if the mirror handles multiple languages you might need to convert whatever spec it uses to `ISO 639-1`
  - There's already a built-in converter from `ISO 3166-1 alpha2` or `IETF BCP 47` to `ISO 639-1`
  - here's the [list of all available languages](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
  - also a few exceptions have been added you can check the list [here](https://api.mangadex.org/docs/static-data/#language-codes--localization)

# Tools
Before we go indepth we will look at all the functions provided by the `Mirror` class.  
## `fetch()`
- Fetch data from website using axios (w/ fallback to puppeteer)
```typescript
import type { AxiosRequestConfig } from 'axios';

// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
type ClusterJob extends AxiosRequestConfig = {
  url: string, // url is the only mandatory option
  waitForSelector?: string, // a CSS selector that we expect to find if the request works
  cookies?: { name: string, value: string, domain: string, path: string }[] // cookies
  referer?: string; // referer
}

// @see CheerioAPI: https://cheerio.js.org/interfaces/CheerioAPI.html
function fetch(config: ClusterJob, type:'html'):Promise<CheerioAPI>
function fetch<T>(config: ClusterJob, type:'json'):Promise<T>
function fetch(config: ClusterJob, type:'string'):Promise<string>
function fetch<T>(config: ClusterJob, type: 'html'|'json'|'string'): Promise<T|CheerioAPI|string>
```
- Usage:
```ts
const config = {
  url: 'https://ficitonal-manga-reader.com/manga/25/1.html', // URL to request
  waitForSelector: '#title', // a CSS selector that we expect to find if the request works
}

// 'html' returns a cheerio object (jQuery like object)
const $ = await this.fetch(config, 'html')
for(const chapter of $('.chapter > a')) {
  //=> ...
}

// 'string' returns the whole HTML as a string
const text = await this.fetch(config, 'string')
const chapters = text.match(regex)
//=> ...

// 'json' returns an object (content of the page must be json)
type requestOK = { success: true, chapters: string[] }
type requestNOK = { success: false, error: string }
const api = await this.fetch<requestOK|requestNOK>({ 
    url: 'https://api.ficitonal-manga-reader.com/v1/endpoint'
  }, 'json')
if(!api.success) throw 'NO!'
for(const chapter of api.chapters) {
  // => ...
}
```
## `post()`
- Post data:
```ts
// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
function post<PLOAD, RESP = unknown>(url:string, data:PLOAD, type: 'post'|'patch'|'put'|'delete' = 'post', config?:Omit<AxiosRequestConfig, 'url'>):Promise<RESP | undefined>
```
- Usage
```ts
type requestOK = { success: true, message: string }
type requestNOK = { success: false, error: string }

const payload = { username: 'admin', password: 'password' }
const response = await this.post<typeof payload, requestOK|requestNOK>(
  url,
  payload,
  'post',
  { headers: someHeaders }
)
```
## `downloadImage()`
- Download an image and makes it available locally. (proxy)
```ts
// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
function downloadImage(url:string, referer?:string, dependsOnParams = false, config?:Omit<AxiosRequestConfig, 'url'>):Promise<{src: string, height: number, width: number} | undefined>
```
- Usage
```ts
// basic
const image1 = this.downloadImage('https://myimage.com/image1.png')

// example of dependsOnParams usage
const image2 = this.downloadImage('https://myimage.com/image?id=02', undefined, true)
const image3 = this.downloadImage('https://myimage.com/image?id=03', undefined, true).

// example of BAD dependsOnParams usage
const image4 = this.downloadImage('https://myimage.com/image?id=04', undefined, false)

// example of referer usage
const image5 = this.downloadImage('https://myimage.com/image5.png', 'https://google.fr', false)

// example of config usage
const image6 = this.downloadImage('https://myimage.com/image6.png', 'https://myimage.com/manga/title', false, {
  headers: {'X-Requested-With': 'XMLHttpRequest'}
})

// all combined together
const image2 = this.downloadImage(
  'https://myimage.com/image?id=02',
  'https://some-other-site.com',
  true,
  {
    auth: {
      username: 'admin',
      password: 'password',
    },
    headers: {'X-Requested-With': 'XMLHttpRequest'}
  }
)
```
## `BC47_TO_ISO639_1()` and `ISO3166_1_ALPHA2_TO_ISO639_1()`
- Convert IETF BC47 to ISO639-1
- Convert ISO3166-1-alpha2 to ISO639-1
```ts
function BC47_TO_ISO639_1(input: string|mirrorsLangsType): mirrorsLangsType
function ISO3166_1_ALPHA2_TO_ISO639_1(input: string): mirrorsLangsType 
```
- Usage
```ts
// these function aren't part of Mirror class but can be imported from @i18n.
import { BC47_TO_ISO639_1, ISO3166_1_ALPHA2_TO_ISO639_1 } from '@i18n'

const japan_to_japanese = ISO3166_1_ALPHA2_TO_ISO639_1('jp') //=> 'ja'
const vietname_to_vietnamese = ISO3166_1_ALPHA2_TO_ISO639_1('vn') //=> 'vi'

const english_uk_to_english = BC47_TO_ISO639_1('en-GB') //=> 'en'
const french_canadian_to_french = BC47_TO_ISO639_1('fr-CA') //=> 'fr'
```
## `getVariableFromScript()`
- Search a variable's value inside `<script>` tag
```ts
function getVariableFromScript<T>(varname:string, sc:string):T | undefined
```
```ts
// we get our HTML as a string
const text = await this.fetch(config, 'string')

const nbOfImages = this.getVariableFromScript<number>('imagecount', text)
if(typeof nbOfImages === 'undefined') throw 'NO!'
```
# Step by step
## Create/setup your files
1. Put the mirror icon in `packages/api/src/models/icons`.
2. Create a new file with the source's name (preferably lowercase).
## Declaration
1. Define the source's options and parameters
    ```ts
    import Mirror from '@api/models/abstracts';
    import icon from '@api/models/icons/fictionalmangareader.png';
    import type MirrorInterface from '@api/models/interfaces';

    /** Mandatory parameters */
    const parameters = {
      version: 1, // Source's version
      isDead: false, // is the source dead?
      host: 'https://ficitonal-manga-reader.com', // source's main url
      name: 'fictionalmangareader', // source's internal name
      displayName: 'Fictional Manga Reader', // source's name as it should be displayed
      langs: ['en'], // array of ISO 639-1 lang codes supported by the source,
      entryLanguageHasItsOwnURL: false, // Does the manga page use a different url depending on the selected language?
      requestLimits: { // limit the amount of requests
        time: 1000, // 1s between each request
        concurrent: 3, // 3 concurrent requests MAX
      },
      meta: { // totally subjective and probably will be removed later on.
        speed: 0.4, // 40%
        quality: 1, // 100%
        popularity: 0.2 // 20%
      },
      icon, // source's icon
    }

    /** Mandatory options */
    const options = {
      cache: true, // enable caching on this source
      enabled: true, // by default enable the mirror
    }
    ```
2. Create a new class which **extends** `Mirror` and **implements** `MirrorInterface`.  
    ```ts
    class FictionalMangaReader extends Mirror implements MirrorInterface {
      constructor() {
        super({ ...parameters, options })
      }
    }
    ```
3. If your source requires some user settings, `Mirror` class takes an **optional** type variable argument.
    ```ts
    type UserSettings = {
      login?: null | string //=> always expect strings to be nullish
      password?: null | string
      dataSaver: boolean
    }

    const defaultUserSettings = {
      login: null,
      password: null,
      dataSaver: false,
    }

    class FictionalMangaReader extends Mirror<UserSettings> implements MirrorInterface {
      constructor() {
        super({ 
          ...parameters,
          options: { 
            ...options,
            defaultUserSettings
          }
        })
      }
    }
    ```
## Login (optional)
Some sources might require to be auth'd.  
There's three requirements for auth capable sources:
1. class has type arguments which includes `login` and `password`
2. you must implement **public getter**  `loggedIn()` which returns a `boolean` and indicates whether we are authenticated or not
3. you must implement a **public function** `login()` which starts the login process (this function will be called on startup)
```ts
// always expect user inputs to be null or undefined
type UserSettings = {
  login?: null | string
  password?: null | string
}

const defaultUserSettings = {
  login: null,
  password: null,
}

class FictionalMangaReader extends Mirror<UserSettings> implements MirrorInterface {
  token: null | string
  refreshToken: null | string
  constructor() {
    super({ 
      ...parameters,
      options: { 
        ...options,
        defaultUserSettings
      }
    })
    this.#token = null // this is were we will store our token
  }

  /** Mandatory getter */
  public get loggedIn():boolean {
    const { login, password } = this.options;
    const { token, refreshToken } = this;
    // => if any of these variables are null return false
    return ![login, password, token, refreshToken].some(x => x == null);
  }

  /** This function is automatically called on startup */
  async login():Promise<boolean | void> {
    // remove/stop any previous login attemps
    stopRefreshLoop()
    this.token = null;
    this.refreshToken = null;

    const username = this.options.login,
          password = this.options.password,
          enabled = this.enabled;

    // ignore if there's no login/password or source is disabled
    if(!username || !password) return this.logger('no credentials');
    if(!enabled) return this.logger('mirror is disabled');

    // try/catch block!
    try {
      const response = await this.post<
        { username: string, password: string }, // type of the payload we're sending
        { success: false, error: string } | { success: true, token: string, refresh_token: string}, // type of possible response
      >(
        `https://api.fictional-manga-reader.com/api/v2/login`, // url
        { username, password }, // our payload
        'post', // http method
        { headers: { 'X-CUSTOM-HEADER': 'X-CUSTOM-VALUE' } } // @see AxiosRequestConfig: https://axios-http.com/docs/req_config
      )

      // handle no response
      if(!response) {
        this.logger('no response')
        return false
      }

      // handle unsuccessful response
      if(!response.success) {
        // remove/stop any previous login attemps
        this.token = null;
        this.refreshToken = null; 
        this.logger(response.error)
        return false;
      }

      // handle successful response
      this.token = response.token
      this.refresh_token = response.refreshToken
      this.startRefreshTokenLoop() //=> function to automatically refresh the token? (i'll let you figure it out)
      this.logger('logged in!');
      return true;
    } catch(e) {
      if(e instanceof Error) this.logger('not logged in:', e.message);
      else this.logger('not logged in:', e);
      // remove/stop any previous login attemps
      this.token = null;
      this.refreshToken = null; 
      return false;
    }
  }
}
```
## Mark as read (optional)
Some sources allow to update the reading status of a chapter on their website.  
If you want to update the reading status along with Fukayo:
- you must implement `markAsRead()`
- It's strongly recommended your source has `markAsRead` as an option for the user
```ts
markAsRead(mangaURL: string, lang: mirrorsLangsType, chaptersURLs: string[], read: boolean):Promise<void> {
  // if we aren't logged-in, mark as read is disabled, or chaptersURLs are empty return
  if(!this.loggedIn || !this.options.markAsRead || chapterURLs.length) return;
  try {
     // ... this.apiMarkAsRead()
  } catch(e) {
    if(e instanceof Error) return this.logger('markAsRead:', e.message);
    else return this.logger('markAsRead:', e);
  }
}
```
## URL checking
`isChapterPage()` and `isMangaPage()` are part of `MirrorInterface`.  
These to function must be able to validate both relative and absolute URLs
- `isChapterPage()` - validates a chapter's page URL (usually this is where you can read the manga)
- `isMangaPage()` - validates a manga's page URL (this is usually the page which list all chapters and includes various informations about the manga)
```ts
isChapterPage(url: string): boolean {
  return /chapter\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
}

isMangaPage(url: string): boolean {
  return /title\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
}
```

## Search
Implementing the source's search functionnality into our mirror.  
*This example is based on a mono-lingual source with parsed HTML*
```ts
async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|Scheduler, id:number) {
  // we will check if user don't need results anymore at different intervals: DO NOT MODIFY
  let cancel = false;
  let stopListening: (() => void) | undefined = undefined;
  if(!(socket instanceof Scheduler)) {
    stopListening = () => {
      cancel = true;
      socket.removeListener('stopSearchInMirrors', stopListening as () => void);
      socket.removeListener('disconnect', stopListening as () => void);
    };
    socket.once('stopSearchInMirrors', stopListening);
    socket.once('disconnect', stopListening);
  }

  try {
    const url = `${this.host}/advanced-search.html?keyword=${query}`;
    const $ = await this.fetch({
      url,
      waitForSelector: '.tag.search-results-a',
    }, 'html');

    for(const el of $('div.div_item')) {
      if(cancel) break; //=> 1st cancel check, break out of loop
      const name = $('a.name-manga > h3', el).text().trim(); // get the manga name
      const link = $('a.name-manga', el).attr('href')?.replace(this.host, ''); // get the manga's relative URL

      // ignore if we didn't get both the name and url OR the url isn't a manga page
      if((!name || !link) || (link && !this.isMangaPage(link))) continue;

      // this source only provides a single cover
      const covers:string[] = [];
      const coverLink:string | undefined = $('.wrapper_imgage img', el).attr('src');
      if(coverLink) {
        const img = await this.downloadImage(coverLink, undefined, false);
        if(img) covers.push(img.src);
      }
      
      // getting the synopsis
      let synopsis:string | undefined = $('p.manga-list-4-item-tip:last-of-type', el).text().trim();
      if(synopsis && synopsis.length === 0) synopsis = undefined; // if synopsis === '' then undefined

      // getting the latest chapter informations
      const last_chapter_info = $('a.name-chapter > span', el).text().trim(); // 'Vol.1 Ch.52 - New horizons'
      const match = /regexFromHell/g.exec(last_chapter)
      
      // last_release requires at least a chapter's name
      let last_release = { name: last_chapter_info, volume: undefined, chapter: undefined}
      if(match) {
        const [, , volumeNumber, chapterNumber, , , , chapterName] = match;
        last_release = {
          name: chapterName ? chapterName.trim() : undefined,
          volume: volumeNumber ? parseFloat(volumeNumber) : undefined,
          chapter: chapterNumber ? parseFloat(chapterNumber) : 0,
        };
      }

    // usage of this function is mandatory in order to validate the data
    const searchResults = await this.searchResultsBuilder({
        name,
        url: link,
        covers,
        last_release,
        langs: this.langs, //=> in this case the source is mono-lingual
      });

      socket.emit('searchInMirrors', id, searchResults);
    }
    if(cancel) return; //=> 2nd cancel check
  } catch(e) {
    // emit errors: DO NOT MODIFY
    this.logger('error while searching mangas', e);
    if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
    else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error'});
  }
  // notice user that we've fetched all search results: DO NOT MODIFY
  socket.emit('searchInMirrors', id, { done: true });
  if(stopListening) stopListening();
}
```
## Recommend
Implementing the source's recommendation/top10/top-week(month/day) tab/page.  
The implementation is **exactly the same** as [Search](#search) **apart from the event names**.  
*This example is based on a multi-lingual source where each manga page contains only one language*
```ts
async recommend(requestLangs:mirrorsLangsType[], socket: socketInstance|Scheduler, id: number) {
  // we will check if user don't need results anymore at different intervals: DO NOT MODIFY
  let cancel = false;
  let stopListening: (() => void) | undefined = undefined;
  if(!(socket instanceof Scheduler)) {
    stopListening = () => {
      cancel = true;
      socket.removeListener('stopShowRecommend', stopListening as () => void);
      socket.removeListener('disconnect', stopListening as () => void);
    };
    socket.once('stopShowRecommend', stopListening);
    socket.once('disconnect', stopListening);
  }

  try {
    // do your stuff...

    // convert languages to ISO639-1
    // and remove mangas with language not matching the request
    mangas = mangas.map(manga => {
      return {
        ...manga,
        lang: ISO3166_1_ALPHA2_TO_ISO639_1(manga.lang)
      }
    })
    .filter(manga => requestLangs.includes(manga.lang))

    for(const manga in mangas) {
      if(cancel) break; //=> 2nd cancel check, break out of loop

      // usage of this function is mandatory in order to validate the data
      const searchResults = await this.searchResultsBuilder({
          name,
          url: link,
          covers,
          last_release,
          langs: [manga.lang], //=> in this case each manga has only 1 language
        });

      socket.emit('searchInMirrors', id, searchResults);
    }
    if(cancel) return; //=> 1st cancel check
  } catch(e) {
    // emit errors: DO NOT MODIFY
    this.logger('error while recommending mangas', e);
    // we catch any errors because the client needs to be able to handle them
    if(e instanceof Error) socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e});
    else socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error_unknown' });
  }
  // tell client we're done
  socket.emit('showRecommend', id, { done: true });
  if(stopListening) stopListening();
}
```
## Manga
Get manga infos (title, authors, tags, chapters, covers, etc..).  
*This example is based on a multi-lingual source where each manga page contains multiple languages and the data comes from an API*
```ts
// url is always a relative url
async manga(url:string, requestedLangs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number) {
  // we will check if user don't need results anymore at different intervals: DO NOT MODIFY
  let cancel = false;
  let stopListening: (() => void) | undefined = undefined;
  if(!(socket instanceof Scheduler)) {
    stopListening = () => {
      cancel = true;
      socket.removeListener('stopShowManga', stopListening as () => void);
      socket.removeListener('disconnect', stopListening as () => void);
    };
    socket.once('stopShowManga', stopListening);
    socket.once('disconnect', stopListening);
  }

  try {

    const manga = await this.fetch<SuccessType|ErrorType>({
      url: `${this.host}/${url}`
    }, 'json');

    if(manga.result !== 'ok') throw new Error(`${manga.errors[0].title}: ${manga.errors[0].detail}`);

    if(!requestedLangs.some(x => langs.includes(x))) throw new Error(`this manga has no translation for this languages ${requestedLangs}`);
    // manga's title
    const name =  manga.data.attributes.title[Object.keys(manga.data.attributes.title)[0]];
    // publication status
    const status = manga.data.attributes.status || undefined;
    // tags / categories
    const tags = manga.data.attributes.tags.map(x => x.attributes.name[Object.keys(x.attributes.name)[0]]);

    // search for synopsis that matches requestedLangs
    const descriptions = requestedLangs.map(m => manga.data.attributes.description[m]);
    let synopsis:string|undefined|null = undefined;
    // join different languages together
    if(descriptions.length) synopsis = descriptions.join('\r\n');
    // if none where found, try english
    else synopsis = manga.data.attributes.description['en'];
    // if none of the above worked set undefined
    if(!synopsis) synopsis = undefined;

    // getting authors and artists
    const authors = manga.data.relationships
      .filter(x => x.type === 'artist' || x.type === 'author')
      .map(x => (x.attributes as {name: string}).name);

    // getting all covers
    const covers = await Promise.all(manga.data.relationships.covers.map(coverURL => {
      return this.downloadImage(`${this.host}/covers/${manga.data.id}/${coverURL}.512.jpg`)
    }))

    const langsQuery = requestedLangs.map(x => 'availableTranslatedLanguage[]=' + x).join('&')

    // loop 20 times (arbitrary number)
    for (const [page, _] of Array(20).entries()) {
      if(cancel) break;

      const reqURL = `${this.host}/${url}/feed?limit=500&offset=${page*500}&${langsQuery}&includes[]=manga`
      const res = await this.fetch<SuccessType|ErrorType>({
        url: reqURL,
      }, 'json');

      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      const chapters:MangaPage['chapters'] = [];
      // filter mangas with matching translations
      const matching = res.data.filter(x => requestedLangs.includes(x.attributes.translatedLanguage))


      // loop
      for(const x of matching) {

        // mandatory usage of chaptersBuilder, which validates the data for each chapters
        const built = await this.chaptersBuilder({
          url: '/chapter/'+x.id, // url of chapter without hostname, eg. /manga/one-punch-man/chapter/25
          lang: x.attributes.translatedLanguage, // lang of the chapter
          number: parseFloat(x.attributes.chapter), // chapter's number
          volume: x.attributes.volume ? parseFloat(x.attributes.volume) : undefined, // chapter's volume
          name: x.attributes.title ? x.attributes.title : undefined, // chapter's title/name
        });

        chapters.push(built);
      }

      // mandatory usage of mangaPageBuilder, which validates the data
      const mg = await this.mangaPageBuilder({
        url, // url of the manga without hostname eg. /manga/my-hero-acedemia
        langs: [...new Set(matching.map(x => x.attributes.translatedLanguage))], // langs we found
        covers, // cover
        name, // title
        synopsis, // synopsis
        tags, // tags
        authors, // artists and authors
        chapters, // chapter we built with chaptersBuilder()
        status, // publication status
      });

      socket.emit('showManga', id, mg);

      // stop loop if we've got all chapters
      const current = res.limit + res.offset;
      const total = res.total;
      if(current >= total) break;

    }
    if(cancel) return;
  } catch(e) {
    this.logger('error while fetching manga', e);
    // we catch any errors because the client needs to be able to handle them
    if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
    else socket.emit('showManga', id, {error: 'manga_error_unknown'});
  }
  if(stopListening) stopListening();
}
```
## Chapter
Get the chapter images  
*This example is based on mangadex implementation*
```ts
  async chapter(link: string, lang: mirrorsLangsType, socket: socketInstance, id: number, callback?: ((nbOfPagesToExpect: number) => void) | undefined, retryIndex?: number | undefined) {
    // we will check if user don't need results anymore at different intervals: DO NOT MODIFY
    let cancel = false;
    let stopListening: (() => void) | undefined = undefined;
    if(!(socket instanceof Scheduler)) {
      stopListening = () => {
        cancel = true;
        socket.removeListener('stopShowChapter', stopListening as () => void);
        socket.removeListener('disconnect', stopListening as () => void);
      };
      socket.once('stopShowChapter', stopListening);
      socket.once('disconnect', stopListening);
    }

    if(cancel) return;

    try {
      const match = link.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/);
      if(!match) throw new Error('invalid chapter id');

      const resp = await this.fetch<
        Routes['/at-home/server/{id}']['ok'] | Routes['/at-home/server/{id}']['err'] // type of responses
      >(
        {
          url: this.#path(`/at-home/server/${match[0]}`) // this.#path is a private function that returns a full url
        }, 'json');

      if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
      if(callback) callback(resp.chapter.data.length); //=> we send the number of pages to be expected

      const type = this.options.dataSaver ? 'dataSaver' : 'data'; //=> mangadex has a dataSaver option, the images url is affected by this.

      for(const [i, v] of resp.chapter[type].entries()) {
        if(cancel) break;
        // if user requested a specific page we skip until we're on the right index
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;

        // we use downloadImage()
        const img = await this.downloadImage(`${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`);
        // and emit the response
        if(img) {
          socket.emit(
            'showChapter',
            id, // we return the id we got as an argument
            {
              index: i, // index of page
              src: img.src, // downloadImage().src
              height: img.height, // downloadImage().height
              width: img.width, // downloadImage().width
              // if retryIndex is defined, then this is the last (requested) page
              // else we check if we reached the end of our loop
              lastpage: typeof retryIndex === 'number' ? true : i+1 === resp.chapter.data.length
            }
          );
        }
        // if we didn't get the image
        else socket.emit(
          'showChapter',
          id, // we return the id we got as an argument
          {
            error: 'chapter_error_no_image', // return a no image error
            trace: `cannot open: ${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`, // give some clues
            index: i,
            // if retryIndex is defined, then this is the last (requested) page
            // else we check if we reached the end of our loop
            lastpage: typeof retryIndex === 'number' ? true : i+1 === resp.chapter.data.length // lastp
          }
        );
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching chapter', e);
      // we catch any errors because the client needs to be able to handle them
      if(e instanceof Error) socket.emit('showChapter', id, {error: 'chapter_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showChapter', id, {error: 'chapter_error', trace: e});
      else socket.emit('showChapter', id, {error: 'chapter_error_unknown'});
    }
    if(stopListening) stopListening();
  }
```
