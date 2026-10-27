/**
 * Planar N-body gravity with Plummer softening, integrated by velocity Verlet
 * (kick-drift-kick). Pure: no DOM, no globals, so it can be unit-tested and run in a worker.
 */
import type { Preset } from './presets';

export const G = 1;
export const SOFTENING = 1e-3;
export const DT = 5e-4;

export type BodyState = {
  n: number;
  m: Float64Array;
  /** Interleaved x, y per body. */
  x: Float64Array;
  v: Float64Array;
  /** Acceleration at the current positions, kept in sync by `step`. */
  a: Float64Array;
  /** Squared Plummer softening and time step, per preset. */
  eps2: number;
  dt: number;
};

export function createState(preset: Preset): BodyState {
  const n = preset.masses.length;
  const s: BodyState = {
    n,
    m: Float64Array.from(preset.masses),
    x: Float64Array.from(preset.positions),
    v: Float64Array.from(preset.velocities),
    a: new Float64Array(2 * n),
    eps2: (preset.softening ?? SOFTENING) ** 2,
    dt: preset.dt ?? DT,
  };
  toBarycentric(s);
  computeAccelerations(s);
  return s;
}

export function cloneState(s: BodyState): BodyState {
  return { ...s, m: s.m.slice(), x: s.x.slice(), v: s.v.slice(), a: s.a.slice() };
}

export function computeAccelerations(s: BodyState): void {
  const { n, m, x, a, eps2 } = s;
  a.fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[2 * j]! - x[2 * i]!;
      const dy = x[2 * j + 1]! - x[2 * i + 1]!;
      const d2 = dx * dx + dy * dy + eps2;
      const inv = G / (d2 * Math.sqrt(d2));
      a[2 * i] = a[2 * i]! + m[j]! * dx * inv;
      a[2 * i + 1] = a[2 * i + 1]! + m[j]! * dy * inv;
      a[2 * j] = a[2 * j]! - m[i]! * dx * inv;
      a[2 * j + 1] = a[2 * j + 1]! - m[i]! * dy * inv;
    }
  }
}

/** One velocity Verlet step: half kick, drift, recompute forces, half kick. */
export function step(s: BodyState, dt: number = s.dt): void {
  const { x, v, a } = s;
  const len = x.length;
  for (let k = 0; k < len; k++) {
    v[k] = v[k]! + 0.5 * a[k]! * dt;
    x[k] = x[k]! + v[k]! * dt;
  }
  computeAccelerations(s);
  for (let k = 0; k < len; k++) v[k] = v[k]! + 0.5 * a[k]! * dt;
}

export function energies(s: BodyState): { kinetic: number; potential: number; total: number } {
  const { n, m, x, v } = s;
  let kinetic = 0;
  let potential = 0;
  for (let i = 0; i < n; i++) {
    kinetic += 0.5 * m[i]! * (v[2 * i]! ** 2 + v[2 * i + 1]! ** 2);
    for (let j = i + 1; j < n; j++) {
      const dx = x[2 * j]! - x[2 * i]!;
      const dy = x[2 * j + 1]! - x[2 * i + 1]!;
      potential -= (G * m[i]! * m[j]!) / Math.sqrt(dx * dx + dy * dy + s.eps2);
    }
  }
  return { kinetic, potential, total: kinetic + potential };
}

export function momentum(s: BodyState): [number, number] {
  let px = 0;
  let py = 0;
  for (let i = 0; i < s.n; i++) {
    px += s.m[i]! * s.v[2 * i]!;
    py += s.m[i]! * s.v[2 * i + 1]!;
  }
  return [px, py];
}

/** Subtract the centre-of-mass position and velocity, giving zero net momentum. */
export function toBarycentric(s: BodyState): void {
  const { n, m, x, v } = s;
  let mass = 0;
  let rx = 0;
  let ry = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    mass += m[i]!;
    rx += m[i]! * x[2 * i]!;
    ry += m[i]! * x[2 * i + 1]!;
    vx += m[i]! * v[2 * i]!;
    vy += m[i]! * v[2 * i + 1]!;
  }
  rx /= mass;
  ry /= mass;
  vx /= mass;
  vy /= mass;
  for (let i = 0; i < n; i++) {
    x[2 * i] = x[2 * i]! - rx;
    x[2 * i + 1] = x[2 * i + 1]! - ry;
    v[2 * i] = v[2 * i]! - vx;
    v[2 * i + 1] = v[2 * i + 1]! - vy;
  }
}

/** Add a random Δv in [-amount, amount] per axis to every body, then re-centre. */
export function kick(s: BodyState, amount: number, rand: () => number = Math.random): void {
  for (let k = 0; k < s.v.length; k++) s.v[k] = s.v[k]! + (rand() * 2 - 1) * amount;
  toBarycentric(s);
  computeAccelerations(s);
}

/** Phase-space distance between two states with the same bodies. */
export function divergence(a: BodyState, b: BodyState): number {
  let sum = 0;
  for (let k = 0; k < a.x.length; k++) {
    sum += (a.x[k]! - b.x[k]!) ** 2 + (a.v[k]! - b.v[k]!) ** 2;
  }
  return Math.sqrt(sum);
}

/** Largest distance of any body from the origin (the barycentre after `toBarycentric`). */
export function maxRadius(s: BodyState): number {
  let r = 0;
  for (let i = 0; i < s.n; i++) r = Math.max(r, Math.hypot(s.x[2 * i]!, s.x[2 * i + 1]!));
  return r;
}
