/** Asteroid seeds that come straight from the manifest instead of the CV blocks on screen. */
import { findEntry } from '@/lib/entries';
import { manifestData } from '@/lib/manifest-data';
import type { Game as GameBlock } from '@/lib/schema';
import type { Seed } from './harvest';

export function gameFor(id: string): GameBlock | undefined {
  if (id === 'skills') {
    return { hp: 4, fragments: manifestData.skills.slice(0, 4).map((s) => s.category) };
  }
  return findEntry(manifestData, id)?.entry.game;
}

/** Every entry with a game block, spread over the top of a `width` × `height` field. */
export function manifestSeeds(width: number, height: number): Seed[] {
  const ids = [
    ...manifestData.experience,
    ...manifestData.certifications,
    ...manifestData.projects,
    ...manifestData.education,
  ]
    .filter((e) => e.game)
    .map((e) => e.id);
  return ids.map((id, i) => {
    const found = findEntry(manifestData, id)!;
    const label =
      'org' in found.entry
        ? found.entry.org
        : 'name' in found.entry
          ? found.entry.name
          : found.entry.institution;
    // The engine draws an asteroid at 35% of its block's width: 320 gives about 112 px, room
    // for a readable label even on a phone. Staggered over three rows so they don't stack.
    const w = 320;
    const h = 190;
    return {
      id,
      label,
      rect: {
        x: ((i + 0.5) / ids.length) * width - w / 2,
        y: height * (0.14 + 0.13 * (i % 3)),
        w,
        h,
      },
    };
  });
}
