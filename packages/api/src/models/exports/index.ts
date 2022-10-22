import type Mirror from '@api/models';
import fallenangels from '@api/models/fallenangels';
import komga from '@api/models/komga';
import mangadex from '@api/models/mangadex';
import mangafox from '@api/models/mangafox';
import mangahasu from '@api/models/mangahasu';
import scanfr from '@api/models/scan-fr';
import tachidesk from '@api/models/tachidesk';
import type MirrorInterface from '../interfaces';

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
