export type ErrorMessage = {
    error:string
    trace?:string
}

export type MangaErrorMessage = {
    error:'manga_error'|'manga_error_unknown'|'manga_error_invalid_link'
    trace?:string
}

export type SearchErrorMessage = {
    mirror: string;
    error:'search_error'|'search_error_unknown'
    trace?:string
}

export type ChapterErrorMessage = {
    error:'chapter_error'|'chapter_error_unknown'|'chapter_error_invalid_link'|'chapter_error_fetch'|'chapter_error_no_pages'
    trace?: string
    url?: string
}
export type ChapterImageErrorMessage = {
    error:'chapter_error'|'chapter_error_unknown'|'chapter_error_invalid_link'|'chapter_error_fetch'|'chapter_error_no_image'
    trace?: string
    url?: string
    index: number
    lastpage: boolean
}

export type RecommendErrorMessage = {
  mirror: string;
  error:'recommend_error'|'recommend_error_unknown'
  trace?:string
}

export function isErrorMessage(x: unknown): x is ErrorMessage {
    if(!x) return false;
    if(typeof x === 'object') {
        return Object.prototype.hasOwnProperty.call(x, 'error');
    }
    return false;
}
