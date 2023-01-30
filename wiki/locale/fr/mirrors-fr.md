# Créer un nouveau mirroir/source
Nous allons voir pas à pas comment créer une nouvelle source
## Ce qu'il nous faut
- L'URL principale de la source
- un regex qui match avec les liens relatif de **n'importe qu'elle page** d'un manga
- un regex qui match avec les liens relatif de **n'importe qu'elle page** d'un chapitre
- une icon 16x16 qui peut-être visible à la fois en dark et light mode: **si le background de l'icon est blanc ou noir il faut le remplacer avec de la transparence**
## Ce qu'il nous *faudra, peut-être*
- L'URL de leur backend/API
- Si la source gère plusieurs languages il faut qu'ils soit convertis au format `ISO 639-1`
  - Un convertisseur `ISO 3166-1 alpha2` ou `IETF BCP 47` vers `ISO 639-1` est pre-inclu.
  - Voici la liste de [toutes les langues disponibles](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
  - Aussi, quelques exception ont été ajouté: vous pouvez voir [la liste des exceptions ici](https://api.mangadex.org/docs/static-data/#language-codes--localization)

# Outils
Avant de rentrer dans le coeur du sujet nous allons jetter un oeil aux fonctions qui sont fournis par la class `Mirror`
## `fetch()`
- Récupère les données d'un site web en utilisant Axios (ou puppeteer si besoin).
```typescript
import type { AxiosRequestConfig } from 'axios';

// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
type ClusterJob extends AxiosRequestConfig = {
  url: string, // l'url est la seul option obligatoire
  waitForSelector?: string, // un selecteur CSS que nous nous attendons à voir si la requête fonctionne
  cookies?: { name: string, value: string, domain: string, path: string }[] // nom et valeur du/des cookie(s)
  referer?: string; // adresse du referer
}

// @see CheerioAPI: https://cheerio.js.org/interfaces/CheerioAPI.html
function fetch(config: ClusterJob, type:'html'):Promise<CheerioAPI>
function fetch<T>(config: ClusterJob, type:'json'):Promise<T>
function fetch(config: ClusterJob, type:'string'):Promise<string>
function fetch<T>(config: ClusterJob, type: 'html'|'json'|'string'): Promise<T|CheerioAPI|string>
```
- Utilisation :
```ts
const config = {
  url: 'https://ficitonal-manga-reader.com/manga/25/1.html', // URL demandé
  waitForSelector: '#title', // un selecteur CSS que nous nous attendons à voir
}

// 'html' retourne un object "Cheerio" (un peu comme jQuery).
const $ = await this.fetch(config, 'html')
for(const chapter of $('.chapter > a')) {
  //=> ...
}

// 'string' retourne tout le HTML comme une string
const text = await this.fetch(config, 'string')
const chapters = text.match(regex)
//=> ...

// 'json' retourne un objet (le contenu de la page doit être du json)
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
- Poster des donner:
```ts
// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
function post<PLOAD, RESP = unknown>(url:string, data:PLOAD, type: 'post'|'patch'|'put'|'delete' = 'post', config?:Omit<AxiosRequestConfig, 'url'>):Promise<RESP | undefined>
```
- Utilisation :
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
- Téléchager une image et la rendre disponible localement (proxy).
```ts
// @see AxiosRequestConfig: https://axios-http.com/docs/req_config
function downloadImage(url:string, referer?:string, dependsOnParams = false, config?:Omit<AxiosRequestConfig, 'url'>):Promise<{src: string, height: number, width: number} | undefined>
```
- Utilisation :
```ts
// basique
const image1 = this.downloadImage('https://myimage.com/image1.png')

// exemple d'utilsiation de dependsOnParams
const image2 = this.downloadImage('https://myimage.com/image?id=02', undefined, true)
const image3 = this.downloadImage('https://myimage.com/image?id=03', undefined, true).

// MAUVAIS exemple d'utilisation de dependsOnParams
const image4 = this.downloadImage('https://myimage.com/image?id=04', undefined, false)

// exemple d'utilisation d'un referer
const image5 = this.downloadImage('https://myimage.com/image5.png', 'https://google.fr', false)

// exemple d'utilisation d'une configuration de requête
const image6 = this.downloadImage('https://myimage.com/image6.png', 'https://myimage.com/manga/title', false, {
  headers: {'X-Requested-With': 'XMLHttpRequest'}
})

// tout combiné ensemble
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
- Converssion de IETF BC47 vers ISO639-1
- converssion de ISO3166-1-alpha2 vers ISO639-1
```ts
function BC47_TO_ISO639_1(input: string|mirrorsLangsType): mirrorsLangsType
function ISO3166_1_ALPHA2_TO_ISO639_1(input: string): mirrorsLangsType 
```
- Utilisation :
```ts
// Ces fonctions ne font pas partie de la class Mirror mais peuvent être importé depuis @i18n.
import { BC47_TO_ISO639_1, ISO3166_1_ALPHA2_TO_ISO639_1 } from '@i18n'

const japon_vers_japonais = ISO3166_1_ALPHA2_TO_ISO639_1('jp') //=> 'ja'
const vietname_vers_vietnamien = ISO3166_1_ALPHA2_TO_ISO639_1('vn') //=> 'vi'

const anglais_du_Royaume_Uni_vers_anglais = BC47_TO_ISO639_1('en-GB') //=> 'en'
const francais_canadiens_vers_francais = BC47_TO_ISO639_1('fr-CA') //=> 'fr'
```
## `getVariableFromScript()`
- Rechercher la valeur d'une variable dans un tag `<script>`
```ts
function getVariableFromScript<T>(varname:string, sc:string):T | undefined
```
```ts
// nous récupérons le HTML en tant que string
const text = await this.fetch(config, 'string')
// cherche la valeur de "imagecount"
const nbOfImages = this.getVariableFromScript<number>('imagecount', text)
if(typeof nbOfImages === 'undefined') throw 'NO!'
```
# Pas à pas
## Créer/configurer les fichiers
1. Put the mirror icon in `packages/api/src/models/icons`.
2. Create a new file with the source's name (preferably lowercase).
## Déclaration
1. Définir les options et les paramètres de la source
    ```ts
    import Mirror from '@api/models/abstracts';
    import icon from '@api/models/icons/fictionalmangareader.png';
    import type MirrorInterface from '@api/models/interfaces';

    /** Paramètres obligatoires */
    const parameters = {
      version: 1, // version de la source
      isDead: false, // La source est-elle morte/H.S?
      host: 'https://ficitonal-manga-reader.com', // l'URL principale de la source
      name: 'fictionalmangareader', // le nom interne (à fukayo) de la source
      displayName: 'Fictional Manga Reader', // Le nom d'affichage de la source
      langs: ['en'], // une array de codes ISO 639-1 supporté par la source.
      entryLanguageHasItsOwnURL: false, // Est-ce que l'url de la page d'un manga change en fonction du choix de la langue?
      requestLimits: { // limiter le nombre de requêtes
        time: 1000, // 1 seconde entre chaque requête
        concurrent: 3, // 3 requêtes simultanées
      },
      meta: { // totalement subjectif et sera surement supprimer plus tard.
        speed: 0.4, // 40%
        quality: 1, // 100%
        popularity: 0.2 // 20%
      },
      icon, // l'icone de la source
    }

    /** Options obligatoires */
    const options = {
      cache: true, // Activer le cache pour la source
      enabled: true, // Par defaut le mirroir doit être activé
    }
    ```
2. Créer une nouvelle class qui **étends** `Mirror` et **implémente** `MirrorInterface`.  
    ```ts
    class FictionalMangaReader extends Mirror implements MirrorInterface {
      constructor() {
        super({ ...parameters, options })
      }
    }
    ```
3. Si votre source à besoin d'options utilisateurs, la classe `Mirror` prend un **optionellement** un type en argument.
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
Certaines sources peuvent nécessiter une authentification.  
Il y a trois exigences pour les sources qui en sont capable :
1. la classe doit avoir un type `login` and `password` en argument
2. vous devez implémenter un **getter publique** `loggedIn()` qui retourne un boolean afin d'indiquer si nous somme authentifié ou pas.
3. vous devez implémenter une **fonction publique** `login()` qui démarrera automatique la procédure d'authentification (cette fonction est applé automatiquement au démarrage) 
```ts
// toujours s'attendre à ce que les entrées utilisateurs soit null ou undefined
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
    // nous allons stocké nos tokens dans ces deux variables
    this.#token = null 
    this.#refresh_token = null
  }

  /** getter obligatoire */
  public get loggedIn():boolean {
    const { login, password } = this.options;
    const { token, refreshToken } = this;
    // => si l'une de ces variable est null alors on retourne false
    return ![login, password, token, refreshToken].some(x => x == null);
  }

  /** cette fonction est appelé automatiquement au démarrage */
  async login():Promise<boolean | void> {
    // arrête/annule un précédente tentative d'authentification
    stopRefreshLoop() 
    this.#token = null;
    this.#refreshToken = null;

    const username = this.options.login,
          password = this.options.password,
          enabled = this.enabled;

    // ignore si il n'y a aucun login/mot de passe, ou si la source est désactivé.
    if(!username || !password) return this.logger('no credentials');
    if(!enabled) return this.logger('mirror is disabled');

    try {
      const response = await this.post<
        { username: string, password: string }, // le type du payload que l'on va envoyer
        { success: false, error: string } | { success: true, token: string, refresh_token: string}, // le(s) type(s) de réponse(s) possible
      >(
        `https://api.fictional-manga-reader.com/api/v2/login`, // url
        { username, password }, // le payload
        'post', // la method (HTTP POST)
        { headers: { 'X-CUSTOM-HEADER': 'X-CUSTOM-VALUE' } } // @see AxiosRequestConfig: https://axios-http.com/docs/req_config
      )

      // En cas de non-reponse
      if(!response) {
        this.logger('no response')
        return false
      }

      // Si réponse, mais erreur
      if(!response.success) {
        // arrête/annule notre tentative d'authentification
        this.#token = null;
        this.#refresh_token = null; 
        this.logger(response.error)
        return false;
      }

      // Si réponse concluante

      // stockage des tokens
      this.#token = response.token 
      this.#refresh_token = response.refreshToken
      this.startRefreshTokenLoop() //=> fonction qui rafraichie automatiquement les tokens? (je vous laisse imaginer comment l'implémenter)
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
## Mark as read (optionel)
Certaines source vous autorise a marquer des chapitres comme lu.
Si vous souhaitez mettre à jour le status de lecture en même temps que celui de Fukayo:
- Vous devez implémenter `markAsRead()`
- Il est fortement recommender que votre source propose l'option d'activer/désactiver avec l'utilisation d'une option `markAsRead`
```ts
markAsRead(mangaURL: string, lang: mirrorsLangsType, chapterURLs: string[], read: boolean):Promise<void> {
  // si nous ne somme pas authentifié, ou que markAsRead est désactivé, ou que l'array d'url est vide
  if(!this.loggedIn || !this.options.markAsRead || chapterURLs.length) return;
  try {
    // ... this.apiMarkAsRead()
  } catch(e) {
    if(e instanceof Error) return this.logger('markAsRead:', e.message);
    else return this.logger('markAsRead:', e);
  }
}
```
## Vérification d'url
`isChapterPage()` et `isMangaPage()` font partie de `MirrorInterface`.  
Ces fonction doivent être capable de valider des URL relatives et absolue.
- `isChapterPage()` - valide l'url de la page d'un chapitre (habituellement la page où l'on lit le manga)
- `isMangaPage()` - valide l'url de la page d'un manga (c'est habituellement la page qui liste les chapitres et inclus diverses informations à propos du manga)
```ts
isChapterPage(url: string): boolean {
  return /chapter\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
}

isMangaPage(url: string): boolean {
  return /title\/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/gm.test(url);
}
```
## Search
Implémentation de la fonctionnalité de recherche. 
*Cette exemple est basé sur une source monolingue avec du HTML parsé*
```ts
async search(query:string, langs:mirrorsLangsType[], socket: socketInstance|Scheduler, id:number) {
  // nous allons checker si l'utilisateurs annule la reqûete à différents intervales: NE PAS MODIFIER
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
      if(cancel) break; //=> 1er check d'annulation
      const name = $('a.name-manga > h3', el).text().trim(); // récupérer le nom du manga
      const link = $('a.name-manga', el).attr('href')?.replace(this.host, ''); // récupérer l'adresse (relative) du manga

      // ignorer si nous n'avons pas de titre ou d'url, ou si l'url n'est pas validé par this.isMangaPage()
      if((!name || !link) || (link && !this.isMangaPage(link))) continue;

      // cette source ne fournis qu'une seule couverture
      const covers:string[] = [];
      const coverLink:string | undefined = $('.wrapper_imgage img', el).attr('src');
      if(coverLink) {
        const img = await this.downloadImage(coverLink, undefined, false);
        if(img) covers.push(img.src);
      }
      
      // récupérer le synopsis
      let synopsis:string | undefined = $('p.manga-list-4-item-tip:last-of-type', el).text().trim();
      if(synopsis && synopsis.length === 0) synopsis = undefined; // if synopsis === '' then undefined

      // récuparation des infos du dernier chapitre 
      const last_chapter_info = $('a.name-chapter > span', el).text().trim(); // 'Vol.1 Ch.52 - New horizons'

      const match = /regexFromHell/g.exec(last_chapter)
      // last_release nécessite à minima d'un nom de chapitre.
      let last_release = { name: last_chapter_info, volume: undefined, chapter: undefined}
      if(match) {
        const [, , volumeNumber, chapterNumber, , , , chapterName] = match;
        last_release = {
          name: chapterName ? chapterName.trim() : undefined,
          volume: volumeNumber ? parseFloat(volumeNumber) : undefined,
          chapter: chapterNumber ? parseFloat(chapterNumber) : 0,
        };
      }

    // L'utilisation de cette fonction est obligatoire afin de valider les données:
    const searchResults = await this.searchResultsBuilder({
        name, // titre du manga
        url: link, // url relative du manga
        covers, // les couvertures
        last_release, // les infos du dernier chapitre
        langs: this.langs, // dans ce cas la source est monolingue, on peut retourner this.langs
      });

      socket.emit('searchInMirrors', id, searchResults);
    }
    if(cancel) return; //=> 2ème check de l'annulation
  } catch(e) {
    // emition des erreurs: NE PAS MODIFIER
    this.logger('error while searching mangas', e);
    if(e instanceof Error) socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error', trace: e});
    else socket.emit('searchInMirrors', id, {mirror: this.name, error: 'search_error'});
  }
  // informer l'utilisateur que nous avons fini de récupérer les résultats: NE PAS MODIFIER
  socket.emit('searchInMirrors', id, { done: true });
  if(stopListening) stopListening();
}
```
## Recommend
Implémentation du "top 10 / recommendation / les plus regarder " de la 
Cette implémentation est **strictement identique à** [Search](#search) **à part pour le nom des évenements**
*Cette exemple est basé sur une source multi-lingue, où chaque page/url de manga ne contien qu'une seule langue*
```ts
async recommend(requestLangs:mirrorsLangsType[], socket: socketInstance|Scheduler, id: number) {
  // nous allons checker si l'utilisateurs annule la reqûete à différents intervales: NE PAS MODIFIER
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
    // appel fictif d'une API

    // convertir les languages en ISO639-1
    // et supprimer les langues qui ne match pas avec la requête
    mangas = mangas.map(manga => {
      return {
        ...manga,
        lang: ISO3166_1_ALPHA2_TO_ISO639_1(manga.lang)
      }
    })
    .filter(manga => requestLangs.includes(manga.lang))

    for(const manga in mangas) {
      if(cancel) break; //=> 1er vérification d'annulation, sortir de la boucle.

      // L'utilisation de cette fonction est obligatoire afin de valider les données:
      const searchResults = await this.searchResultsBuilder({
          name, // titre du manga
          url: link, // url relative du manga
          covers, // les couvertures
          last_release, // infos sur le dernier chapitre
          langs: [manga.lang], //=> la langue du manga, dans ce cas là, le manga n'a qu'une seule langue.
        });

      socket.emit('searchInMirrors', id, searchResults);
    }
    if(cancel) return; //=> 2ème vérification d'annulation
  } catch(e) {
    this.logger('error while recommending mangas', e);
    // emition des erreurs: NE PAS MODIFIER
    if(e instanceof Error) socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error', trace: e});
    else socket.emit('showRecommend', id, {mirror: this.name, error: 'recommend_error_unknown' });
  }
  // informer l'utilisateur que nous avons fini de récupérer les résultats: NE PAS MODIFIER
  socket.emit('showRecommend', id, { done: true });
  if(stopListening) stopListening();
}
```
## Manga
Récupérer les infos du manga (titre, auteurs, artistes, tags, chapitres, couvertures, etc..).
*Cette exemple est basé sur une source mult-lingue où chaque page de manga peut contenir plusieurs languages, et où les données viennent d'une API*
```ts
// url est toujours une url relative
async manga(url:string, requestedLangs:mirrorsLangsType[], socket:socketInstance|Scheduler, id:number) {
  // nous allons checker si l'utilisateurs annule la reqûete à différents intervales: NE PAS MODIFIER
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
    // titre du manga
    const name =  manga.data.attributes.title[Object.keys(manga.data.attributes.title)[0]];
    // le status de publication
    const status = manga.data.attributes.status || undefined;
    // tags / catégories
    const tags = manga.data.attributes.tags.map(x => x.attributes.name[Object.keys(x.attributes.name)[0]]);

    // rechercher un synopsis qui match avec l'array requestedLangs
    const descriptions = requestedLangs.map(m => manga.data.attributes.description[m]);
    let synopsis:string|undefined|null = undefined;
    // joindre les differents languages ensemble
    if(descriptions.length) synopsis = descriptions.join('\r\n');
    // si aucun n'a été trouvé, essayer anglais
    else synopsis = manga.data.attributes.description['en'];
    // si rien de tout celà n'a fonctionné, synopsis est undefined
    if(!synopsis) synopsis = undefined;

    // récupération des auteurs et des artistes
    const authors = manga.data.relationships
      .filter(x => x.type === 'artist' || x.type === 'author')
      .map(x => (x.attributes as {name: string}).name);

    // récupérer toutes les couvertures
    const covers = await Promise.all(manga.data.relationships.covers.map(coverURL => {
      return this.downloadImage(`${this.host}/covers/${manga.data.id}/${coverURL}.512.jpg`)
    }))

    const langsQuery = requestedLangs.map(x => 'availableTranslatedLanguage[]=' + x).join('&')

    // bouclé 20 fois (nombre arbitraire)
    for (const [page, _] of Array(20).entries()) {
      if(cancel) break;

      const reqURL = `${this.host}/${url}/feed?limit=500&offset=${page*500}&${langsQuery}&includes[]=manga`
      const res = await this.fetch<SuccessType|ErrorType>({
        url: reqURL,
      }, 'json');

      if(res.result !== 'ok') throw new Error(`${res.errors[0].title}: ${res.errors[0].detail}`);

      const chapters:MangaPage['chapters'] = [];
      // filtrer les mangas dont le language match avec les langues de l'array requestedLangs
      const matching = res.data.filter(x => requestedLangs.includes(x.attributes.translatedLanguage))


      // boucle
      for(const x of matching) {

        // utilisation obligatoire de chaptersBuilder, qui valide les données pour chaque chapitre.
        const built = await this.chaptersBuilder({
          url: '/chapter/'+x.id, // url relative du chapitre, ex: /manga/one-punch-man/chapter/25
          lang: x.attributes.translatedLanguage, // langue du chapitre
          number: parseFloat(x.attributes.chapter), // numéro du chapitre
          volume: x.attributes.volume ? parseFloat(x.attributes.volume) : undefined, // numéro de volume du chapitre
          name: x.attributes.title ? x.attributes.title : undefined, // titre ou nom du chapitre
        });

        chapters.push(built);
      }

      // utilisation obligatoire de mangaPageBuilder pour valider les données.
      const mg = await this.mangaPageBuilder({
        url, // url relative du manga ex: /manga/my-hero-acedemia
        langs: [...new Set(matching.map(x => x.attributes.translatedLanguage))], // les langues que nous avons trouvés
        covers, // couvertures
        name, // titre du manga
        synopsis, // synopsis
        tags, // tags
        authors, // auteurs et artistes
        chapters, // les chapitres que nous avons construit avec chaptersBuilder()
        status, // le statut de publication
      });

      socket.emit('showManga', id, mg);

      // sortir de la boucle si on a tout récupérer tout les chapitres
      const current = res.limit + res.offset;
      const total = res.total;
      if(current >= total) break;

    }
    if(cancel) return;
  } catch(e) {
    this.logger('error while fetching manga', e);
    // emition des erreurs: NE PAS MODIFIER
    if(e instanceof Error) socket.emit('showManga', id, {error: 'manga_error', trace: e.message});
    else if(typeof e === 'string') socket.emit('showManga', id, {error: 'manga_error', trace: e});
    else socket.emit('showManga', id, {error: 'manga_error_unknown'});
  }
  if(stopListening) stopListening();
}
```
## Chapter
Récupérer les images d'un chapitre
*Cette exemple est basé sur l'implémentation de mangadex*
```ts
  async chapter(link: string, lang: mirrorsLangsType, socket: socketInstance, id: number, callback?: ((nbOfPagesToExpect: number) => void) | undefined, retryIndex?: number | undefined) {
    // nous allons checker si l'utilisateurs annule la reqûete à différents intervales: NE PAS MODIFIER
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
          url: this.#path(`/at-home/server/${match[0]}`) // this.#path est une fonction privé qui retourne une url complète vers l'API
        }, 'json');

      if(resp.result !== 'ok') throw new Error(`${resp.errors[0].title}: ${resp.errors[0].detail}`);
      if(callback) callback(resp.chapter.data.length); //=> on envoi le nombre de page attendues

      const type = this.options.dataSaver ? 'dataSaver' : 'data'; //=> mangadex à une option dataSaver, les urls où nous récupérons les images diffères en fonction de celle-ci.

      for(const [i, v] of resp.chapter[type].entries()) {
        if(cancel) break;
        // si l'utilisateur à demandé une page en particulier on continue jusqu'à arriver à la page demandé.
        if(typeof retryIndex === 'number' && i !== retryIndex) continue;

        // utilisation de downloadImage()
        const img = await this.downloadImage(`${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`);
        // emition de la réponse
        if(img) {
          socket.emit(
            'showChapter',
            id, // on retourne l'id que nous avons eu en argument
            {
              index: i, // index de la page
              src: img.src, // downloadImage().src
              height: img.height, // downloadImage().height
              width: img.width, // downloadImage().width
              // si retryIndex est défini, alors c'est systématique la dernier page
              // sinon on vérifie qu'on soit à la fin de notre boucle
              lastpage: typeof retryIndex === 'number' ? true : i+1 === resp.chapter.data.length
            }
          );
        }
        // si l'image n'a pu être récupérée
        else socket.emit(
          'showChapter',
          id, // on retourne l'id que nous avons eu en argument
          {
            error: 'chapter_error_no_image', // on retourne l'erreur
            trace: `cannot open: ${resp.baseUrl}/${type}/${resp.chapter.hash}/${v}`, // en donnant des indices
            index: i,
              // si retryIndex est défini, alors c'est systématique la dernier page
              // sinon on vérifie qu'on soit à la fin de notre boucle
            lastpage: typeof retryIndex === 'number' ? true : i+1 === resp.chapter.data.length // lastp
          }
        );
      }
      if(cancel) return;
    } catch(e) {
      this.logger('error while fetching chapter', e);
      // emition des erreurs: NE PAS MODIFIER
      if(e instanceof Error) socket.emit('showChapter', id, {error: 'chapter_error', trace: e.message});
      else if(typeof e === 'string') socket.emit('showChapter', id, {error: 'chapter_error', trace: e});
      else socket.emit('showChapter', id, {error: 'chapter_error_unknown'});
    }
    if(stopListening) stopListening();
  }
```