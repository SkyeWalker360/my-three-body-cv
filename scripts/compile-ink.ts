/** Compile content/noctus/act-*.ink into public/noctus/act-*.json for the inkjs runtime. */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileInk } from './ink';

const src = join(process.cwd(), 'content', 'noctus');
const out = join(process.cwd(), 'public', 'noctus');
mkdirSync(out, { recursive: true });

const acts = readdirSync(src).filter((f) => /^act-\d+\.ink$/.test(f));
for (const file of acts) {
  writeFileSync(join(out, file.replace(/\.ink$/, '.json')), compileInk(join(src, file)));
}
console.log(`ink: compiled ${acts.length} acts to public/noctus/`);
