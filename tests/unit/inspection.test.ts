import { describe, expect, it } from 'vitest';
import manifest from '@content/cv-manifest.json';
import { findEntry } from '@/lib/entries';
import type { CvManifest } from '@/lib/schema';
import {
  BAND,
  cellsPath,
  defects,
  hashString,
  HIT,
  MAX_DEFECTS,
  particleAt,
  particlesFor,
  settleTime,
} from '@/features/inspection/defects';
import { sectionsFor, writeUps } from '@/features/inspection/writeups';

const m = manifest as unknown as CvManifest;
const ids = [...m.experience, ...m.projects, ...m.certifications, ...m.education].map((e) => e.id);
/** Every string anywhere in the manifest. */
const manifestStrings = new Set<string>();
(function walk(v: unknown) {
  if (typeof v === 'string') manifestStrings.add(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
})(manifest);

/** Card padding is p-6 (24 px): text never starts closer than this to the border box. */
const PADDING = 24;

describe('inspection defects', () => {
  const sizes = [
    [320, 240],
    [600, 420],
    [1200, 180],
    [40, 900],
  ] as const;

  it('gives at most three defects, each on its own edge', () => {
    for (const [w, h] of sizes) {
      for (const id of ids) {
        const found = defects(hashString(id), w, h, 5);
        expect(found.length).toBeLessThanOrEqual(MAX_DEFECTS);
        expect(new Set(found.map((d) => d.edge)).size).toBe(found.length);
      }
    }
  });

  it('keeps every crack cell inside the pixel-border band, outside the card', () => {
    for (const [w, h] of sizes) {
      for (const id of ids) {
        for (const d of defects(hashString(id), w, h, 3)) {
          for (const [x, y] of [...d.core, ...d.glow]) {
            const inBandX = x >= -BAND && x < 0 ? true : x >= w && x < w + BAND;
            const inBandY = y >= -BAND && y < 0 ? true : y >= h && y < h + BAND;
            expect(inBandX || inBandY, `${id} ${d.edge} (${x}, ${y})`).toBe(true);
            expect(x >= -BAND && x < w + BAND && y >= -BAND && y < h + BAND).toBe(true);
          }
          expect(d.core.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('blooms only outward, within 3 px beyond the band', () => {
    for (const [w, h] of sizes) {
      for (const d of defects(hashString('ctu'), w, h, 3)) {
        expect(d.bloom.length).toBeGreaterThan(0);
        for (const [x, y] of d.bloom) {
          expect(x < -BAND || y < -BAND || x >= w + BAND || y >= h + BAND).toBe(true);
          expect(x >= -BAND - 3 && x < w + BAND + 3 && y >= -BAND - 3 && y < h + BAND + 3).toBe(
            true,
          );
        }
      }
    }
  });

  it('keeps hit targets 24 px thick and out of the padding where text lives', () => {
    for (const [w, h] of sizes) {
      for (const d of defects(hashString('gen318'), w, h, 3)) {
        const thick = d.edge === 'top' || d.edge === 'bottom' ? d.hit.h : d.hit.w;
        expect(thick).toBe(HIT);
        const inside = {
          top: d.hit.y + d.hit.h,
          bottom: h - d.hit.y,
          left: d.hit.x + d.hit.w,
          right: w - d.hit.x,
        }[d.edge];
        expect(inside).toBeLessThan(PADDING);
      }
    }
  });

  it('is deterministic for a seed and size', () => {
    expect(defects(7, 500, 300, 3)).toEqual(defects(7, 500, 300, 3));
    expect(defects(7, 500, 300, 3)).not.toEqual(defects(8, 500, 300, 3));
  });

  it('skips cards too small to hold a crack', () => {
    expect(defects(1, 20, 400, 3)).toEqual([]);
  });

  it('drifts particles from outside the card onto the crack', () => {
    const [d] = defects(hashString('homelab'), 500, 300, 1);
    const ps = particlesFor(d!, 3);
    const end = settleTime(ps);
    for (const p of ps) {
      expect(particleAt(p, 0)).toEqual(p.from);
      expect(particleAt(p, end)).toEqual(p.to);
      expect(d!.core).toContainEqual(p.to);
      const [x, y] = p.from;
      expect(x < 0 || y < 0 || x >= 500 || y >= 300).toBe(true);
    }
  });

  it('draws cells as crisp unit squares', () => {
    expect(cellsPath([[2, -3]])).toBe('M2 -3h1v1h-1z');
  });
});

describe('inspection write-ups', () => {
  it('quote the manifest verbatim and never add text', () => {
    for (const id of ids) {
      const entry = findEntry(m, id)!;
      for (const s of sectionsFor(entry)) {
        if (s.title) expect(manifestStrings.has(s.title), s.title).toBe(true);
        for (const line of s.lines) expect(manifestStrings.has(line), line).toBe(true);
      }
    }
  });

  it('split every section, in order, into one to three indications', () => {
    for (const id of ids) {
      const entry = findEntry(m, id)!;
      const groups = writeUps(entry);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.length).toBeLessThanOrEqual(MAX_DEFECTS);
      expect(groups.flat()).toEqual(sectionsFor(entry));
      expect(groups.every((g) => g.length > 0)).toBe(true);
    }
  });

  it('keeps each GEN318 role together under its title', () => {
    const groups = writeUps(findEntry(m, 'gen318')!);
    const titles = groups.flat().flatMap((s) => (s.title ? [s.title] : []));
    expect(titles).toEqual(m.experience[0]!.roles!.map((r) => r.title));
  });
});
