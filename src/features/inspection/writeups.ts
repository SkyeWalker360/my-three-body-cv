import type { ManifestEntry } from '@/lib/entries';
import { MAX_DEFECTS } from './defects';

/** A piece of a write-up: an optional heading and its lines, all verbatim from the manifest. */
export type Section = { title?: string; lines: string[] };

/** Splits a manifest entry into the sections its write-ups are built from. Nothing is added. */
export function sectionsFor(e: ManifestEntry): Section[] {
  switch (e.type) {
    case 'experience': {
      const x = e.entry;
      return [
        ...(x.summary ? [{ lines: [x.summary] }] : []),
        ...(x.roles ?? []).map((r) => ({ title: r.title, lines: r.highlights })),
        ...(x.highlights ?? []).map((h) => ({ lines: [h] })),
        ...(x.later ? [{ lines: [x.later] }] : []),
      ];
    }
    case 'project':
      return e.entry.highlights.map((h) => ({ lines: [h] }));
    case 'certification':
      return e.entry.levels.map((l) => ({ lines: [l] }));
    case 'education':
      return [
        ...(e.entry.qualifications ?? []).map((q) => ({ lines: [q] })),
        ...(e.entry.detail ? [{ lines: [e.entry.detail] }] : []),
      ];
  }
}

/**
 * The write-ups behind a card's indications: its sections split, in order, into at most three
 * groups of near-equal size. One indication per group.
 */
export function writeUps(e: ManifestEntry): Section[][] {
  const sections = sectionsFor(e);
  const n = Math.min(MAX_DEFECTS, sections.length);
  const groups: Section[][] = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const size = Math.ceil((sections.length - start) / (n - i));
    groups.push(sections.slice(start, start + size));
    start += size;
  }
  return groups;
}
