import AMRImporter from '@api/models/imports/all-mangas-reader';
import type Importer from '@api/models/imports/interfaces';
import KomgaImporter from '@api/models/imports/komga';
import MangadexImporter from '@api/models/imports/mangadex';
import TachideskImporter from '@api/models/imports/tachidesk';

const imports:Importer[] = [MangadexImporter, TachideskImporter, KomgaImporter, AMRImporter];

export default imports;
