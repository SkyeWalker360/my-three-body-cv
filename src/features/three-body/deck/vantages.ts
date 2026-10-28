import type { DeckBody } from './bodies';
import { add, normalize, scale, type Vec3 } from './camera';
import { schwarzschildAu } from './units';

/**
 * Where the platform can watch from (brief §2.1). Each vantage gives a station to hold and
 * the resting direction of the view. Phase 1 has the calm default, the barycentre and free
 * look; Lagrange points, the planet's orbit and the black hole follow in Phase 4.
 */

export type VantageId = 'above' | 'barycentre' | 'blackhole' | 'free';

export type Vantage = {
  id: VantageId;
  name: string;
  /** Button label. */
  short: string;
  /** Station to hold, or null to drift freely. */
  station: (bodies: readonly DeckBody[]) => Vec3 | null;
  forward: Vec3;
  up: Vec3;
  /**
   * Rides along with a body instead of holding a station under thrust (the black hole: no
   * capped drive could hover 12 r_s from it, so the platform is carried with it and its tiny
   * orbit is ignored).
   */
  rides?: boolean;
  /** Only offered while this returns true. */
  available?: (bodies: readonly DeckBody[]) => boolean;
};

/** The black hole, if a star has collapsed into one. */
export const hole = (bodies: readonly DeckBody[]) =>
  bodies.find((b) => b.kind === 'star' && b.phase === 'Black hole');

/** How far from the hole the platform rides, in Schwarzschild radii: outside the photon sphere (1.5). */
export const HOLE_DISTANCE_RS = 12;
const HOLE_OFFSET = normalize([0, -1, 0.25]);

/** Height above the plane for the default view: the ±1.9 AU escape circle fits a 100° window. */
export const ABOVE_HEIGHT = 2.6;

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
