import type Mirror from '@api/models/abstracts';
import fallenangels from '@api/models/fallenangels';
import type MirrorInterface from '@api/models/interfaces';
import komga from '@api/models/komga';
import mangadex from '@api/models/mangadex';
import mangafox from '@api/models/mangafox';
import mangahasu from '@api/models/mangahasu';
import scanfr from '@api/models/scan-fr';
import tachidesk from '@api/models/tachidesk';

/** Every mirrors */
const mirrors: (Mirror & MirrorInterface)[] = [
  mangafox,
  mangahasu,
  scanfr,
  fallenangels,
  komga,
  tachidesk,
  mangadex,
];

export default mirrors;
