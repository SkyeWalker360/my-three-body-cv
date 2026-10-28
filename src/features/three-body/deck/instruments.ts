import type { DeckBody } from './bodies';
import { type Vec3 } from './camera';
import {
  AU,
  formatDuration,
  L_SUN,
  lightTravelSeconds,
  planck,
  R_SUN,
  sci,
  wienPeak,
} from './units';

/**
 * The console's instruments as pure functions (brief §4): body cards, the spectrograph, and
 * the overlay geometry (Lagrange points and Jacobi zero-velocity contours).
 */

export type CardRow = { label: string; value: string };

/** Body card rows, in SI-friendly units, for a body at `distance` AU from the platform. */
export function bodyCard(b: DeckBody, distance: number): CardRow[] {
  const rows: CardRow[] = [];
  const kind = b.starKind ?? (b.kind === 'planet' ? 'Planet' : 'Supernova fragment');
  rows.push({ label: 'Type', value: b.phase ? `${kind}, ${b.phase.toLowerCase()}` : kind });
  rows.push({ label: 'Mass', value: `${sci(b.mass, 2)} M☉ (dynamical)` });
  const rKm = (b.trueRadius * AU) / 1000;
  rows.push({
    label: 'Radius',
    value:
      b.trueRadius * AU >= 0.05 * R_SUN
        ? `${sci((b.trueRadius * AU) / R_SUN, 2)} R☉ (${sci(rKm, 2)} km)`
        : `${sci(rKm, 2)} km`,
  });
  if (b.temperature > 0)
    rows.push({ label: 'Temperature', value: `${Math.round(b.temperature)} K` });
  if (b.luminosity > 0)
    rows.push({
      label: 'Luminosity',
      value: `${sci(b.luminosity, 2)} L☉ (${sci(b.luminosity * L_SUN, 2)} W)`,
    });
  if (b.era) rows.push({ label: 'Climate era', value: b.era });
  if (b.kind === 'planet')
    rows.push({
      label: 'Civilisation',
      value: b.lights
        ? 'Electrical era: city lights'
        : `${Math.round(b.civilisation ?? 0)} s of stable climate`,
    });
  rows.push({ label: 'Distance', value: `${sci(distance, 3)} AU (${sci(distance * AU, 2)} m)` });
  rows.push({ label: 'Light time', value: formatDuration(lightTravelSeconds(distance)) });
  rows.push({
    label: 'Drawn at',
    value: `×${sci(b.radius / b.trueRadius, 2)} true size (compact scale)`,
  });
  return rows;
}

export const SPECTRUM_MIN_NM = 100;
export const SPECTRUM_MAX_NM = 2500;

/**
 * A blackbody spectrum as `columns` bar heights in [0, 1] (normalised to the peak over the
 * range), plus the Wien peak wavelength in nm.
 */
export function spectrum(temperature: number, columns: number): { bars: number[]; peakNm: number } {
  const bars: number[] = [];
  for (let i = 0; i < columns; i++) {
    const nm = SPECTRUM_MIN_NM + ((i + 0.5) / columns) * (SPECTRUM_MAX_NM - SPECTRUM_MIN_NM);
    bars.push(planck(nm * 1e-9, temperature));
  }
  const max = Math.max(...bars);
  return { bars: bars.map((v) => (max > 0 ? v / max : 0)), peakNm: wienPeak(temperature) * 1e9 };
}

/** Wavelength (nm) of spectrum column i. */
export const columnNm = (i: number, columns: number) =>
  SPECTRUM_MIN_NM + ((i + 0.5) / columns) * (SPECTRUM_MAX_NM - SPECTRUM_MIN_NM);

/**
 * The five Lagrange points of two masses (circular restricted three-body approximation, using
 * their instantaneous positions), in the orbital plane. L1–L3 solve the collinear quintic by
 * Newton's method; L4 and L5 sit at the equilateral points.
 */
export function lagrangePoints(
  a: { position: Vec3; mass: number },
  b: { position: Vec3; mass: number },
): Vec3[] {
  const [p1, p2] = a.mass >= b.mass ? [a, b] : [b, a];
  const M = p1.mass + p2.mass;
  const mu = p2.mass / M;
  const dx = p2.position[0] - p1.position[0];
  const dy = p2.position[1] - p1.position[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  // Barycentre, then positions along the axis in units of d (p1 at −μ, p2 at 1 − μ).
  const cx = (p1.position[0] * p1.mass + p2.position[0] * p2.mass) / M;
  const cy = (p1.position[1] * p1.mass + p2.position[1] * p2.mass) / M;
  const f = (x: number) =>
    x -
    ((1 - mu) * (x + mu)) / Math.abs(x + mu) ** 3 -
    (mu * (x - 1 + mu)) / Math.abs(x - 1 + mu) ** 3;
  const solve = (x0: number) => {
    let x = x0;
    for (let i = 0; i < 60; i++) {
      const h = 1e-7;
      const step = f(x) / ((f(x + h) - f(x - h)) / (2 * h));
      x -= step;
      if (Math.abs(step) < 1e-12) break;
    }
    return x;
  };
  const r = Math.cbrt(mu / 3);
  const xs = [solve(1 - mu - r), solve(1 - mu + r), solve(-1 - (5 / 12) * mu)];
  const at = (x: number, y: number): Vec3 => [
    cx + (x * ux - y * uy) * d,
    cy + (x * uy + y * ux) * d,
    0,
  ];
  const s = Math.sqrt(3) / 2;
  return [...xs.map((x) => at(x, 0)), at(0.5 - mu, s), at(0.5 - mu, -s)];
}

/**
 * Effective potential of the rotating two-body frame at (x, y), in units where the separation
 * and total mass are 1: Ω = ½(x² + y²) + (1 − μ)/r1 + μ/r2. Zero-velocity curves are contours
 * of 2Ω = C (the Jacobi constant).
 */
export function effectivePotential(x: number, y: number, mu: number): number {
  const r1 = Math.hypot(x + mu, y);
  const r2 = Math.hypot(x - 1 + mu, y);
  return 0.5 * (x * x + y * y) + (1 - mu) / Math.max(r1, 1e-3) + mu / Math.max(r2, 1e-3);
}

/** Jacobi constants of L1, L2 and L3: the classic zero-velocity curves that open at each. */
export function lagrangeJacobi(mu: number): number[] {
  const pts = lagrangePoints(
    { position: [-mu, 0, 0], mass: 1 - mu },
    { position: [1 - mu, 0, 0], mass: mu },
  );
  return pts.slice(0, 3).map((p) => 2 * effectivePotential(p[0], p[1], mu));
}

/**
 * Marching squares over a grid of f values: line segments (in grid coordinates) where f
 * crosses `level`.
 */
export function contour(
  grid: Float64Array,
  n: number,
  level: number,
): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const v = (i: number, j: number) => grid[j * n + i]!;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = v(i, j);
      const b = v(i + 1, j);
      const c = v(i + 1, j + 1);
      const d = v(i, j + 1);
      const pts: [number, number][] = [];
      if (a < level !== b < level) pts.push([i + lerp(a, b), j]);
      if (b < level !== c < level) pts.push([i + 1, j + lerp(b, c)]);
      if (d < level !== c < level) pts.push([i + lerp(d, c), j + 1]);
      if (a < level !== d < level) pts.push([i, j + lerp(a, d)]);
      if (pts.length >= 2) segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
      if (pts.length === 4) segs.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]]);
    }
  }
  return segs;
}
