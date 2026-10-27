import { describe, expect, it } from 'vitest';
import { Lab, SIM_SPEED, VISIBLE_RADIUS } from '@/features/three-body/lab';
import { PRESETS } from '@/features/three-body/presets';
import type { Palette } from '@/lib/palette';

// A 2D context that accepts every call and draws nothing.
const fakeCtx = () => {
  const canvas = { width: 480, height: 270 };
  return new Proxy({ canvas } as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : () => {}),
    set: (target, key, value) => {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

const palette = new Proxy({}, { get: () => '#000000' }) as Palette;

function lab(preset = 0): Lab {
  const l = new Lab(fakeCtx(), palette, false, () => {});
  l.handle({ type: 'pause' });
  l.handle({ type: 'preset', index: preset });
  return l;
}

describe('three-body lab clock', () => {
  it('runs at the same speed at 60 Hz and 120 Hz', () => {
    const at60 = lab();
    const at120 = lab();
    for (let f = 0; f < 60 * 5; f++) at60.advance(1 / 60);
    for (let f = 0; f < 120 * 5; f++) at120.advance(1 / 120);
    expect(at120.simTime).toBeCloseTo(at60.simTime, 2);
    expect(at60.simTime).toBeCloseTo(5 * SIM_SPEED, 2);
  });

  it.each(PRESETS.map((p, i) => [p.name, i] as const))(
    '%s stays on screen for 10 minutes at 60 Hz',
    (_name, index) => {
      const l = lab(index);
      let worst = 0;
      for (let f = 0; f < 60 * 600; f++) {
        l.advance(1 / 60);
        worst = Math.max(worst, l.radius());
      }
      // Every body stays inside the visible area (minus half a body) the whole time.
      expect(worst).toBeLessThan(VISIBLE_RADIUS - 0.05);
    },
    120_000,
  );
});
