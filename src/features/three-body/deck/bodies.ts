import { BODY, ERAS, STAR_KINDS, STAR_PHASES, STATE } from '../engine-layout';
import type { Vec3 } from './camera';
import { R_EARTH, AU, rSunToAu, schwarzschildAu } from './units';

/**
 * What the deck knows about each body, read from the engine's state and bodies buffers.
 *
 * Compact scale (Luke, 28 Oct): bodies are drawn at the size the lab draws them, which is far
 * larger than life, and the HUD says so. `radius` is that drawn size in AU; `trueRadius` is the
 * physical radius, shown on body cards with the magnification between the two.
 */

/** Engine pixels per AU at its reference frame (270 px high, ±2 AU): sim.referenceScale. */
export const ENGINE_PX_PER_AU = 270 / 4;
/** The planet's drawn radius in engine pixels (sim.planetRadius). */
export const PLANET_RADIUS_PX = 3.5;
/** Main-sequence radius of each star kind in engine pixels (stars.Kind.Radius). */
export const BASE_RADIUS_PX = [4, 5, 6] as const;
/** Main-sequence physical radius of each star kind, in solar radii. */
export const TRUE_RADIUS_RSUN = [0.3, 1, 7] as const;
/**
 * The engine swells a giant by about ×2.6 (Sun) to ×3.2 (blue giant) in pixels; a real
 * red giant reaches ~100 solar radii. Physical growth = (pixel growth)^GIANT_EXPONENT.
 */
export const GIANT_EXPONENT = Math.log(100) / Math.log(2.6);
const WHITE_DWARF_RSUN = 0.012;

export type DeckBody = {
  id: string;
  name: string;
  kind: 'star' | 'planet' | 'fragment';
  position: Vec3;
  velocity: Vec3;
  /** Solar masses. */
  mass: number;
  /** Drawn radius, AU (compact scale). */
  radius: number;
  /** Physical radius, AU. */
  trueRadius: number;
  /** Kelvin; 0 for bodies that don't shine. */
  temperature: number;
  /** Suns. */
  luminosity: number;
  /** Star index 0–2, or -1. */
  star: number;
  starKind?: (typeof STAR_KINDS)[number];
  phase?: (typeof STAR_PHASES)[number];
  /** Stellar ramp step 0–5 (cool → hot). */
  colourClass: number;
  /** Planet only. */
  era?: (typeof ERAS)[number];
  lights?: boolean;
  civilisation?: number;
};

export const STAR_NAMES = ['Star A', 'Star B', 'Star C'] as const;

/** Physical radius of star `kind` in `phase`, given its current engine pixel radius. */
export function trueStarRadius(kind: number, phase: number, radiusPx: number, mass: number) {
  const name = STAR_PHASES[phase];
  if (name === 'Black hole') return schwarzschildAu(mass);
  if (name === 'White dwarf') return rSunToAu(WHITE_DWARF_RSUN);
  if (name === 'Neutron star') return 12_000 / AU;
  const growth = Math.max(1, radiusPx / BASE_RADIUS_PX[kind]!);
  return rSunToAu(TRUE_RADIUS_RSUN[kind]! * growth ** GIANT_EXPONENT);
}

/** Builds the body list from the engine's buffers. Allocation-light, called once a frame. */
export function readBodies(state: Float64Array, bodies: Float64Array): DeckBody[] {
  const n = Math.min(BODY.rows, Math.max(0, Math.round(state[STATE.bodies]!)));
  const out: DeckBody[] = [];
  let fragments = 0;
  for (let i = 0; i < n; i++) {
    const o = i * BODY.width;
    const kindCode = bodies[o + BODY.kind]!;
    const position: Vec3 = [bodies[o + BODY.x]!, bodies[o + BODY.y]!, 0];
    const velocity: Vec3 = [bodies[o + BODY.vx]!, bodies[o + BODY.vy]!, 0];
    const mass = bodies[o + BODY.mass]!;
    const extra = bodies[o + BODY.extra]!;
    if (kindCode === 0 && i < 3) {
      const s = STATE.stars + i * STATE.starWidth;
      const kind = state[s]!;
      const phase = state[s + 1]!;
      const radiusPx = state[s + 3]!;
      const black = STAR_PHASES[phase] === 'Black hole';
      out.push({
        id: `star-${i}`,
        name: STAR_NAMES[i]!,
        kind: 'star',
        position,
        velocity,
        mass,
        radius: radiusPx / ENGINE_PX_PER_AU,
        trueRadius: trueStarRadius(kind, phase, radiusPx, mass),
        temperature: black ? 0 : state[s + 2]!,
        luminosity: black ? 0 : extra,
        star: i,
        starKind: STAR_KINDS[kind],
        phase: STAR_PHASES[phase],
        colourClass: state[s + 5]!,
      });
    } else if (kindCode === 1) {
      out.push({
        id: 'planet',
        name: 'Planet',
        kind: 'planet',
        position,
        velocity,
        mass,
        radius: PLANET_RADIUS_PX / ENGINE_PX_PER_AU,
        trueRadius: R_EARTH / AU,
        temperature: 0,
        luminosity: 0,
        star: -1,
        colourClass: 0,
        era: ERAS[state[STATE.era]!],
        lights: state[STATE.lights]! > 0,
        civilisation: state[STATE.civil]!,
      });
    } else {
      fragments++;
      out.push({
        id: `fragment-${i}`,
        name: `Fragment ${fragments}`,
        kind: 'fragment',
        position,
        velocity,
        mass,
        radius: 1 / ENGINE_PX_PER_AU,
        trueRadius: 1 / ENGINE_PX_PER_AU,
        temperature: 3000,
        luminosity: 0.01 * Math.max(0, 1 - extra / 40),
        star: -1,
        colourClass: 1,
      });
    }
  }
  return out;
}
