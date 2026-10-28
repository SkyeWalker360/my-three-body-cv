/**
 * 32×32 procedural specimen sprites for the field scanner. Pure, for tests.
 *
 * A frame lists the ramps it shades with and one cell per pixel:
 *   EMPTY  (−1)  the screen's background,
 *   DUST   (−2)  a faint background star,
 *   r·6 + s       step s (0–5) of ramp r.
 * The component maps cells to `readRamp()` colours, so nothing here knows a hex value.
 * Shading picks ramp steps and dithers between neighbours with the 8×8 Bayer matrix;
 * nothing is mixed or interpolated.
 */
import { bayer8 } from '@/lib/dither';
import type { RampName } from '@/lib/palette';

export const SPRITE_SIZE = 32;
export const EMPTY = -1;
export const DUST = -2;
const STEPS = 6;

export type SpriteKind =
  'ship' | 'relay' | 'magnet' | 'badge' | 'creature' | 'star' | 'dying' | 'black-hole' | 'planet';

export type SpriteFrame = { ramps: RampName[]; cells: Int8Array };

const BAYER = bayer8();
const threshold = (x: number, y: number) => BAYER[(y & 7) * 8 + (x & 7)]!;

/** A shade in [0, 5] becomes a whole step, dithered between its two neighbouring steps. */
export function ditherStep(shade: number, x: number, y: number): number {
  const v = Math.min(STEPS - 1, Math.max(0, shade));
  const lo = Math.floor(v);
  return Math.min(STEPS - 1, lo + (v - lo > threshold(x, y) ? 1 : 0));
}

/** FNV-1a hash of the key, for a stable per-specimen seed. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small deterministic generator (mulberry32). */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  cells = new Int8Array(SPRITE_SIZE * SPRITE_SIZE).fill(EMPTY);
  set(x: number, y: number, ramp: number, step: number) {
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) return;
    this.cells[y * SPRITE_SIZE + x] = ramp * STEPS + Math.min(STEPS - 1, Math.max(0, step));
  }
  get(x: number, y: number): number {
    return this.cells[y * SPRITE_SIZE + x]!;
  }
  /** Calls `fn` for every pixel centre inside a disc; d is the distance as a fraction of r. */
  disc(
    cx: number,
    cy: number,
    r: number,
    fn: (x: number, y: number, d: number, nx: number, ny: number) => void,
  ) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy) / r;
        if (d <= 1) fn(x, y, d, dx / r, dy / r);
      }
    }
  }
}

function dust(c: Canvas, rnd: () => number) {
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd() * SPRITE_SIZE);
    const y = Math.floor(rnd() * SPRITE_SIZE);
    c.cells[y * SPRITE_SIZE + x] = DUST;
  }
}

/** Light from the upper left, as a shade offset in [-1, 1]. */
const light = (nx: number, ny: number) => -0.6 * nx - 0.8 * ny;

/* Pixel maps: digits are ramp steps on the sprite's main ramp, letters are accents. */
const SHIP = [
  '.......5.......',
  '......545......',
  '......434......',
  '.....43c34.....',
  '.....3ccc3.....',
  '....33ccc33....',
  '...3332c2333...',
  '..322222222223.',
  '.3221111111223.',
  '32211.....11223',
  '211.........112',
  '1.............1',
];

function ship(c: Canvas, t: number) {
  const ox = 8;
  const oy = 7;
  SHIP.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'c') c.set(ox + x, oy + y, 0, 5);
      else if (ch !== '.') c.set(ox + x, oy + y, 0, Number(ch));
    }),
  );
  // Thrusters: red ramp, flickering between steps 3 and 4.
  const flame = Math.floor(t * 8) % 2;
  for (let y = 0; y < 3; y++) {
    for (const x of [ox + 4, ox + 10]) c.set(x, oy + 12 + y, 1, 4 - y - flame);
  }
}

function relay(c: Canvas, t: number) {
  // A rack of three servers in the void ramp, with status lights on the sector ramp.
  for (let unit = 0; unit < 3; unit++) {
    const y0 = 7 + unit * 7;
    for (let y = y0; y < y0 + 6; y++) {
      for (let x = 8; x < 24; x++) {
        const edge = y === y0 || x === 8;
        const shadow = y === y0 + 5 || x === 23;
        c.set(x, y, 0, edge ? 5 : shadow ? 2 : 3);
      }
    }
    for (let i = 0; i < 3; i++) {
      const on = (Math.floor(t * 3) + unit + i) % 4 !== 0;
      c.set(11 + i * 2, y0 + 3, 1, on ? 4 : 1);
    }
    for (let x = 17; x < 22; x++) c.set(x, y0 + 3, 0, 1);
  }
}

