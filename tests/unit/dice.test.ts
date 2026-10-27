import { describe, expect, it } from 'vitest';
import {
  describeCheck,
  MINE_TABLE,
  modifierFor,
  PARTY_MODIFIER,
  resolveCheck,
  resolveContest,
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

  it('uses the party modifier for every check (the notes record no sheet values)', () => {
    expect(modifierFor('Juggling')).toBe(PARTY_MODIFIER);
    expect(modifierFor('CON')).toBe(5);
  });

  it('prints the roll against the DC', () => {
    expect(describeCheck(resolveCheck('CON', 18, fixed(0.5)))).toBe(
      '🎲 CON check: d20 (11) + 5 = 16 vs DC 18 — FAIL',
    );
  });

  it('follows the Mining Rewards table from the notes', () => {
    const at = (roll: number) => rollD100Mine(fixed((roll - 0.5) / 100)).find;
    expect([1, 10, 11, 21, 31, 50, 51, 70, 71, 80, 85, 90, 95, 96, 100].map(at)).toEqual([
      'Stone',
      'Stone',
      'Iron',
      'Copper',
      'Silver',
      'Silver',
      'Gold',
      'Gold',
      'Platinum',
      'Platinum',
      'Platinum',
      'Gems',
      'Gems',
      'Dragon Shards',
      'Dragon Shards',
    ]);
  });

  it('covers 1–100 with the mine table', () => {
    for (let roll = 1; roll <= 100; roll++) {
      expect(MINE_TABLE.find((r) => roll >= r.min)).toBeDefined();
    }
  });

  it('resolves tug-of-war pulls against a d20 + 5 spirit, ties to us', () => {
    // rng 0.5 → every d20 is 11: we get 11 + 5 = 16, the spirit 11 + 5 = 16.
    expect(resolveContest(5, false, fixed(0.5))).toMatchObject({
      ours: 16,
      theirs: 16,
      pass: true,
    });
    // Advantage takes the higher of two d20s.
    const rolls = [0.05, 0.95, 0.5];
    const r = resolveContest(5, true, () => rolls.shift()!);
    expect(r).toMatchObject({ ours: 25, other: 2, theirs: 16, pass: true });
  });
});
