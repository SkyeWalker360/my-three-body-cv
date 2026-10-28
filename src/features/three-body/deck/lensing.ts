import { add, cross, dot, length, normalize, scale, type Vec3 } from './camera';

/**
 * Gravitational lensing and redshift around a Schwarzschild black hole (brief §3). Distances
 * here are in units of the Schwarzschild radius r_s.
 *
 * - A ray with impact parameter b below b_c = (3√3 / 2) r_s is captured: that's the shadow.
 * - Otherwise it's bent by α(b): the weak-field series 2/b + (15π/16)/b², and near the photon
 *   sphere the strong-field limit −ln(b/b_c − 1) − 0.4002 (Bozza 2002), whichever is larger.
 * - Light falling from infinity to radius r is blueshifted by 1/√(1 − r_s/r).
 */

export const B_CRIT = 1.5 * Math.sqrt(3);

export function deflection(b: number): number {
  if (b <= B_CRIT) return Infinity;
  const weak = 2 / b + (15 * Math.PI) / 16 / (b * b);
  if (b > 3 * B_CRIT) return weak;
  const strong = -Math.log(b / B_CRIT - 1) - 0.4002;
  return Math.max(weak, strong);
}

/** Impact parameter of a ray seen at angle ψ from the hole by an observer at radius r. */
export const impactParameter = (r: number, psi: number) =>
  (r * Math.sin(psi)) / Math.sqrt(1 - 1 / r);

/** Angular radius of the shadow seen from radius r: sin ψ = (b_c / r) √(1 − 1/r). */
export const shadowRadius = (r: number) =>
  Math.asin(Math.min(1, (B_CRIT / r) * Math.sqrt(1 - 1 / r)));

/** Frequency gain for light falling from infinity to radius r (> 1: bluer). */
export const blueshift = (r: number) => 1 / Math.sqrt(1 - 1 / r);

/** Rotates `v` about unit axis `k` by `angle`. */
function rotate(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/**
 * Where on the background sky a view ray actually comes from. `view` is the unit view
 * direction, `toHole` the unit direction to the hole, `r` the observer's radius in r_s.
 * Returns null for rays that end in the hole.
 */
export function lensedDirection(view: Vec3, toHole: Vec3, r: number): Vec3 | null {
  const cosPsi = Math.max(-1, Math.min(1, dot(view, toHole)));
  const psi = Math.acos(cosPsi);
  // Rays aimed away from the hole (ψ > 90°) only pass it if the observer is inside b_c.
  const b = impactParameter(r, psi);
  if (psi < Math.PI / 2 && b <= B_CRIT) return null;
  const alpha = deflection(Math.max(b, B_CRIT * (1 + 1e-6)));
  if (!Number.isFinite(alpha) || alpha <= 0) return view;
  const axis = cross(view, toHole);
  if (length(axis) < 1e-12) return view;
  // The source lies further round toward (and past) the hole than the image.
  return normalize(rotate(view, normalize(axis), alpha));
}
