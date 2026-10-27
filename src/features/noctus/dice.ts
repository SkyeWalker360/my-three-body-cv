/**
 * Dice for Noctus Umbra. Pure: every function takes its random source, so tests can seed it.
 */
export type Rng = () => number;

/**
 * The campaign notes record DCs but no character-sheet values, so every party check uses one
 * modifier: +5, a proficient level 7–8 adventurer (+3 proficiency, +2 ability). Game
 * configuration, not CV content.
 */
export const PARTY_MODIFIER = 5;

/** Per-stat overrides, for when real sheet values are added. Empty: every check uses +5. */
export const MODIFIER_OVERRIDES: Record<string, number> = {};

export function modifierFor(stat: string): number {
  return MODIFIER_OVERRIDES[stat] ?? PARTY_MODIFIER;
}

export function rollDie(sides: number, rng: Rng): number {
  return 1 + Math.floor(rng() * sides);
}

export type CheckResult = {
  stat: string;
  d20: number;
  modifier: number;
  total: number;
  dc: number;
  pass: boolean;
};

/** d20 + modifier against a DC. Meeting the DC passes. */
export function resolveCheck(stat: string, dc: number, rng: Rng): CheckResult {
  const d20 = rollDie(20, rng);
  const modifier = modifierFor(stat);
  const total = d20 + modifier;
  return { stat, d20, modifier, total, dc, pass: total >= dc };
}

export function describeCheck(r: CheckResult): string {
  const sign = r.modifier >= 0 ? '+' : '−';
  return `🎲 ${r.stat} check: d20 (${r.d20}) ${sign} ${Math.abs(r.modifier)} = ${r.total} vs DC ${r.dc} — ${r.pass ? 'PASS' : 'FAIL'}`;
}

/**
 * Mining Rewards (d100), from the Season Two notes: 1–10 Stone, 11–20 Iron, 21–30 Copper,
 * 31–50 Silver, 51–70 Gold, 71–80 Platinum, 90–95 Gems, 96+ Dragon Shards. The notes skip
 * 81–89; it is treated as Platinum here.
 */
export const MINE_TABLE: Array<{ min: number; find: string }> = [
  { min: 96, find: 'Dragon Shards' },
  { min: 90, find: 'Gems' },
  { min: 71, find: 'Platinum' },
  { min: 51, find: 'Gold' },
  { min: 31, find: 'Silver' },
  { min: 21, find: 'Copper' },
  { min: 11, find: 'Iron' },
  { min: 1, find: 'Stone' },
];

export function rollD100Mine(rng: Rng): { roll: number; find: string } {
  const roll = rollDie(100, rng);
  const row = MINE_TABLE.find((r) => roll >= r.min)!;
  return { roll, find: row.find };
}

export type ContestResult = {
  ours: number;
  theirs: number;
  /** The second d20 when rolling with advantage, else null. */
  other: number | null;
  pass: boolean;
};

/**
 * One pull in Sto's soul tug-of-war: our d20 + modifier (with advantage if earned) against a
 * spirit's d20 + foeBonus. Ties go to the side holding the chain: us.
 */
export function resolveContest(foeBonus: number, advantage: boolean, rng: Rng): ContestResult {
  const a = rollDie(20, rng);
  const b = advantage ? rollDie(20, rng) : null;
  const ours = Math.max(a, b ?? 0) + PARTY_MODIFIER;
  const theirs = rollDie(20, rng) + foeBonus;
  return { ours, theirs, other: b === null ? null : Math.min(a, b), pass: ours >= theirs };
}

export function describeContest(r: ContestResult, foeBonus: number): string {
  const adv = r.other === null ? '' : ' (advantage)';
  return `🎲 Tug: you ${r.ours}${adv} vs spirit ${r.theirs} (d20 + ${foeBonus}) — ${r.pass ? 'YOU PULL' : 'THEY PULL'}`;
}
