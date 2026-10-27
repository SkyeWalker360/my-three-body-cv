import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/features/three-body/presets';
import {
  createState,
  divergence,
  cloneState,
  energies,
  kick,
  maxRadius,
  momentum,
  step,
  toBarycentric,
} from '@/features/three-body/solver';
import { bufferSize } from '@/features/three-body/buffer';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('velocity Verlet solver', () => {
  it('keeps the figure-8 energy drift under 1e-5 and momentum under 1e-9 over 100,000 steps', () => {
    const s = createState(PRESETS[0]!);
    const e0 = energies(s).total;
    for (let i = 0; i < 100_000; i++) step(s);
    const drift = Math.abs((energies(s).total - e0) / e0);
    expect(drift).toBeLessThan(1e-5);
    expect(Math.hypot(...momentum(s))).toBeLessThan(1e-9);
  });

  it.each(PRESETS.map((p) => [p.name, p] as const))(
    '%s loads with zero net momentum',
    (_name, preset) => {
      const s = createState(preset);
      expect(Math.hypot(...momentum(s))).toBeLessThan(1e-12);
    },
  );

  it('toBarycentric removes centre-of-mass position and velocity', () => {
    const s = createState(PRESETS[4]!);
    s.x[0] = s.x[0]! + 5;
    s.v[1] = s.v[1]! + 3;
    toBarycentric(s);
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < s.n; i++) {
      cx += s.m[i]! * s.x[2 * i]!;
      cy += s.m[i]! * s.x[2 * i + 1]!;
    }
    expect(Math.hypot(cx, cy)).toBeLessThan(1e-12);
    expect(Math.hypot(...momentum(s))).toBeLessThan(1e-12);
  });

  it('kick re-centres so momentum stays zero', () => {
    const s = createState(PRESETS[0]!);
    kick(s, 0.075, seeded(7));
    expect(Math.hypot(...momentum(s))).toBeLessThan(1e-12);
  });

  it('reproduces the published unequal-mass orbit (returns after one period T)', () => {
    const preset = PRESETS.find((p) => p.short === 'UNEQUAL')!;
    const s = createState(preset);
    const start = cloneState(s);
    const e0 = energies(s).total;
    const T = 5.9889127121; // arXiv:2007.10184, Table 1
    for (let i = 0, n = Math.round(T / s.dt); i < n; i++) step(s);
    expect(divergence(s, start)).toBeLessThan(0.01);
    expect(Math.abs((energies(s).total - e0) / e0)).toBeLessThan(1e-6);
  });

  it('keeps the Lagrange triangle on its circle', () => {
    const s = createState(PRESETS[1]!);
    for (let i = 0; i < 20_000; i++) step(s);
    expect(maxRadius(s)).toBeGreaterThan(0.99);
    expect(maxRadius(s)).toBeLessThan(1.01);
  });

  it('shows sensitive dependence: a 1e-7 shadow diverges in the chaotic preset', () => {
    const a = createState(PRESETS[4]!);
    const b = cloneState(a);
    b.x[0] = b.x[0]! + 1e-7;
    for (let i = 0; i < 20_000; i++) {
      step(a);
      step(b);
    }
    expect(divergence(a, b)).toBeGreaterThan(1e-5);
  });
});

describe('bufferSize', () => {
  it('upscales by an integer factor to roughly 480 wide', () => {
    expect(bufferSize(1920, 1080)).toEqual({ width: 480, height: 270, scale: 4 });
    const phone = bufferSize(390, 844);
    expect(phone.scale).toBe(1);
    const odd = bufferSize(1366, 768);
    expect(Number.isInteger(odd.scale)).toBe(true);
    expect(odd.width * odd.scale).toBeGreaterThanOrEqual(1366);
  });
});
