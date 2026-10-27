/** Fails the build when content/cv-manifest.json doesn't match the schema. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest } from '../src/lib/schema';

const path = join(process.cwd(), 'content', 'cv-manifest.json');
try {
  const m = parseManifest(JSON.parse(readFileSync(path, 'utf8')));
  console.log(`manifest: OK (${m.person.name}, ${m.experience.length} experience entries)`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
