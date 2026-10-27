import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cvManifestSchema, parseManifest } from '@/lib/schema';

const raw = JSON.parse(readFileSync(join(process.cwd(), 'content', 'cv-manifest.json'), 'utf8'));

describe('cv-manifest.json', () => {
  it('passes the schema', () => {
    expect(() => parseManifest(raw)).not.toThrow();
  });

  it('rejects a phone number in the public contact block', () => {
    const bad = structuredClone(raw);
    bad.person.contact.phone = '000 000 0000';
    expect(cvManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects aliases pointing at unknown ids', () => {
    const bad = structuredClone(raw);
    bad.karl.aliases.ghost = ['ghost'];
    expect(cvManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-ISO dates', () => {
    const bad = structuredClone(raw);
    bad.experience[0].start = 'November 2022';
    expect(cvManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('gives every destructible entry a game block', () => {
    const m = parseManifest(raw);
    for (const e of [...m.experience, ...m.projects, ...m.certifications, ...m.education]) {
      expect(e.game, e.id).toBeDefined();
    }
  });
});
