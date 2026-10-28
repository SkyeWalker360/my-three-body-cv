import { describe, expect, it } from 'vitest';
import raw from '@content/cv-manifest.json';
import { parseLogbook, serializeLogbook } from '@/features/field-scanner/logbook';
import { INITIAL, step } from '@/features/field-scanner/navigation';
import { buildRegions } from '@/features/field-scanner/regions';
import {
  DUST,
  EMPTY,
  silhouette,
  SPRITE_SIZE,
  type SpriteKind,
  specimenSprite,
} from '@/features/field-scanner/sprite';
import { RAMP_STEPS } from '@/lib/palette';
import { parseManifest } from '@/lib/schema';

const manifest = parseManifest(raw);
const regions = buildRegions(manifest);
const specimens = regions.flatMap((r) => r.specimens);

/** Every string anywhere in the manifest. */
function strings(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}
const facts = strings(manifest);

describe('field scanner specimens', () => {
  it('copies every CV text verbatim from the manifest', () => {
    for (const s of specimens.filter((s) => !s.siteCopy)) {
      expect(facts, s.key).toContain(s.name);
      for (const part of s.habitat?.split(' · ') ?? []) expect(facts, s.key).toContain(part);
      for (const block of s.log) {
        if (block.heading) expect(facts, s.key).toContain(block.heading);
        for (const line of block.lines) expect(facts, s.key).toContain(line);
      }
      for (const label of s.chain?.labels ?? []) expect(facts, s.key).toContain(label);
    }
  });

  it('covers every manifest entry, with one specimen per certification level', () => {
    const count = (id: string) => regions.find((r) => r.id === id)?.specimens.length ?? 0;
    expect(count('experience')).toBe(manifest.experience.length);
    expect(count('projects')).toBe(manifest.projects.length);
    expect(count('certifications')).toBe(
      manifest.certifications.reduce((n, c) => n + c.levels.length, 0),
    );
    expect(count('education')).toBe(manifest.education.length);
    expect(count('skills')).toBe(manifest.skills.length);
    expect(count('achievements')).toBe(manifest.achievements.length);
  });

  it('numbers specimens 1…N with unique keys', () => {
    expect(specimens.map((s) => s.no)).toEqual(specimens.map((_, i) => i + 1));
    expect(new Set(specimens.map((s) => s.key)).size).toBe(specimens.length);
  });

  it('builds evolution chains only from links in the manifest', () => {
    const lead = specimens.find((s) => s.key === 'experience:lead-life')!;
    const gen = specimens.find((s) => s.key === 'experience:gen318')!;
    expect(lead.chain).toEqual({ labels: ['Lead Life', 'GEN318'], here: 0 });
    expect(gen.chain).toEqual({ labels: ['Lead Life', 'GEN318'], here: 1 });
    const mt2 = specimens.find((s) => s.key === 'certification:ndt-mt:1')!;
    expect(mt2.chain?.here).toBe(1);
    expect(specimens.find((s) => s.region === 'skills')?.chain).toBeUndefined();
  });

  it('keeps site copy to the Sightings region', () => {
    for (const s of specimens) expect(!!s.siteCopy, s.key).toBe(s.region === 'sightings');
  });
});

describe('field scanner navigation', () => {
  const sizes = regions.map((r) => r.specimens.length);
  const options = sizes.length;

  it('moves through regions and wraps onto Options', () => {
    expect(step(INITIAL, { type: 'left' }, sizes).region).toBe(options);
    expect(step({ ...INITIAL, region: options }, { type: 'right' }, sizes).region).toBe(0);
  });

  it('opens, steps between and closes entries', () => {
    let s = step(INITIAL, { type: 'down' }, sizes);
    expect(s.selected).toBe(1);
    s = step(s, { type: 'a' }, sizes);
    expect(s.view).toBe('detail');
    s = step(s, { type: 'right' }, sizes);
    expect(s).toMatchObject({ region: 0, selected: 0, view: 'detail' });
    expect(step(s, { type: 'down' }, sizes)).toBe(s);
    expect(step(s, { type: 'b' }, sizes).view).toBe('list');
  });

  it('opens a row on a second tap', () => {
    const once = step(INITIAL, { type: 'pick', index: 1 }, sizes);
    expect(once).toMatchObject({ selected: 1, view: 'list' });
    expect(step(once, { type: 'pick', index: 1 }, sizes).view).toBe('detail');
  });

  it('B on Options goes back to the first region; A there does nothing', () => {
    const o = step(INITIAL, { type: 'options' }, sizes);
    expect(o.region).toBe(options);
    expect(step(o, { type: 'a' }, sizes)).toBe(o);
    expect(step(o, { type: 'b' }, sizes).region).toBe(0);
  });
});

describe('field scanner logbook', () => {
  const known = new Set(['a', 'b']);
  it('round-trips and drops unknown keys', () => {
    expect([...parseLogbook(serializeLogbook(new Set(['b', 'a', 'z'])), known)].sort()).toEqual([
      'a',
      'b',
    ]);
  });
  it('treats malformed data as empty', () => {
    for (const bad of [null, '', '{', '{"a":1}', '[1,2]'])
      expect(parseLogbook(bad, known).size).toBe(0);
  });
});

describe('field scanner sprites', () => {
  const kinds: SpriteKind[] = [
    'ship',
    'relay',
    'magnet',
    'badge',
    'creature',
    'star',
    'dying',
    'black-hole',
    'planet',
  ];

  it('draws only ramp steps, and something for every kind', () => {
    for (const kind of kinds) {
      for (const t of [0, 0.7, 3.3]) {
        const f = specimenSprite('skills:Cloud', kind, 'cyan', t);
        expect(f.cells.length).toBe(SPRITE_SIZE * SPRITE_SIZE);
        const max = f.ramps.length * RAMP_STEPS;
        let drawn = 0;
        for (const v of f.cells) {
          expect(v === EMPTY || v === DUST || (v >= 0 && v < max), `${kind} ${v}`).toBe(true);
          if (v >= 0) drawn++;
        }
        expect(drawn, kind).toBeGreaterThan(40);
      }
    }
  });

  it('is deterministic per key and differs between keys', () => {
    const a = specimenSprite('skills:Cloud', 'creature', 'cyan', 1);
    expect(specimenSprite('skills:Cloud', 'creature', 'cyan', 1).cells).toEqual(a.cells);
    expect(specimenSprite('skills:Coding Languages', 'creature', 'cyan', 1).cells).not.toEqual(
      a.cells,
    );
  });

  it('mirrors creatures left to right', () => {
    const { cells } = specimenSprite('skills:Cloud', 'creature', 'cyan', 1);
    for (let y = 4; y < 28; y++) {
      for (let x = 4; x < 16; x++) {
        // Background dust is scattered at random, so only drawn cells are compared.
        const norm = (v: number) => (v < 0 ? -1 : v);
        expect(norm(cells[y * SPRITE_SIZE + x]!)).toBe(norm(cells[y * SPRITE_SIZE + (31 - x)]!));
      }
    }
  });

  it('turns unscanned specimens into a one-step void silhouette', () => {
    const s = silhouette(specimenSprite('x', 'star', 'star', 0));
    expect(s.ramps).toEqual(['void']);
    expect(new Set([...s.cells].filter((v) => v >= 0))).toEqual(new Set([2]));
  });
});
