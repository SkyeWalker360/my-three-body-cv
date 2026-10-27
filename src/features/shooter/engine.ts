/**
 * The shooter's game state and rules. Pure: input, time and randomness come in as arguments,
 * so the whole game can be stepped in tests. Units are CSS pixels and seconds.
 */
import type { Game as GameBlock } from '@/lib/schema';
import { type Boss, createBoss, updateBoss } from './boss';
import type { Seed } from './harvest';

export type Rng = () => number;

export type Input = {
  thrust: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

export type Ship = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  invulnerable: number;
  cooldown: number;
};

export type Asteroid = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  label: string;
  fragments: string[];
  pebble: boolean;
};

export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hostile: boolean;
  label?: string;
};

export type Spark = { x: number; y: number; vx: number; vy: number; life: number };

export type GameState = {
  width: number;
  height: number;
  ship: Ship;
  asteroids: Asteroid[];
  bullets: Bullet[];
  sparks: Spark[];
  boss: Boss | null;
  bossDefeated: boolean;
  score: number;
  time: number;
  status: 'playing' | 'victory' | 'defeat';
};

export const SHIP_HP = 5;
export const SHIP_RADIUS = 8;
const TURN_SPEED = 4.5;
const THRUST = 520;
const MAX_SPEED = 420;
const FIRE_COOLDOWN = 0.16;
const BULLET_SPEED = 640;
const BULLET_LIFE = 1.1;
const PEBBLE_SIZE = 28;
export const SCORE_HIT = 50;
export const SCORE_DESTROY = 100;
export const SCORE_BOSS = 1000;

const DEFAULT_GAME: GameBlock = { hp: 4, fragments: ['CV'] };

