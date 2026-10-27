import { describe, expect, it } from 'vitest';
import { laneEmden } from '@/features/karl/core';
import { larsonLevels } from '@/features/karl/scanner';
import { karlMachine } from '@/features/karl/machine';
import { ParticlePool, particleSize, POOL_SIZE, rampIndex } from '@/features/cursor/particles';
import { bayer8 } from '@/lib/dither';
import { firstSentences, formatDate, formatRange } from '@/lib/format';
import { frameForAngle } from '@/lib/ship-sprite';
import { createActor } from 'xstate';

describe('format', () => {
  it('formats ISO dates', () => {
    expect(formatDate('2022-11')).toBe('Nov 2022');
    expect(formatDate('2018')).toBe('2018');
    expect(formatRange('2025', null)).toBe('2025 – Present');
    expect(formatRange('2026-03', '2026-05')).toBe('Mar 2026 – May 2026');
  });

  it('keeps sentences verbatim', () => {
    expect(firstSentences('One. Two! Three? Four.', 2)).toBe('One. Two!');
  });
});

describe('core gauge physics', () => {
  it('finds the n = 3 polytrope surface at ξ₁ ≈ 6.897', () => {
    const { xi1, density } = laneEmden(3);
    expect(xi1).toBeCloseTo(6.8968, 3);
    expect(density[0]).toBe(1);
    expect(density[density.length - 1]).toBeLessThan(1e-3);
  });

  it('builds a full 8×8 Bayer matrix', () => {
    const b = bayer8();
    expect(b).toHaveLength(64);
    expect(new Set(Array.from(b, (v) => Math.round(v * 64 - 0.5))).size).toBe(64);
  });
});

describe('Larson scanner', () => {
  it('lights exactly two core cells', () => {
    for (const t of [0, 0.3, 0.5, 1.2, 1.9]) {
      expect(larsonLevels(t).filter((l) => l === 1)).toHaveLength(2);
    }
  });
});

describe('K.A.R.L. machine', () => {
  it('moves between idle, cv, rpg and karr', () => {
    const actor = createActor(karlMachine).start();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.send({ type: 'CV' });
    expect(actor.getSnapshot().value).toBe('cv');
    actor.send({ type: 'RPG' });
    expect(actor.getSnapshot().value).toBe('rpg');
    actor.send({ type: 'KARR' });
    expect(actor.getSnapshot().value).toBe('rpg');
    actor.send({ type: 'EXIT' });
    actor.send({ type: 'KARR' });
    expect(actor.getSnapshot().value).toBe('karr');
    actor.send({ type: 'KARR' });
    expect(actor.getSnapshot().value).toBe('idle');
  });
});

describe('cursor', () => {
  it('picks one of 16 frames at 22.5° steps', () => {
    expect(frameForAngle(0)).toBe(0);
    expect(frameForAngle(Math.PI / 2)).toBe(4);
    expect(frameForAngle(-Math.PI / 2)).toBe(12);
    expect(frameForAngle(Math.PI)).toBe(8);
  });

  it('recycles a fixed pool of 200 particles', () => {
    const pool = new ParticlePool();
    for (let i = 0; i < 500; i++) pool.spawn(0, 0, 1, 0, 1);
    expect(pool.alive()).toBe(POOL_SIZE);
    pool.update(2);
    expect(pool.alive()).toBe(0);
  });

  it('shrinks 4 → 1 px and walks the colour ramp', () => {
    expect(particleSize(1)).toBe(4);
    expect(particleSize(0)).toBe(1);
    expect(rampIndex(1, 5)).toBe(0);
    expect(rampIndex(0, 5)).toBe(4);
  });
});
