/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { api, endpoint, request, response, body, pathParams } from '@airtasker/spot';
import type { ChapterErrorMessage, ChapterPageErrorMessage, MangaErrorMessage, SearchErrorMessage } from '../src/mirrors/types/errorMessages';
import type { SearchResult } from '../src/mirrors/types/search';
import type { MangaPage } from '../src/mirrors/types/manga';
import type { ChapterPage } from '../src/mirrors/types/chapter';

// this file is used to define the API.

interface query {
  query: string;
}

interface mirror {
  mirror: string
}

interface error400 {
  /** error describing why this is a bad request */
  error: string
}

interface error404 {
  error: 'mirror_not_found'
}

type obj = { key: string, value: string }


interface options {
  /**
   * key: value
   */
  option_name:  string|boolean|number|obj|string[]|boolean[]|number[]|obj[]
}


@api({
  name: 'Mangas',
})
class Api {}

/**
 * Get information about all mirrors
 */
 @endpoint({
  method: 'GET',
  path: '/api/mirrors/list',
  tags: ['mirror'],
})
class getMirrorsInfo {
  @response({status: 201 })
  response(@body body: getMirrorsResponse[]) {}
}

interface getMirrorsResponse {
  /** The mirror name */
  name: string,
  /** The mirror webpage */
  host: string,
  /** Whether the mirror is enabled or not */
  enabled: boolean,
  /** The mirror icon */
  icon: string
}

/**
 * Get information about a specific mirror
 */
 @endpoint({
  method: 'GET',
  path: '/api/mirrors/:mirror',
  tags: ['mirror'],
})
class getMirrorInfo {
  @request
  request(
    @pathParams pathParams: mirror,
  ) {}

  @response({status: 201 })
  response(@body body: getMirrorsResponse) {}
}

/**
 * Get a mirror options list
 */
 @endpoint({
  method: 'GET',
  path: '/api/mirrors/:mirror/options',
  tags: ['mirror'],
})
class getMirrorOptions {
  @request
  request(
    @pathParams pathParams: mirror,
  ) {}

  @response({status: 404})
  mirrorNotFoundResponse(@body body: error404) {}

  @response({status: 201})
  successResponse(@body body:options) {}
}

/**
 * Set options for a mirror
 */
 @endpoint({
  method: 'POST',
  path: '/api/mirrors/:mirror/options',
  tags: ['mirror'],
})
class SetMirrorOptions {
  @request
  request(
    @pathParams pathParams: mirror,
    @body body: options,
  ) {}

  @response({status: 201})
  successResponse(@body body:options) {}

  @response({status: 400})
  badRequestResponse(@body body: error400) {}

  @response({status: 404})
  mirrorNotFoundResponse(@body body: error404) {}

}

/**
 * Search mangas through all enabled mirrors
 */
 @endpoint({
  method: 'POST',
  path: '/api/mirrors/search',
  tags: ['mirror'],
})
class searchManga {
  @request
  request(@body body: query) {}

  /**
   * Results may be an array of search results AND error messages
   */
  @response({ status: 201 })
  response(@body body: searchMangaResponseError[]|searchMangaResponse[]) {}
}


interface searchMangaResponseError {
  /** The error message */
  error: SearchErrorMessage['error']
  /** The error trace */
  trace?: SearchErrorMessage['trace'],
  /** The mirror where the error occured */
  mirror: string,
}

interface searchMangaResponse {
  /** Mirror name */
  mirror: string;
  /** Array of results */
  results: SearchResult[];
}

/**
 * Search mangas in a specific mirror
 */
 @endpoint({
  method: 'POST',
  path: '/api/mirrors/:mirror/search',
  tags: ['mirror'],
})
class searchMangaInMirror {
  @request
  request(
    @pathParams pathParams: mirror,
    @body body: query,
  ) {}

  @response({status: 201})
  successResponse(@body body: SearchResult[]) {}

  @response({status: 400})
  badRequestResponse(@body body: error400) {}

  @response({status: 404})
  mirrorNotFoundResponse(@body body: error404) {}

  @response({status: 500})
  errorResponse(@body body: SearchErrorMessage) {}
}

/**
 * Get a manga information such as title, author, description, chapters list, etc.
 */
@endpoint({
  method: 'POST',
  path: '/api/mirrors/:mirror/manga',
  tags: ['mirror'],
})
class getManga {
  @request
  request(
    @pathParams pathParams: mirror,
    @body body: {
      /** relative link to manga page, eg. /manga/one_piece/ */
      query: string
    },
  ) {}

  @response({status: 201})
  successResponse(@body body:MangaPage) {}

  @response({status: 400})
  badRequestResponse(@body body: error400) {}

  @response({status: 404})
  mirrorNotFoundResponse(@body body: error404) {}

  @response({status: 500})
  errorResponse(@body body: MangaErrorMessage) {}
}

/**
 * Get chapter's images
 */
 @endpoint({
  method: 'POST',
  path: '/api/mirrors/:mirror/chapter',
  tags: ['mirror'],
})
class getChapterImages {
  @request
  request(
    @pathParams pathParams: mirror,
    @body body: {
      /** relative link to the chapter, eg. /manga/one_piece/chapter5 */
      query: string
    },
  ) {}

  /**
   * Response may be an array of chapter pages AND error messages
   */
  @response({status: 201})
  successResponse(@body body:ChapterPage[]|ChapterPageErrorMessage[]) {}

  @response({status: 400})
  badRequestResponse(@body body: error400) {}

  @response({status: 404})
  mirrorNotFoundResponse(@body body: error404) {}

  @response({status: 500})
  errorResponse(@body body: ChapterErrorMessage) {}
}




