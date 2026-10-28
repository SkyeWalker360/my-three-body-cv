/**
 * The Go engine's memory layout and palette order, mirrored for the page. Pure constants;
 * tests/unit/engine-layout.test.ts checks them against engine/sim/state.go and
 * engine/raster/palette.go so the two can't drift apart.
 */

/** Theme tokens (without --color-) for each palette index the engine draws. */
export const ENGINE_PALETTE = [
  'void',
  'ink',
  'ink-muted',
  'cyan',
  'gold',
  'red',
  'green',
  'violet',
  'violet-ink',
  ...(['void', 'cyan', 'gold', 'red', 'violet', 'star'] as const).flatMap((ramp) =>
    [0, 1, 2, 3, 4, 5].map((step) => `${ramp}-${step}`),
  ),
];

/** Offsets into the float64 state buffer. */
export const STATE = {
  kinetic: 0,
  potential: 1,
  total: 2,
  drift: 3,
  ghostGap: 4,
  simTime: 5,
  momentumX: 6,
  momentumY: 7,
  angular: 8,
  preset: 9,
  ghostOn: 10,
  era: 11,
  civil: 12,
  lights: 13,
  critical: 14,
  stars: 16,
  starWidth: 6,
  length: 34,
} as const;

export const EVENT = {
  collision: 1,
  supernova: 2,
  engulfment: 3,
  ejection: 4,
  giant: 5,
  remnant: 6,
  criticalOn: 7,
  criticalOff: 8,
  electrical: 9,
} as const;

export const EVENT_SLOTS = 32;
export const EVENT_STRIDE = 4;
export const PLANET_BODY = 99;

export const STAR_KINDS = ['Red dwarf', 'Yellow dwarf', 'Blue-white giant'] as const;
export const STAR_PHASES = [
  'Main sequence',
  'Giant',
  'White dwarf',
  'Neutron star',
  'Black hole',
] as const;
export const ERAS = ['—', 'Stable', 'Scorched', 'Frozen'] as const;

/** Largest framebuffer the engine accepts (engine/raster MaxPixels). */
export const MAX_PIXELS = 160_000;
