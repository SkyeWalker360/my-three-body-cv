import raw from '@content/cv-manifest.json';
import { parseManifest } from './schema';

/** The validated CV manifest. Importing this at build time fails the build on invalid data. */
export const manifest = parseManifest(raw);

export * from './schema';