function magnet(c: Canvas, t: number) {
  // A horseshoe magnet: red pole on the left, cyan on the right, steel tips, and fluorescent
  // particles gathering in the gap, as in a magnetic particle test.
  const R = 0;
  const C = 1;
  const V = 2;
  const G = 3;
  c.disc(16, 14, 10, (x, y, d, nx, ny) => {
    if (d < 0.5 || y < 14) return;
    const ramp = x < 16 ? R : C;
    c.set(x, y, ramp, ditherStep(2.6 + 1.6 * light(nx, ny), x, y));
  });
  for (let y = 6; y < 15; y++) {
    for (const [x0, ramp] of [
      [6, R],
      [21, C],
    ] as const) {
      for (let x = x0; x < x0 + 5; x++) {
        const steel = y < 9;
        c.set(
          x,
          y,
          steel ? V : ramp,
          steel ? (x === x0 ? 5 : 4) : x === x0 ? 4 : x === x0 + 4 ? 2 : 3,
        );
      }
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = t * 1.4 + i * 0.7;
    const x = Math.round(16 + Math.sin(a) * (3 + (i % 3)));
    const y = Math.round(9 + Math.cos(a * 0.8) * 2 - (i % 2));
    c.set(x, y, G, 4 + (i % 2));
  }
}

function badge(c: Canvas) {
  // A medal: two ribbons on the sector ramp over a gold disc.
  for (let y = 3; y < 15; y++) {
    for (const x0 of [11, 18]) {
      c.set(x0, y, 1, 2);
      c.set(x0 + 1, y, 1, 3);
      c.set(x0 + 2, y, 1, 4);
    }
  }
  c.disc(16, 20, 8.5, (x, y, d, nx, ny) => {
    const rim = d > 0.82;
    c.set(
      x,
      y,
      0,
      rim ? ditherStep(1.6 + light(nx, ny), x, y) : ditherStep(3.2 + 1.5 * light(nx, ny), x, y),
    );
  });
  // A five-point star stamped in the middle.
  for (const [x, y] of [
    [16, 16],
    [15, 17],
    [16, 17],
    [17, 17],
    [13, 18],
    [14, 18],
    [15, 18],
    [16, 18],
    [17, 18],
    [18, 18],
    [19, 18],
    [14, 19],
    [15, 19],
    [16, 19],
    [17, 19],
    [18, 19],
    [15, 20],
    [17, 20],
    [14, 21],
    [18, 21],
  ] as const) {
    c.set(x, y, 0, 5);
  }
}

function creature(c: Canvas, rnd: () => number, t: number) {
  // A mirrored 12×12 shape seeded from the specimen, two pixels per cell.
  const half: boolean[][] = [];
  for (let y = 0; y < 12; y++) {
    half[y] = [];
    for (let x = 0; x < 6; x++) half[y]![x] = rnd() > 0.38 + Math.abs(y - 6) * 0.05 - x * 0.03;
  }
  // Guarantee a solid head so every creature has a face.
  for (let y = 4; y < 8; y++) for (let x = 3; x < 6; x++) half[y]![x] = true;
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 6; x++) {
      if (!half[y]![x]) continue;
      const step = y < 4 ? 4 : y < 9 ? 3 : 2;
      for (const cx of [x, 11 - x]) {
        for (let py = 0; py < 2; py++) {
          for (let px = 0; px < 2; px++) c.set(4 + cx * 2 + px, 4 + y * 2 + py, 0, step);
        }
      }
    }
  }
  const blink = t % 4 < 0.15;
  for (const ex of [11, 18]) {
    for (let py = 0; py < (blink ? 1 : 3); py++) {
      for (let px = 0; px < 3; px++) c.set(ex + px, 13 + py + (blink ? 1 : 0), 1, 0);
    }
    if (!blink) c.set(ex + 1, 13, 1, 5);
  }
}

function star(c: Canvas, t: number) {
  // Stellar ramp: white at the centre, cooling to red at the limb, with boiling granules.
  c.disc(16, 16, 11, (x, y, d) => {
    const boil = 0.35 * Math.sin(x * 0.9 + t * 1.3) * Math.sin(y * 1.1 - t);
    c.set(x, y, 0, ditherStep(3.1 * Math.sqrt(1 - d * d) + boil, x, y));
  });
}

