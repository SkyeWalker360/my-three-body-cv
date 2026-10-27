/**
 * Dice for Noctus Umbra. Pure: every function takes its random source, so tests can seed it.
 */
export type Rng = () => number;

/**
 * Check modifiers by stat or skill name. Game configuration, not CV content.
 * TODO(luke): replace with the party's real sheet values from the campaign notes.
 */
export const MODIFIERS: Record<string, number> = {
  STR: 3,
  DEX: 2,
  CON: 3,
  INT: 1,
  WIS: 2,
  CHA: 1,
  Acrobatics: 4,
  Arcana: 3,
  Athletics: 5,
  History: 2,
  Insight: 3,
  Investigation: 3,
  Perception: 4,
  Spirit: 5,
};

export function modifierFor(stat: string): number {
  return MODIFIERS[stat] ?? 0;
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
 * Mine-shift haul table (d100). Only "96+ Dragonshards" is fixed by the campaign notes.
 * TODO(luke): confirm the other bands against the Crescent Mines notes.
 */
export const MINE_TABLE: Array<{ min: number; find: string }> = [
  { min: 96, find: 'Dragonshards' },
  { min: 90, find: 'Gems' },
  { min: 82, find: 'Platinum' },
  { min: 70, find: 'Gold' },
  { min: 55, find: 'Silver' },
  { min: 38, find: 'Copper' },
  { min: 20, find: 'Iron' },
  { min: 1, find: 'Stone' },
];

export function rollD100Mine(rng: Rng): { roll: number; find: string } {
  const roll = rollDie(100, rng);
  const row = MINE_TABLE.find((r) => roll >= r.min)!;
  return { roll, find: row.find };
}
