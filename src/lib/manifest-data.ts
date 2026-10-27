import raw from '@content/cv-manifest.json';
import type { CvManifest } from './schema';

/**
 * The manifest for client-side features (K.A.R.L., the shooter). It's validated at build
 * time by scripts/validate-manifest.ts and lib/manifest.ts, so the browser bundle skips Zod.
 */
export const manifestData = raw as unknown as CvManifest;
