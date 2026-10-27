import { describe, expect, it } from 'vitest';
import {
  describeCheck,
  MINE_TABLE,
  modifierFor,
  resolveCheck,
  rollD100Mine,
} from '@/features/noctus/dice';

const fixed = (v: number) => () => v;

describe('dice', () => {
  it('passes when d20 + modifier meets the DC', () => {
    // rng 0.5 → d20 = 11; Athletics +5 → 16.
    const r = resolveCheck('Athletics', 16, fixed(0.5));
    expect(r).toMatchObject({ d20: 11, modifier: 5, total: 16, pass: true });
    expect(resolveCheck('Athletics', 17, fixed(0.5)).pass).toBe(false);
  });

  it('rolls 1–20', () => {
    expect(resolveCheck('STR', 10, fixed(0)).d20).toBe(1);
    expect(resolveCheck('STR', 10, fixed(0.999999)).d20).toBe(20);
  });

  it('uses 0 for unknown stats', () => {
    expect(modifierFor('Juggling')).toBe(0);
  });

  it('prints the roll against the DC', () => {
    expect(describeCheck(resolveCheck('CON', 18, fixed(0.5)))).toBe(
      '🎲 CON check: d20 (11) + 3 = 14 vs DC 18 — FAIL',
    );
  });

  it('gives Dragonshards on 96+', () => {
    expect(rollD100Mine(fixed(0.96)).find).toBe('Dragonshards');
    expect(rollD100Mine(fixed(0)).find).toBe('Stone');
  });

  it('covers 1–100 with the mine table', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(MINE_TABLE.find((r) => roll >= r.min)).toBeDefined();
    }
  });
});