function dying(c: Canvas, t: number) {
  // Red ramp: a pulsing giant with a hot core, and a detached shell of gas.
  const r = 9 + Math.sin(t * 2.2) * 0.8;
  c.disc(16, 16, r, (x, y, d, nx, ny) => {
    if (d < 0.25) c.set(x, y, 1, 5);
    else c.set(x, y, 0, ditherStep(3 + 1.6 * light(nx, ny) - d * 1.4, x, y));
  });
  const shell = 13 + ((t * 0.8) % 2);
  for (let a = 0; a < 96; a++) {
    const an = (a / 96) * Math.PI * 2;
    const x = Math.round(16 + Math.cos(an) * shell);
    const y = Math.round(16 + Math.sin(an) * shell);
    if (threshold(x, y) < 0.7) c.set(x, y, 2, 3);
  }
}

function blackHole(c: Canvas, t: number) {
  // Cyan on the approaching side, red on the receding side, a gold photon ring, a void core.
  const CY = 0;
  const RD = 1;
  const VD = 2;
  const GD = 3;
  for (let x = 1; x < 31; x++) {
    const y = 16 + Math.round((x - 16) * 0.15);
    const near = Math.abs(x - 16) < 7;
    if (near) continue;
    const ramp = x < 16 ? CY : RD;
    const step = x < 16 ? 4 : 2;
    c.set(x, y, ramp, step);
    c.set(x, y + 1, ramp, step - 1);
    if (threshold(x, y) < 0.5) c.set(x, y - 1, ramp, step - 2);
  }
  c.disc(16, 16, 6.5, (x, y, d) => {
    if (d > 0.8) c.set(x, y, GD, (Math.floor(t * 6) + x + y) % 3 ? 4 : 5);
    else c.set(x, y, VD, 0);
  });
  // The lensed arch: the far side of the disk bent over the top.
  for (let a = 0; a < 40; a++) {
    const an = Math.PI + (a / 40) * Math.PI;
    const x = Math.round(16 + Math.cos(an) * 8.5);
    const y = Math.round(15 + Math.sin(an) * 5);
    c.set(x, y, x < 16 ? CY : RD, 3);
  }
}

function planet(c: Canvas, t: number) {
  // Oceans on the cyan ramp, land on gold, the night side on void, city lights in gold.
  const OC = 0;
  const LD = 1;
  const NT = 2;
  const spin = t * 0.4;
  c.disc(16, 16, 12, (x, y, d, nx, ny) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lon = Math.atan2(nx, nz) + spin;
    const n = Math.sin(lon * 3 + ny * 4) + 0.5 * Math.sin(lon * 5 - ny * 7);
    const lit = light(nx, ny) * 0.8 + 0.35;
    if (lit < 0) {
      const city = n > 0.7 && threshold(x, y) < 0.12;
      c.set(x, y, city ? LD : NT, city ? 4 : 2);
      return;
    }
    const shade = 2 + lit * 2.8 - d * 0.6;
    c.set(x, y, n > 0.45 ? LD : OC, ditherStep(shade, x, y));
  });
}

const RAMPS: Record<SpriteKind, (main: RampName) => RampName[]> = {
  ship: (main) => [main, 'red'],
  relay: (main) => ['void', main],
  magnet: () => ['red', 'cyan', 'void', 'gold'],
  badge: (main) => ['gold', main === 'gold' ? 'red' : main],
  creature: (main) => [main, 'void'],
  star: () => ['star'],
  dying: () => ['red', 'gold', 'violet'],
  'black-hole': () => ['cyan', 'red', 'void', 'gold'],
  planet: () => ['cyan', 'gold', 'void'],
};

/**
 * Draw one frame. `key` seeds the shape and the dust; `t` is time in seconds, for the
 * animated parts. The same arguments always give the same frame.
 */
export function specimenSprite(key: string, kind: SpriteKind, main: RampName, t = 0): SpriteFrame {
  const c = new Canvas();
  const rnd = random(hash(key));
  dust(c, rnd);
  switch (kind) {
    case 'ship':
      ship(c, t);
      break;
    case 'relay':
      relay(c, t);
      break;
    case 'magnet':
      magnet(c, t);
      break;
    case 'badge':
      badge(c);
      break;
    case 'creature':
      creature(c, rnd, t);
      break;
    case 'star':
      star(c, t);
      break;
    case 'dying':
      dying(c, t);
      break;
    case 'black-hole':
      blackHole(c, t);
      break;
    case 'planet':
      planet(c, t);
      break;
  }
  return { ramps: RAMPS[kind](main), cells: c.cells };
}

/** The same frame as a dark silhouette, for specimens not scanned yet. */
export function silhouette(frame: SpriteFrame): SpriteFrame {
  const cells = frame.cells.map((v) => (v >= 0 ? 2 : v));
  return { ramps: ['void'], cells };
}
