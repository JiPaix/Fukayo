import type { MangaErrorMessage } from '@api/models/types/errors';
import type { MangaInDB, MangaPage } from '@api/models/types/manga';

export function isMangaInDB(res: MangaPage | MangaInDB | MangaErrorMessage): res is MangaInDB {
  return (res as MangaInDB).inLibrary === true && (res as MangaInDB).meta !== undefined;
}

export function isManga(res: MangaPage | MangaErrorMessage | MangaInDB | unknown): res is MangaPage|MangaInDB {
  return (res as MangaPage).inLibrary !== undefined;
}

export function isMangaPage(res: unknown): res is MangaPage {
  return (res as MangaPage).inLibrary == false;
}
