import type Importer from '@api/models/imports/interfaces';
import MangadexImporter from '@api/models/imports/mangadex';
import TachideskImporter from '@api/models/imports/tachidesk';

const imports:Importer[] = [MangadexImporter, TachideskImporter];

export default imports;
