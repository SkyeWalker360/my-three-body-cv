import type { DeckBody } from './bodies';
import { add, cross, normalize, scale, sub, type Vec3 } from './camera';
import { lagrangePoints } from './instruments';
import { schwarzschildAu } from './units';

/**
 * Where the platform can watch from (brief §2.1), curated per preset. Each vantage gives a
 * station to hold (or ride with) and the view's resting frame, which can follow the system
 * (the Lagrange view co-rotates, so the bodies look nearly fixed).
 */

export type VantageId = 'above' | 'barycentre' | 'lagrange' | 'planet' | 'blackhole' | 'free';

export type Frame = { forward: Vec3; up: Vec3 };

export type Vantage = {
  id: VantageId;
  name: string;
  /** Button label. */
  short: string;
  /** Station to hold, or null to stay where it is. */
  station: (bodies: readonly DeckBody[]) => Vec3 | null;
  forward: Vec3;
  up: Vec3;
  /** A resting frame that follows the system, recomputed every frame. */
  frame?: (bodies: readonly DeckBody[], at: Vec3) => Frame | null;
  /**
   * Rides along with a body instead of holding a station under thrust: no capped drive could
   * hover 12 r_s from a black hole or keep pace with the planet, so the platform is carried
   * along and its own orbit is ignored.
   */
  rides?: boolean;
  /** Only offered while this returns true (bodies, preset index). */
  available?: (bodies: readonly DeckBody[], preset: number) => boolean;
};

/** Height above the plane for the default view: the ±1.9 AU escape circle fits a 100° window. */
export const ABOVE_HEIGHT = 2.6;
/** How far from the hole the platform rides, in Schwarzschild radii: outside the photon sphere (1.5). */
export const HOLE_DISTANCE_RS = 12;
/** Height above L4 for the Lagrange view. */
export const LAGRANGE_HEIGHT = 0.5;
/** Presets with a natural Lagrange view: the equilateral triangle and the close pair. */
export const LAGRANGE_PRESETS = [1, 5];
/** Planet view: this many drawn planet radii off to the side. */
export const PLANET_OFFSET = 3.5;

const HOLE_OFFSET = normalize([0, -1, 0.25]);

export const hole = (bodies: readonly DeckBody[]) =>
  bodies.find((b) => b.kind === 'star' && b.phase === 'Black hole');
export const planet = (bodies: readonly DeckBody[]) => bodies.find((b) => b.kind === 'planet');

export function barycentre(bodies: readonly DeckBody[]): Vec3 {
  let m = 0;
  const c: Vec3 = [0, 0, 0];
  for (const b of bodies) {
    if (b.kind !== 'star') continue;
    m += b.mass;
    c[0] += b.position[0] * b.mass;
    c[1] += b.position[1] * b.mass;
  }
  return m > 0 ? [c[0] / m, c[1] / m, 0] : c;
}

/** The two heaviest stars (stable order for equal masses). */
function heaviestPair(bodies: readonly DeckBody[]): [DeckBody, DeckBody] | null {
  const stars = bodies
    .filter((b) => b.kind === 'star')
    .sort((a, b) => b.mass - a.mass || a.star - b.star);
  return stars.length >= 2 ? [stars[0]!, stars[1]!] : null;
}

/** The star lighting the planet most: its sun, for the planet view. */
function host(bodies: readonly DeckBody[], p: DeckBody): DeckBody | undefined {
  let best: DeckBody | undefined;
  let bestF = 0;
  for (const b of bodies) {
    if (b.kind !== 'star' || b.luminosity <= 0) continue;
    const d = sub(b.position, p.position);
    const f = b.luminosity / (d[0] * d[0] + d[1] * d[1] + 1e-9);
    if (f > bestF) {
      bestF = f;
      best = b;
    }
  }
  return best;
}

function planetStation(bodies: readonly DeckBody[]): Vec3 | null {
  const p = planet(bodies);
  const h = p && host(bodies, p);
  if (!p || !h) return null;
  const toHost = normalize(sub(h.position, p.position));
  const side = normalize(cross(toHost, [0, 0, 1]));
  return add(p.position, scale(add(side, [0, 0, 0.3]), PLANET_OFFSET * p.radius));
}

export const VANTAGES: Record<VantageId, Vantage> = {
  above: {
    id: 'above',
    name: 'Above the orbital plane',
    short: 'ABOVE',
    station: (bodies) => {
      const c = barycentre(bodies);
      return [c[0], c[1], ABOVE_HEIGHT];
    },
    forward: [0, 0, -1],
    up: [0, 1, 0],
  },
  barycentre: {
    id: 'barycentre',
    name: 'Barycentre',
    short: 'CENTRE',
    station: (bodies) => {
      const c = barycentre(bodies);
      return [c[0], c[1], 0.35];
    },
    forward: [1, 0, -0.3],
    up: [0, 0, 1],
  },
  lagrange: {
    id: 'lagrange',
    name: 'Lagrange point L4',
    short: 'L4',
    station: (bodies) => {
      const pair = heaviestPair(bodies);
      if (!pair) return null;
      const l4 = lagrangePoints(pair[0], pair[1])[3]!;
      return [l4[0], l4[1], LAGRANGE_HEIGHT];
    },
    forward: [1, 0, -0.3],
    up: [0, 0, 1],
    // Co-rotate with the pair: always look at their barycentre, so they hang nearly still.
    frame: (bodies, at) => {
      const pair = heaviestPair(bodies);
      if (!pair) return null;
      return { forward: sub(barycentre(pair), at), up: [0, 0, 1] };
    },
    available: (bodies, preset) =>
      LAGRANGE_PRESETS.includes(preset) && heaviestPair(bodies) !== null,
  },
  planet: {
    id: 'planet',
    name: 'Planet orbit',
    short: 'PLANET',
    station: planetStation,
    forward: [1, 0, 0],
    up: [0, 0, 1],
    // Look past the planet toward its sun: sunrises, phases and eclipses.
    frame: (bodies, at) => {
      const p = planet(bodies);
      const h = p && host(bodies, p);
      if (!p || !h) return null;
      const towardSun = normalize(sub(h.position, at));
      const towardPlanet = normalize(sub(p.position, at));
      return { forward: add(scale(towardSun, 0.6), scale(towardPlanet, 0.4)), up: [0, 0, 1] };
    },
    rides: true,
    available: (bodies) => planetStation(bodies) !== null,
  },
  blackhole: {
    id: 'blackhole',
    name: 'Near the black hole',
    short: 'HOLE',
    station: (bodies) => {
      const h = hole(bodies);
      if (!h) return null;
      return add(h.position, scale(HOLE_OFFSET, HOLE_DISTANCE_RS * schwarzschildAu(h.mass)));
    },
    forward: scale(HOLE_OFFSET, -1),
    up: [0, 0, 1],
    rides: true,
    available: (bodies) => hole(bodies) !== undefined,
  },
  free: {
    id: 'free',
    name: 'Free look',
    short: 'FREE',
    station: () => null,
    forward: [0, 0, -1],
    up: [0, 1, 0],
  },
};

/** The calm default (Luke, 28 Oct): the whole system seen from above. */
export const DEFAULT_VANTAGE: VantageId = 'above';

/** Finds a vantage by a typed name (K.A.R.L.'s /vantage): id, short label or a word of its name. */
export function findVantage(query: string): VantageId | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const v of Object.values(VANTAGES)) {
    if (v.id === q || v.short.toLowerCase() === q) return v.id;
  }
  for (const v of Object.values(VANTAGES)) {
    if (v.name.toLowerCase().includes(q)) return v.id;
  }
  return null;
}
