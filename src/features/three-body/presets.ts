export type Preset = {
  name: string;
  /** Short label for the header button. */
  short: string;
  masses: [number, number, number];
  /** x1, y1, x2, y2, x3, y3 */
  positions: [number, number, number, number, number, number];
  velocities: [number, number, number, number, number, number];
  source: string;
  /** Reload with a fresh perturbation when a body escapes, instead of recentring. */
  chaotic?: boolean;
  /** Overrides for orbits with close passes that the default step can't resolve. */
  dt?: number;
  softening?: number;
};

// Li, Li and Liao (2021), arXiv:2007.10184, Table 1: m1 = 0.87, m2 = 0.8, m3 = 1, period
// T = 5.9889127121. Its close pass needs a fine unsoftened step; at dt = 5e-4 it breaks up.
const UNEQUAL = { m1: 0.87, m2: 0.8, x1: -0.1855174644, v1: 2.022154688, v2: 0.3968976468 };

const F8_R = [0.97000436, -0.24308753] as const;
const F8_V = [0.466203685, 0.43236573] as const;

// Lagrange: equilateral triangle of radius 1; for equal unit masses the tangential speed
// that balances gravity is sqrt(1 / sqrt(3)).
const LAGRANGE_V = Math.sqrt(1 / Math.sqrt(3));
const lagrange = [0, 1, 2].map((k) => {
  const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
  return {
    p: [Math.cos(a), Math.sin(a)],
    v: [-Math.sin(a) * LAGRANGE_V, Math.cos(a) * LAGRANGE_V],
  };
});

// Close pair: a tight binary (1 and 0.8, separation 0.3) with a 0.5 star on a circular orbit
// at 1.4. The outer relative speed sqrt(M/d) is split between the pair and the star so the net
// momentum is zero. engine/physics/presets.go uses the same numbers.
const PAIR = { m1: 1, m2: 0.8, m3: 0.5, a: 0.3, d: 1.4 };
const pairInner = PAIR.m1 + PAIR.m2;
const pairTotal = pairInner + PAIR.m3;
const pairVrel = Math.sqrt(pairInner / PAIR.a);
const pairVout = Math.sqrt(pairTotal / PAIR.d);
const pairV3 = (pairVout * pairInner) / pairTotal;
const pairVin = (-pairVout * PAIR.m3) / pairTotal;

export const PRESETS: Preset[] = [
  {
    name: 'Figure-8',
    short: 'FIG-8',
    masses: [1, 1, 1],
    positions: [F8_R[0], F8_R[1], -F8_R[0], -F8_R[1], 0, 0],
    velocities: [F8_V[0], F8_V[1], F8_V[0], F8_V[1], -2 * F8_V[0], -2 * F8_V[1]],
    source: 'Chenciner and Montgomery (2000)',
  },
  {
    name: 'Lagrange triangle',
    short: 'LAGRANGE',
    masses: [1, 1, 1],
    positions: lagrange.flatMap((b) => b.p) as Preset['positions'],
    velocities: lagrange.flatMap((b) => b.v) as Preset['velocities'],
    source: 'Analytic',
  },
  {
    name: 'Moth-I',
    short: 'MOTH-I',
    masses: [1, 1, 1],
    positions: [-1, 0, 1, 0, 0, 0],
    velocities: [0.464445, 0.39606, 0.464445, 0.39606, -0.92889, -0.79212],
    source: 'Šuvakov and Dmitrašinović (2013)',
  },
  {
    name: 'Unequal-mass periodic',
    short: 'UNEQUAL',
    masses: [UNEQUAL.m1, UNEQUAL.m2, 1],
    positions: [UNEQUAL.x1, 0, 1, 0, 0, 0],
    velocities: [
      0,
      UNEQUAL.v1,
      0,
      UNEQUAL.v2,
      0,
      -(UNEQUAL.m1 * UNEQUAL.v1 + UNEQUAL.m2 * UNEQUAL.v2),
    ],
    source: 'Li, Li and Liao (2021), arXiv:2007.10184',
    dt: 1e-5,
    softening: 0,
  },
  {
    name: 'Trisolaran chaos',
    short: 'TRISOLARAN',
    masses: [1.2, 1.0, 0.8],
    positions: [-0.8, -0.2, 0.8, 0.1, 0.0, 0.7],
    velocities: [0.1, 0.6, -0.3, -0.4, 0.2, -0.2],
    source: 'Prototype values, designed for chaos',
    chaotic: true,
  },
  {
    name: 'Close pair',
    short: 'PAIR',
    masses: [PAIR.m1, PAIR.m2, PAIR.m3],
    positions: [(-PAIR.a * PAIR.m2) / pairInner, 0, (PAIR.a * PAIR.m1) / pairInner, 0, PAIR.d, 0],
    velocities: [
      0,
      (-pairVrel * PAIR.m2) / pairInner + pairVin,
      0,
      (pairVrel * PAIR.m1) / pairInner + pairVin,
      0,
      pairV3,
    ],
    source: 'Hierarchical triple: a close binary and a distant third star',
  },
];
