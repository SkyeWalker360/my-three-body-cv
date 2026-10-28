import { add, length, scale, sub, type Vec3 } from './camera';

/**
 * The observation platform: a massless test particle (brief §2). It feels every body's
 * gravity but never pulls back, so the engine's energy telemetry stays exact. A capped
 * station-keeping thrust holds it at its vantage; if gravity beats the cap it drifts, as a
 * real vessel would. Units are the engine's (G = 1, AU, solar masses).
 */

export type Platform = { position: Vec3; velocity: Vec3 };
export type Mass = { position: Vec3; mass: number };

/** Plummer softening, matching the engine's default. */
export const SOFTENING = 1e-3;
/** Maximum thrust acceleration, in engine units (G·M☉/AU² ≈ 5.9 mm/s²). */
export const MAX_THRUST = 40;
const STIFFNESS = 30;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
/** Longest integration substep, in engine time units. */
export const MAX_SUBSTEP = 2e-3;

export function gravity(at: Vec3, masses: readonly Mass[]): Vec3 {
  let a: Vec3 = [0, 0, 0];
  for (const m of masses) {
    const d = sub(m.position, at);
    const r2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] + SOFTENING * SOFTENING;
    a = add(a, scale(d, m.mass / (r2 * Math.sqrt(r2))));
  }
  return a;
}

/**
 * Thrust that cancels gravity and steers toward `target` (a critically damped spring),
 * capped at MAX_THRUST.
 */
export function stationKeeping(p: Platform, target: Vec3, g: Vec3, targetVelocity: Vec3): Vec3 {
  const steer = add(
    scale(sub(target, p.position), STIFFNESS),
    scale(sub(targetVelocity, p.velocity), DAMPING),
  );
  const want = sub(steer, g);
  const n = length(want);
  return n > MAX_THRUST ? scale(want, MAX_THRUST / n) : want;
}

/**
 * Advances the platform by `dt` engine time units with kick-drift-kick leapfrog, holding it
 * at `target` when given (null lets it fall freely).
 */
export function stepPlatform(
  p: Platform,
  masses: readonly Mass[],
  dt: number,
  target: Vec3 | null,
  targetVelocity: Vec3 = [0, 0, 0],
): Platform {
  const steps = Math.max(1, Math.ceil(Math.abs(dt) / MAX_SUBSTEP));
  const h = dt / steps;
  let { position, velocity } = p;
  const accel = (at: Vec3, v: Vec3) => {
    const g = gravity(at, masses);
    return target
      ? add(g, stationKeeping({ position: at, velocity: v }, target, g, targetVelocity))
      : g;
  };
  for (let i = 0; i < steps; i++) {
    velocity = add(velocity, scale(accel(position, velocity), h / 2));
    position = add(position, scale(velocity, h));
    velocity = add(velocity, scale(accel(position, velocity), h / 2));
  }
  return { position, velocity };
}

/** Specific orbital energy (free fall only): v²/2 − Σ m / r. */
export function specificEnergy(p: Platform, masses: readonly Mass[]): number {
  let u = 0;
  for (const m of masses) {
    const r = Math.sqrt(
      (m.position[0] - p.position[0]) ** 2 +
        (m.position[1] - p.position[1]) ** 2 +
        (m.position[2] - p.position[2]) ** 2 +
        SOFTENING * SOFTENING,
    );
    u -= m.mass / r;
  }
  const v = length(p.velocity);
  return (v * v) / 2 + u;
}
