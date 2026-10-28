import type { DeckBody } from './bodies';
import type { Vec3 } from './camera';

/**
 * Where the platform can watch from (brief §2.1). Each vantage gives a station to hold and
 * the resting direction of the view. Phase 1 has the calm default, the barycentre and free
 * look; Lagrange points, the planet's orbit and the black hole follow in Phase 4.
 */

export type VantageId = 'above' | 'barycentre' | 'free';

export type Vantage = {
  id: VantageId;
  name: string;
  /** Button label. */
  short: string;
  /** Station to hold, or null to drift freely. */
  station: (bodies: readonly DeckBody[]) => Vec3 | null;
  forward: Vec3;
  up: Vec3;
};

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