export function createGame(
  seeds: Seed[],
  gameFor: (id: string) => GameBlock | undefined,
  width: number,
  height: number,
  rng: Rng,
): GameState {
  const asteroids = seeds.map((s): Asteroid => {
    const g = gameFor(s.id) ?? DEFAULT_GAME;
    const angle = rng() * Math.PI * 2;
    const speed = 20 + rng() * 40;
    return {
      x: s.rect.x + s.rect.w / 2,
      y: s.rect.y + s.rect.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: clamp(s.rect.w * 0.35, 56, 260),
      h: clamp(s.rect.h * 0.35, 36, 140),
      hp: g.hp,
      maxHp: g.hp,
      label: s.label,
      fragments: g.fragments,
      pebble: false,
    };
  });
  return {
    width,
    height,
    ship: {
      x: width / 2,
      y: height - 80,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hp: SHIP_HP,
      invulnerable: 1.5,
      cooldown: 0,
    },
    asteroids,
    bullets: [],
    sparks: [],
    boss: null,
    bossDefeated: false,
    score: 0,
    time: 0,
    status: 'playing',
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Wrap a coordinate around [0, size). */
export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

export function update(g: GameState, input: Input, dt: number, rng: Rng): void {
  if (g.status !== 'playing') {
    updateSparks(g, dt);
    return;
  }
  g.time += dt;
  updateShip(g, input, dt);
  if (input.fire && g.ship.cooldown <= 0) fire(g);

  for (const a of g.asteroids) {
    a.x = wrap(a.x + a.vx * dt, g.width);
    a.y = wrap(a.y + a.vy * dt, g.height);
  }
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (!b.hostile) {
      b.x = wrap(b.x, g.width);
      b.y = wrap(b.y, g.height);
    }
  }

  collideBulletsWithAsteroids(g, rng);
  collideShipWithAsteroids(g);

  if (g.asteroids.length === 0 && !g.boss && !g.bossDefeated) {
    g.boss = createBoss(g.width);
  }
  if (g.boss) {
    updateBoss(g.boss, g, dt, rng);
    collideWithBoss(g, rng);
  }
  collideHostileBullets(g);

  g.bullets = g.bullets.filter(
    (b) => b.life > 0 && b.x > -40 && b.x < g.width + 40 && b.y > -40 && b.y < g.height + 40,
  );
  updateSparks(g, dt);

  if (g.ship.hp <= 0) {
    g.status = 'defeat';
    burst(g, g.ship.x, g.ship.y, 40, rng);
  }
}

function updateShip(g: GameState, input: Input, dt: number): void {
  const s = g.ship;
  if (input.left) s.angle -= TURN_SPEED * dt;
  if (input.right) s.angle += TURN_SPEED * dt;
  if (input.thrust) {
    s.vx += Math.cos(s.angle) * THRUST * dt;
    s.vy += Math.sin(s.angle) * THRUST * dt;
  }
  const drag = Math.pow(input.brake ? 0.02 : 0.45, dt);
  s.vx *= drag;
  s.vy *= drag;
  const speed = Math.hypot(s.vx, s.vy);
  if (speed > MAX_SPEED) {
    s.vx *= MAX_SPEED / speed;
    s.vy *= MAX_SPEED / speed;
  }
  s.x = wrap(s.x + s.vx * dt, g.width);
  s.y = wrap(s.y + s.vy * dt, g.height);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.invulnerable = Math.max(0, s.invulnerable - dt);
}

function fire(g: GameState): void {
  const s = g.ship;
  g.bullets.push({
    x: s.x + Math.cos(s.angle) * 12,
    y: s.y + Math.sin(s.angle) * 12,
    vx: Math.cos(s.angle) * BULLET_SPEED + s.vx,
    vy: Math.sin(s.angle) * BULLET_SPEED + s.vy,
    life: BULLET_LIFE,
    hostile: false,
  });
  s.cooldown = FIRE_COOLDOWN;
}

export function hitsBox(
  px: number,
  py: number,
  a: { x: number; y: number; w: number; h: number },
  pad = 0,
): boolean {
  return Math.abs(px - a.x) <= a.w / 2 + pad && Math.abs(py - a.y) <= a.h / 2 + pad;
}

function collideBulletsWithAsteroids(g: GameState, rng: Rng): void {
  const spawned: Asteroid[] = [];
  for (const b of g.bullets) {
    if (b.hostile || b.life <= 0) continue;
    for (const a of g.asteroids) {
      if (a.hp <= 0 || !hitsBox(b.x, b.y, a, 2)) continue;
      b.life = 0;
      a.hp -= 1;
      g.score += SCORE_HIT;
      if (a.hp <= 0) {
        g.score += SCORE_DESTROY;
        burst(g, a.x, a.y, 16, rng);
        if (!a.pebble) spawned.push(...fragment(a, rng));
      }
      break;
    }
  }
  g.asteroids = g.asteroids.filter((a) => a.hp > 0).concat(spawned);
}

/** A destroyed CV block breaks into 1 HP skill pebbles, one per fragment label. */
export function fragment(a: Asteroid, rng: Rng): Asteroid[] {
  return a.fragments.map((label, i) => {
    const angle = (i / a.fragments.length) * Math.PI * 2 + rng() * 0.6;
    const speed = 70 + rng() * 60;
    return {
      x: a.x,
      y: a.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.max(PEBBLE_SIZE, label.length * 7 + 8),
      h: PEBBLE_SIZE,
      hp: 1,
      maxHp: 1,
      label,
      fragments: [],
      pebble: true,
    };
  });
}

function damageShip(g: GameState): void {
  if (g.ship.invulnerable > 0) return;
  g.ship.hp -= 1;
  g.ship.invulnerable = 1.2;
}

function collideShipWithAsteroids(g: GameState): void {
  for (const a of g.asteroids) {
    if (hitsBox(g.ship.x, g.ship.y, a, SHIP_RADIUS)) {
      damageShip(g);
      return;
    }
  }
}

function collideHostileBullets(g: GameState): void {
  for (const b of g.bullets) {
    if (!b.hostile || b.life <= 0) continue;
    if (Math.hypot(b.x - g.ship.x, b.y - g.ship.y) < SHIP_RADIUS + 4) {
      b.life = 0;
      damageShip(g);
    }
  }
}

function collideWithBoss(g: GameState, rng: Rng): void {
  const boss = g.boss!;
  if (boss.entering) return;
  for (const b of g.bullets) {
    if (b.hostile || b.life <= 0) continue;
    if (hitsBox(b.x, b.y, { x: boss.x, y: boss.y, w: boss.size, h: boss.size })) {
      b.life = 0;
      boss.hp -= 1;
      boss.flash = 0.08;
      g.score += SCORE_HIT / 2;
      if (boss.hp <= 0) {
        g.score += SCORE_BOSS;
        burst(g, boss.x, boss.y, 80, rng);
        g.boss = null;
        g.bossDefeated = true;
        g.status = 'victory';
        return;
      }
    }
  }
  if (
    hitsBox(g.ship.x, g.ship.y, { x: boss.x, y: boss.y, w: boss.size, h: boss.size }, SHIP_RADIUS)
  ) {
    damageShip(g);
  }
}

function burst(g: GameState, x: number, y: number, count: number, rng: Rng): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const s = 40 + rng() * 200;
    g.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + rng() * 0.6 });
  }
  if (g.sparks.length > 400) g.sparks.splice(0, g.sparks.length - 400);
}

function updateSparks(g: GameState, dt: number): void {
  for (const s of g.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  }
  g.sparks = g.sparks.filter((s) => s.life > 0);
}
