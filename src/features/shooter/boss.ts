/**
 * The Architect: a three-phase boss whose phase is set by remaining HP.
 * 100–66% syntax barrage, 66–33% magnetic flux pull, 33–0% supernova overdrive.
 */
import type { GameState, Rng } from './engine';

export const BOSS_HP = 60;
/** On-screen size in CSS pixels: the 128×128 sprite drawn on the 2× overlay buffer. */
export const BOSS_SIZE = 256;
export const SYNTAX = ['{ }', '</>', 'SELECT *', 'go func()'];

export type Phase = 1 | 2 | 3;

export type Boss = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  size: number;
  t: number;
  fireTimer: number;
  shots: number;
  entering: boolean;
  flash: number;
  /** +1 pulls the ship in, −1 pushes it away (phase 2). */
  polarity: 1 | -1;
};

/**
 * Up to 40% of the field's width, in steps of 64 CSS px so the 32 px photo stays a whole-number
 * scale: 256 on a desktop, 128 on a phone-sized field.
 */
export function bossSize(width: number): number {
  return Math.max(64, Math.min(BOSS_SIZE, Math.floor((width * 0.4) / 64) * 64));
}

export function createBoss(width: number): Boss {
  const size = bossSize(width);
  return {
    x: width / 2,
    y: -size,
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    size,
    t: 0,
    fireTimer: 1,
    shots: 0,
    entering: true,
    flash: 0,
    polarity: 1,
  };
}

export function phaseOf(boss: Pick<Boss, 'hp' | 'maxHp'>): Phase {
  const ratio = boss.hp / boss.maxHp;
  if (ratio > 2 / 3) return 1;
  if (ratio > 1 / 3) return 2;
  return 3;
}

export const PHASE_NAMES: Record<Phase, string> = {
  1: 'SYNTAX BARRAGE',
  2: 'MAGNETIC FLUX',
  3: 'SUPERNOVA OVERDRIVE',
};

export function updateBoss(boss: Boss, g: GameState, dt: number, rng: Rng): void {
  boss.t += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  const homeY = boss.size / 2 + 48;

  if (boss.entering) {
    boss.y += 120 * dt;
    if (boss.y >= homeY) {
      boss.y = homeY;
      boss.entering = false;
    }
    return;
  }

  const phase = phaseOf(boss);
  const sway = phase === 3 ? 1.6 : 0.8;
  boss.x = g.width / 2 + Math.sin(boss.t * sway) * Math.max(0, g.width / 2 - boss.size);
  boss.fireTimer -= dt;

  if (phase === 1) {
    // Spiral of code-shaped bullets.
    if (boss.fireTimer <= 0) {
      const angle = boss.t * 3;
      for (const offset of [0, Math.PI]) {
        shoot(g, boss, angle + offset, 170, SYNTAX[boss.shots % SYNTAX.length]);
      }
      boss.shots++;
      boss.fireTimer = 0.14;
    }
  } else if (phase === 2) {
    // Alternating north/south flux: pull the ship in, then push it away.
    boss.polarity = Math.floor(boss.t / 2) % 2 === 0 ? 1 : -1;
    const dx = boss.x - g.ship.x;
    const dy = boss.y - g.ship.y;
    const d = Math.max(60, Math.hypot(dx, dy));
    const pull = 260 * boss.polarity;
    g.ship.vx += (dx / d) * pull * dt;
    g.ship.vy += (dy / d) * pull * dt;
    if (boss.fireTimer <= 0) {
      shoot(g, boss, Math.atan2(g.ship.y - boss.y, g.ship.x - boss.x), 220, 'N');
      boss.fireTimer = 0.55;
    }
  } else {
    // Radial supernova bursts, slightly rotated each time.
    if (boss.fireTimer <= 0) {
      const count = 18;
      const spin = rng() * Math.PI;
      for (let i = 0; i < count; i++) shoot(g, boss, spin + (i / count) * Math.PI * 2, 210);
      boss.fireTimer = 0.85;
    }
  }
}

function shoot(g: GameState, boss: Boss, angle: number, speed: number, label?: string): void {
  g.bullets.push({
    x: boss.x + Math.cos(angle) * (boss.size / 2),
    y: boss.y + Math.sin(angle) * (boss.size / 2),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 6,
    hostile: true,
    label,
  });
}
