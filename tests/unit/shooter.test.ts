import { describe, expect, it } from 'vitest';
import { BOSS_HP, BOSS_SIZE, bossSize, phaseOf } from '@/features/shooter/boss';
import {
  createGame,
  fragment,
  type GameState,
  type Input,
  SCORE_BOSS,
  update,
  wrap,
} from '@/features/shooter/engine';
import { inViewport } from '@/features/shooter/harvest';

const idle: Input = { thrust: false, brake: false, left: false, right: false, fire: false };
const rng = () => 0.5;

function game(): GameState {
  return createGame(
    [{ id: 'gen318', label: 'GEN318', rect: { x: 100, y: 100, w: 400, h: 200 } }],
    (id) => (id === 'gen318' ? { hp: 2, fragments: ['A', 'B'] } : undefined),
    1280,
    720,
    rng,
  );
}

describe('harvest', () => {
  it('only takes blocks inside the viewport', () => {
    expect(inViewport({ x: 0, y: 0, w: 100, h: 100 }, 1280, 720)).toBe(true);
    expect(inViewport({ x: 0, y: -500, w: 100, h: 100 }, 1280, 720)).toBe(false);
    expect(inViewport({ x: 0, y: 700, w: 100, h: 100 }, 1280, 720)).toBe(false);
  });
});

describe('shooter engine', () => {
  it('takes HP from the manifest game block', () => {
    expect(game().asteroids[0]).toMatchObject({ hp: 2, fragments: ['A', 'B'], label: 'GEN318' });
  });

  it('wraps instead of bouncing', () => {
    expect(wrap(-5, 100)).toBe(95);
    expect(wrap(105, 100)).toBe(5);
    const g = game();
    const a = g.asteroids[0]!;
    a.x = 1279;
    a.vx = 100;
    a.vy = 0;
    update(g, idle, 0.1, rng);
    expect(a.x).toBeLessThan(100);
  });

  it('splits a destroyed block into 1 HP pebbles, one per fragment', () => {
    const pebbles = fragment(game().asteroids[0]!, rng);
    expect(pebbles.map((p) => [p.label, p.hp, p.pebble])).toEqual([
      ['A', 1, true],
      ['B', 1, true],
    ]);
  });

  it('spawns the boss once the field is clear, then wins when it dies', () => {
    const g = game();
    g.asteroids = [];
    update(g, idle, 0.016, rng);
    expect(g.boss).not.toBeNull();
    g.boss!.entering = false;
    g.boss!.y = 200;
    g.boss!.hp = 1;
    g.ship.invulnerable = 99;
    g.bullets.push({ x: g.boss!.x, y: g.boss!.y, vx: 0, vy: 0, life: 1, hostile: false });
    update(g, idle, 0.001, rng);
    expect(g.status).toBe('victory');
    expect(g.score).toBeGreaterThanOrEqual(SCORE_BOSS);
    // No second boss.
    update(g, idle, 0.016, rng);
    expect(g.boss).toBeNull();
  });

  it('runs three phases by HP', () => {
    expect(phaseOf({ hp: BOSS_HP, maxHp: BOSS_HP })).toBe(1);
    expect(phaseOf({ hp: BOSS_HP * 0.5, maxHp: BOSS_HP })).toBe(2);
    expect(phaseOf({ hp: BOSS_HP * 0.2, maxHp: BOSS_HP })).toBe(3);
  });

  it('ends in defeat when the hull is gone', () => {
    const g = game();
    g.ship.hp = 1;
    g.ship.invulnerable = 0;
    const a = g.asteroids[0]!;
    g.ship.x = a.x;
    g.ship.y = a.y;
    update(g, idle, 0.001, rng);
    expect(g.status).toBe('defeat');
  });

  it('fires along the ship heading with a cooldown', () => {
    const g = game();
    g.asteroids = [{ ...g.asteroids[0]!, x: 10, y: 10 }];
    update(g, { ...idle, fire: true }, 0.01, rng);
    update(g, { ...idle, fire: true }, 0.01, rng);
    expect(g.bullets.filter((b) => !b.hostile)).toHaveLength(1);
    expect(g.bullets[0]!.vy).toBeLessThan(0);
  });
});

describe('boss size', () => {
  it('fits the field in whole-number steps of the 32 px photo', () => {
    expect(bossSize(1280)).toBe(BOSS_SIZE);
    expect(bossSize(360)).toBe(128);
    expect(bossSize(100)).toBe(64);
    for (const w of [200, 390, 640, 1000]) expect(bossSize(w) % 64).toBe(0);
  });
});
