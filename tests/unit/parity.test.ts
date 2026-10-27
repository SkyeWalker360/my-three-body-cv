import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/features/three-body/presets';
import { createState, step } from '@/features/three-body/solver';

// Written by the Go engine (engine/cmd/parity); a Go test keeps it up to date with the engine.
const fixture = JSON.parse(readFileSync('tests/fixtures/parity.json', 'utf8')) as {
  time: number;
  presets: { name: string; x: number[]; v: number[] }[];
};

// Velocity Verlet here and Yoshida-4 in Go have different truncation errors, so they agree to a
// tolerance rather than bit for bit.
const TOLERANCE = 1e-4;

describe('Go and TypeScript solvers', () => {
  it('cover the same presets in the same order', () => {
    expect(fixture.presets.map((p) => p.name)).toEqual(PRESETS.map((p) => p.name));
  });

  for (const expected of fixture.presets) {
    it(`agree on ${expected.name} after t = ${fixture.time}`, () => {
      const preset = PRESETS.find((p) => p.name === expected.name)!;
      const s = createState(preset);
      const steps = Math.round(fixture.time / s.dt);
      for (let i = 0; i < steps; i++) step(s);
      for (let k = 0; k < 6; k++) {
        expect(Math.abs(s.x[k]! - expected.x[k]!)).toBeLessThan(TOLERANCE);
        expect(Math.abs(s.v[k]! - expected.v[k]!)).toBeLessThan(TOLERANCE * 10);
      }
    });
  }
});
