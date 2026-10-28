import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DeckBody } from '@/features/three-body/deck/bodies';
import {
  bodyCard,
  contour,
  effectivePotential,
  lagrangeJacobi,
  lagrangePoints,
  spectrum,
  SPECTRUM_MAX_NM,
  SPECTRUM_MIN_NM,
} from '@/features/three-body/deck/instruments';
import { TRAIL_LENGTH, Trails } from '@/features/three-body/deck/overlays';
import { DeckSession } from '@/features/three-body/deck/session';
import { instantiateEngine } from '@/features/three-body/engine';
import { parseInput } from '@/features/karl/intents';

const WASM = 'public/engine.wasm';

const star = (over: Partial<DeckBody> = {}): DeckBody => ({
  id: 'star-1',
  name: 'Star 2',
  kind: 'star',
  position: [1, 0, 0],
  velocity: [0, 0, 0],
  mass: 1,
  radius: 0.074,
  trueRadius: 6.957e8 / 1.495978707e11,
  temperature: 5800,
  luminosity: 1,
  star: 1,
  starKind: 'Yellow dwarf',
  phase: 'Main sequence',
  colourClass: 2,
  ...over,
});

describe('body card', () => {
  it('shows the physical facts in SI-friendly units', () => {
    const rows = Object.fromEntries(bodyCard(star(), 1).map((r) => [r.label, r.value]));
    expect(rows.Type).toBe('Yellow dwarf, main sequence');
    expect(rows.Radius).toContain('1.00 R☉');
    expect(rows.Temperature).toBe('5800 K');
    expect(rows['Light time']).toBe('8.3 min');
    expect(rows['Drawn at']).toMatch(/×.* true size/);
  });

  it('gives planets their era and civilisation', () => {
    const rows = Object.fromEntries(
      bodyCard(
        star({
          kind: 'planet',
          starKind: undefined,
          phase: undefined,
          temperature: 0,
          luminosity: 0,
          era: 'Frozen',
          lights: true,
        }),
        0.5,
      ).map((r) => [r.label, r.value]),
    );
    expect(rows.Type).toBe('Planet');
    expect(rows['Climate era']).toBe('Frozen');
    expect(rows.Civilisation).toContain('city lights');
    expect(rows.Temperature).toBeUndefined();
  });
});

describe('spectrograph', () => {
  it('peaks at the Wien wavelength', () => {
    const columns = 240;
    const { bars, peakNm } = spectrum(5800, columns);
    expect(peakNm).toBeCloseTo(500, -1);
    const peakCol = bars.indexOf(1);
    const nm = SPECTRUM_MIN_NM + ((peakCol + 0.5) / columns) * (SPECTRUM_MAX_NM - SPECTRUM_MIN_NM);
    expect(Math.abs(nm - peakNm)).toBeLessThan(15);
  });

  it('shifts blue for hotter stars', () => {
    expect(spectrum(16000, 10).peakNm).toBeLessThan(spectrum(2600, 10).peakNm);
  });
});

describe('Lagrange points and Jacobi curves', () => {
  it('puts the Sun–Earth L1 and L2 about 0.01 AU from Earth', () => {
    const sun = { position: [0, 0, 0] as [number, number, number], mass: 1 };
    const earth = { position: [1, 0, 0] as [number, number, number], mass: 3.003e-6 };
    const [l1, l2, l3, l4, l5] = lagrangePoints(sun, earth);
    expect(1 - l1![0]).toBeCloseTo(0.01, 3);
    expect(l2![0] - 1).toBeCloseTo(0.01, 3);
    expect(l3![0]).toBeCloseTo(-1, 3);
    expect(l4![0]).toBeCloseTo(0.5, 3);
    expect(l4![1]).toBeCloseTo(Math.sqrt(3) / 2, 3);
    expect(l5![1]).toBeCloseTo(-Math.sqrt(3) / 2, 3);
  });

  it('balances forces at L1 for equal masses (the midpoint)', () => {
    const [l1] = lagrangePoints(
      { position: [-0.5, 0, 0], mass: 1 },
      { position: [0.5, 0, 0], mass: 1 },
    );
    expect(l1![0]).toBeCloseTo(0, 6);
  });

  it('orders the Jacobi constants C(L1) > C(L2) > C(L3)', () => {
    const [c1, c2, c3] = lagrangeJacobi(0.1);
    expect(c1).toBeGreaterThan(c2!);
    expect(c2).toBeGreaterThan(c3!);
    expect(effectivePotential(0, 0, 0.1)).toBeGreaterThan(0);
  });

  it('traces a circle with marching squares', () => {
    const n = 32;
    const grid = new Float64Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) grid[j * n + i] = Math.hypot(i - 15.5, j - 15.5);
    const segs = contour(grid, n, 10);
    expect(segs.length).toBeGreaterThan(40);
    for (const [x0, y0] of segs) expect(Math.hypot(x0 - 15.5, y0 - 15.5)).toBeCloseTo(10, 0);
  });
});

describe('trails', () => {
  it('keeps a bounded history per star and resets when time runs backwards', () => {
    const t = new Trails();
    for (let i = 0; i < TRAIL_LENGTH + 20; i++) t.record([star({ position: [i, 0, 0] })], i * 0.05);
    expect(t.points[1]).toHaveLength(TRAIL_LENGTH);
    t.record([star()], 0);
    expect(t.points[1]).toHaveLength(1);
  });
});

describe('K.A.R.L. /lab', () => {
  it('is a command', () => {
    expect(parseInput('/lab', {})).toEqual({ type: 'command', command: 'lab' });
  });
});

describe.skipIf(!existsSync(WASM))('deck session with the real engine', () => {
  it('picks the body under a pixel, tracks it, and reports events', async () => {
    const e = await instantiateEngine(readFileSync(WASM));
    const s = new DeckSession(e, 320, 180, 0, 318, true);
    s.frame(1 / 60, 1);
    const target = s.lastFrame!.onScreen.find((o) => o.body.kind === 'star')!;
    const picked = s.pick(target.x, target.y)!;
    expect(picked.id).toBe(target.body.id);
    s.focus(picked);
    for (let i = 0; i < 10; i++) s.frame(1 / 60, 1);
    const centred = s.lastFrame!.onScreen.find((o) => o.body.id === picked.id)!;
    expect(Math.hypot(centred.x - 160, centred.y - 90)).toBeLessThan(2);
    // Looking away stops tracking.
    s.look(0.2, 0);
    expect(s.tracking).toBeNull();
    // Ageing produces described events, critical first among them.
    s.age();
    const seen: string[] = [];
    for (let i = 0; i < 60 * 9; i++) {
      s.frame(1 / 60, 1);
      for (const ev of s.drainEvents()) seen.push(ev.kind);
    }
    expect(seen).toContain('giant');
    expect(seen).toContain('supernova');
    expect(seen).toContain('critical');
    // Telemetry keeps the old lab's readouts.
    expect(s.telemetry().drift).toBeLessThan(1e-3);
    // The lab view is the engine's own frame.
    const lab = s.labFrame();
    expect(lab.width * lab.height).toBe(lab.pixels.length);
  });
});
