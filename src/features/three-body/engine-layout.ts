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
  bodies: 15,
  stars: 16,
  starWidth: 6,
  length: 34,
} as const;

/** One row per body in the bodies buffer (stars first; rows 0–2 are stars 0–2). */
export const BODY = {
  x: 0,
  y: 1,
  vx: 2,
  vy: 3,
  mass: 4,
  kind: 5,
  /** Star: luminosity in Suns. Planet: received light (Sun = 1). Fragment: age in seconds. */
  extra: 6,
  width: 7,
  rows: 64,
} as const;
export const BODY_KINDS = ['star', 'planet', 'fragment'] as const;

/** The effects buffer: [count, then rows]. Radii are in AU, as the engine draws them. */
export const EFFECT = {
  kind: 0,
  x: 1,
  y: 2,
  radius: 3,
  strength: 4,
  width: 5,
  rows: 13,
  shell: 1,
  shock: 2,
  flash: 3,
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
