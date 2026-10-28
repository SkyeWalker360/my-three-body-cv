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

/** A body to keep clear of: the platform never enters a star, its envelope or the hole's zone. */
export type Obstacle = { position: Vec3; radius: number };
/** Keep-out distance: this many times a body's (drawn) radius, plus a margin. */
export const KEEP_OUT = 3;
export const KEEP_OUT_MARGIN = 0.05;

/** Repulsion that grows as the platform pushes into an obstacle's keep-out zone. */
export function avoidance(at: Vec3, obstacles: readonly Obstacle[], maxThrust: number): Vec3 {
  let a: Vec3 = [0, 0, 0];
  for (const o of obstacles) {
    const d = sub(at, o.position);
    const r = length(d);
    const safe = o.radius * KEEP_OUT + KEEP_OUT_MARGIN;
    if (r >= safe || r === 0) continue;
    a = add(a, scale(d, (((safe - r) / safe) * (maxThrust * 2)) / r));
  }
  return a;
}

/**
 * Thrust that cancels gravity and steers toward `target` (a critically damped spring), plus
 * obstacle avoidance, capped at `maxThrust`.
 */
export function stationKeeping(
  p: Platform,
  target: Vec3,
  g: Vec3,
  targetVelocity: Vec3,
  maxThrust = MAX_THRUST,
  obstacles: readonly Obstacle[] = [],
): Vec3 {
  const steer = add(
    scale(sub(target, p.position), STIFFNESS),
    scale(sub(targetVelocity, p.velocity), DAMPING),
  );
  const avoid = avoidance(p.position, obstacles, MAX_THRUST);
  // A gentle trip drive stays gentle in open space, so the path arcs under gravity, but
  // strengthens with the local pull so it can't be captured; inside a keep-out zone it goes
  // to full power.
  const cap =
    length(avoid) > 0
      ? Math.max(maxThrust, MAX_THRUST)
      : Math.min(Math.max(maxThrust, MAX_THRUST), maxThrust + 1.5 * length(g));
  const want = add(sub(steer, g), avoid);
  const n = length(want);
  return n > cap ? scale(want, cap / n) : want;
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
  maxThrust = MAX_THRUST,
  obstacles: readonly Obstacle[] = [],
): Platform {
  const steps = Math.max(1, Math.ceil(Math.abs(dt) / MAX_SUBSTEP));
  const h = dt / steps;
  let { position, velocity } = p;
  const accel = (at: Vec3, v: Vec3) => {
    const g = gravity(at, masses);
    return target
      ? add(
          g,
          stationKeeping(
            { position: at, velocity: v },
            target,
            g,
            targetVelocity,
            maxThrust,
            obstacles,
          ),
        )
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
