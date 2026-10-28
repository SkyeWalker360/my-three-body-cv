import type { DeckBody } from './bodies';
import { angularRadius, dot, length, normalize, sub, type Vec3 } from './camera';

/**
 * Eclipses and transits (brief §3): how much of a star's disc an observer can see past the
 * bodies in front of it. Angular discs, using the drawn (compact-scale) radii so the light
 * agrees with what's on screen.
 */

/** Area of the intersection of two circles of radii r1 and r2 whose centres are d apart. */
export function discOverlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return a + b - c;
}

/** Fraction (0–1) of `target`'s disc visible from `observer`, past every nearer body. */
export function visibleFraction(
  observer: Vec3,
  target: DeckBody,
  bodies: readonly DeckBody[],
  skip?: DeckBody,
): number {
  const toTarget = sub(target.position, observer);
  const dt = length(toTarget);
  if (dt <= target.radius) return 1;
  const ut = normalize(toTarget);
  const theta = angularRadius(target.radius, dt);
  const area = Math.PI * theta * theta;
  let hidden = 0;
  for (const b of bodies) {
    if (b === target || b === skip || b.kind === 'fragment') continue;
    const to = sub(b.position, observer);
    const d = length(to);
    if (d >= dt || d <= b.radius) continue;
    const gamma = Math.acos(Math.max(-1, Math.min(1, dot(normalize(to), ut))));
    hidden += discOverlap(theta, angularRadius(b.radius, d), gamma);
  }
  return Math.max(0, 1 - hidden / area);
}
