import { bayer8 } from '@/lib/dither';
import { ENGINE_PALETTE } from '../engine-layout';
import type { DeckBody } from './bodies';
import {
  angularRadius,
  basis,
  type Basis,
  type Camera,
  dot,
  length,
  normalize,
  pixelDirection,
  pixelRadius,
  project,
  projectDirection,
  sub,
  type Vec3,
} from './camera';
import { flux, magnitudeFlux, radiance, tone } from './exposure';

/**
 * Draws the view from the platform into a buffer of palette indices (the engine's palette,
 * so the same colour table turns it into pixels). Sky first, then bodies far to near, each
 * at its angular size and lit by every star. Pure apart from writing `out`.
 */

const BAYER = bayer8();
const threshold = (x: number, y: number) => BAYER[(y & 7) * 8 + (x & 7)]!;

const P = (name: string) => {
  const i = ENGINE_PALETTE.indexOf(name);
  if (i < 0) throw new Error(`no palette entry ${name}`);
  return i;
};

/**
 * Shading tones per stellar class, brightest first: a mirror of raster.StellarTones in the Go
 * engine (checked by a unit test), so stars look the same in the deck as in the lab.
 */
export const STELLAR_TONES: readonly (readonly string[])[] = [
  ['star-1', 'star-0', 'red-2', 'red-1', 'red-0'],
  ['star-2', 'star-1', 'star-0', 'red-2', 'red-1'],
  ['star-3', 'star-2', 'star-1', 'gold-1', 'gold-0'],
  ['star-3', 'gold-5', 'gold-4', 'star-2', 'gold-2'],
  ['star-3', 'star-4', 'star-5', 'cyan-2', 'void-2'],
  ['star-3', 'star-4', 'star-5', 'violet-3', 'violet-2'],
];
const TONES = STELLAR_TONES.map((t) => t.map(P));

/** Planet ramps by era: lit steps from dim to bright. */
const PLANET_RAMPS: Record<string, number[]> = {
  Stable: ['cyan-1', 'cyan-2', 'cyan-3', 'cyan-4', 'cyan-5'].map(P),
  Scorched: ['red-1', 'red-2', 'red-3', 'red-4', 'red-5'].map(P),
  Frozen: ['void-3', 'void-4', 'void-5', 'cyan-5', 'ink'].map(P),
};
const LAND = ['void-2', 'green', 'green', 'gold-3', 'gold-4'].map(P);

const BG = P('void-0');
const BAND = [P('void-1'), P('void-2')];
const SKY_STARS = [P('void-3'), P('void-4'), P('ink-muted'), P('ink')];
const WHITE = P('star-3');
const SHADOW = P('void-0');
const RING = [P('cyan-4'), P('red-3')];
const CITY = P('gold-3');

/** Galactic north pole of the backdrop, so the Milky Way band sits at a slant. */
const GALACTIC_POLE: Vec3 = normalize([0.35, -0.55, 0.76]);
const BAND_WIDTH = 0.22;

export type SkyStar = { direction: Vec3; magnitude: number; colour: number };

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The distant starfield: fixed directions (no parallax), magnitudes −1.5 to 6. */
export function makeSky(count = 1400, seed = 318): SkyStar[] {
  const random = mulberry(seed);
  return Array.from({ length: count }, () => {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    // More faint stars than bright ones, as in the real sky.
    const magnitude = 6 - 7.5 * random() ** 3;
    return {
      direction: [s * Math.cos(a), s * Math.sin(a), z] as Vec3,
      magnitude,
      colour: Math.floor(random() * 6),
    };
  });
}

export type OnScreen = {
  body: DeckBody;
  x: number;
  y: number;
  /** Pixel radius as drawn. */
  r: number;
  distance: number;
  /** Angular radius, radians (of the drawn compact-scale body). */
  theta: number;
  tone: number;
};

export type Frame = {
  /** Brightest radiance in view, for auto-exposure. */
  peak: number;
  onScreen: OnScreen[];
  pixelSolidAngle: number;
};

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tone index (0 brightest … 4 dimmest, 5 = background) for a lit value in [0, 1], dithered. */
function shade(v: number, x: number, y: number): number {
  const level = (1 - Math.min(1, v)) * 5;
  const i = Math.floor(level);
  return Math.min(5, i + (level - i > threshold(x, y) ? 1 : 0));
}

/** Pixels per radian squared → solid angle of one pixel. */
export const pixelSolidAngle = (b: Basis) => 1 / (b.focal * b.focal);

/** Sums the radiance of every star in view (for auto-exposure) without drawing. */
export function measure(bodies: readonly DeckBody[], cam: Camera): number {
  const b = basis(cam);
  const omega = pixelSolidAngle(b);
  let peak = 0;
  for (const body of bodies) {
    if (body.luminosity <= 0) continue;
    const d = length(sub(body.position, cam.position));
    const p = project(b, cam, body.position);
    const theta = angularRadius(body.radius, d);
    const pr = pixelRadius(b, theta);
    if (!p || p.x < -pr || p.y < -pr || p.x > cam.width + pr || p.y > cam.height + pr) continue;
    peak = Math.max(peak, radiance(flux(body.luminosity, d), theta, omega));
  }
  return peak;
}

export function renderDeck(
  out: Uint8Array,
  cam: Camera,
  bodies: readonly DeckBody[],
  sky: readonly SkyStar[],
  exposure: number,
  time: number,
): Frame {
  const { width: W, height: H } = cam;
  const b = basis(cam);
  const omega = pixelSolidAngle(b);
  out.fill(BG, 0, W * H);

  // Sky: the Milky Way band and the starfield, both at fixed directions.
  const bandTone = tone(magnitudeFlux(4) / omega / 40, exposure);
  if (bandTone > 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = pixelDirection(b, cam, x + 0.5, y + 0.5);
        const lat = Math.abs(dot(d, GALACTIC_POLE));
        if (lat > BAND_WIDTH) continue;
        const v = bandTone * (1 - lat / BAND_WIDTH) * (0.5 + 0.5 * hash(x >> 2, y >> 2));
        if (v > threshold(x, y)) out[y * W + x] = BAND[v > 0.6 ? 1 : 0]!;
      }
    }
  }
  for (const s of sky) {
    const p = projectDirection(b, cam, s.direction);
    if (!p) continue;
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const v = tone(magnitudeFlux(s.magnitude) / omega, exposure);
    if (v <= 0) continue;
    const c = v > 0.85 ? TONES[s.colour]![1]! : SKY_STARS[Math.min(3, Math.floor(v * 4))]!;
    if (v > 0.25 || v * 4 > threshold(x, y)) out[y * W + x] = c;
  }

  // Bodies, far to near, so nearer ones occlude.
  const stars = bodies.filter((s) => s.luminosity > 0);
  const visible: OnScreen[] = [];
  let peak = 0;
  const order = bodies
    .map((body) => ({ body, d: length(sub(body.position, cam.position)) }))
    .sort((a, c) => c.d - a.d);

  for (const { body, d } of order) {
    const p = project(b, cam, body.position);
    if (!p) continue;
    const theta = angularRadius(body.radius, d);
    const r = pixelRadius(b, theta);
    if (p.x < -r - 2 || p.y < -r - 2 || p.x > W + r + 2 || p.y > H + r + 2) continue;

    let t = 0;
    if (body.kind === 'star' && body.phase === 'Black hole') {
      drawBlackHole(out, W, H, p.x, p.y, Math.max(1, r), time);
    } else if (body.luminosity > 0) {
      const rad = radiance(flux(body.luminosity, d), theta, omega);
      peak = Math.max(peak, rad);
      t = tone(rad, exposure);
      drawStar(out, W, H, p.x, p.y, r, t, TONES[Math.max(0, Math.min(5, body.colourClass))]!);
    } else if (body.kind === 'planet') {
      t = drawPlanet(out, W, H, b, cam, body, p.x, p.y, r, stars, exposure, time);
    }
    visible.push({ body, x: p.x, y: p.y, r, distance: d, theta, tone: t });
  }
  return { peak, onScreen: visible, pixelSolidAngle: omega };
}

function drawStar(
  out: Uint8Array,
  W: number,
  H: number,
  cx: number,
  cy: number,
  r: number,
  t: number,
  tones: readonly number[],
) {
  if (t <= 0) return;
  const over = t > 1.4;
  if (r < 0.75) {
    // Unresolved: a single point, with a cross of glow when it's bright.
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const put = (px: number, py: number, c: number) => {
      if (px >= 0 && py >= 0 && px < W && py < H) out[py * W + px] = c;
    };
    if (t < 0.35 && t * 2.5 < threshold(x, y)) return;
    put(x, y, over ? WHITE : tones[t > 0.6 ? 0 : 2]!);
    if (t > 0.85)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        put(x + dx, y + dy, tones[3]!);
    return;
  }
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const q = (dx * dx + dy * dy) / r2;
      if (q > 1) continue;
      // Linear limb darkening, I(μ) = 1 − 0.6(1 − μ), scaled by the exposure tone.
      const mu = Math.sqrt(1 - q);
      const v = Math.min(1, t) * (1 - 0.6 * (1 - mu));
      if (over && mu > 0.35) {
        out[y * W + x] = WHITE;
        continue;
      }
      const i = shade(v, x, y);
      if (i < 5) out[y * W + x] = tones[i]!;
    }
  }
}

/**
 * The black hole without lensing (that pass comes later): the shadow, 2.6 × r_s across in
 * reality and drawn at the lab's size here, ringed by a thin photon ring whose bright side is
 * cyan and dim side red (Doppler beaming of the disk, in site colours).
 */
function drawBlackHole(
  out: Uint8Array,
  W: number,
  H: number,
  cx: number,
  cy: number,
  r: number,
  time: number,
) {
  const ring = r + 1.2;
  const x0 = Math.max(0, Math.floor(cx - ring - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + ring + 1));
  const y0 = Math.max(0, Math.floor(cy - ring - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + ring + 1));
  const spin = time * 0.6;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d <= r) out[y * W + x] = SHADOW;
      else if (d <= ring) {
        const bright = Math.cos(Math.atan2(dy, dx) - spin) > 0;
        out[y * W + x] = RING[bright ? 0 : 1]!;
      }
    }
  }
}

/**
 * A planet lit by every star at once: each pixel's surface normal is dotted with the
 * direction to each star and weighted by that star's flux, so phases (including two-sided
 * ones) follow the real geometry. Returns the peak tone drawn.
 */
function drawPlanet(
  out: Uint8Array,
  W: number,
  H: number,
  b: Basis,
  cam: Camera,
  body: DeckBody,
  cx: number,
  cy: number,
  r: number,
  stars: readonly DeckBody[],
  exposure: number,
  time: number,
): number {
  const albedo = 0.3;
  const lights = stars.map((s) => {
    const to = sub(s.position, body.position);
    const dist = length(to);
    const dir = normalize(to);
    return {
      // Light direction in camera space (right, up, back toward the viewer).
      l: [dot(dir, b.right), dot(dir, b.up), -dot(dir, b.forward)] as Vec3,
      f: flux(s.luminosity, dist),
    };
  });
  const ramp = PLANET_RAMPS[body.era ?? 'Stable'] ?? PLANET_RAMPS.Stable!;
  const omega = pixelSolidAngle(b);
  void cam;
  if (r < 0.75) {
    // A point: brightness from the illuminated fraction, averaged over stars.
    let f = 0;
    for (const { l, f: fl } of lights) f += fl * (1 + l[2]) * 0.5;
    const theta = Math.atan(r / b.focal);
    const t = tone(((albedo / Math.PI) * f * Math.PI * theta * theta) / omega, exposure);
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    if (t > threshold(x, y) * 0.5 && x >= 0 && y >= 0 && x < W && y < H)
      out[y * W + x] = ramp[Math.min(4, Math.floor(t * 5))]!;
    return t;
  }
  let peak = 0;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const spin = time * 0.15;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (cy - (y + 0.5)) / r;
      const q = nx * nx + ny * ny;
      if (q > 1) continue;
      // Camera space is (right, up, back): the visible hemisphere's normals point back at us.
      const nz = Math.sqrt(1 - q);
      let e = 0;
      for (const { l, f } of lights) e += f * Math.max(0, nx * l[0] + ny * l[1] + nz * l[2]);
      const t = tone((albedo / Math.PI) * e, exposure);
      peak = Math.max(peak, t);
      const i = y * W + x;
      // Continents from noise in surface coordinates, turning with the planet.
      const land = hash(Math.floor((Math.atan2(nx, nz) + spin) * 6), Math.floor(ny * 6)) > 0.62;
      if (t <= 0.05) {
        out[i] = body.lights && land && hash(x, y) < 0.18 ? CITY : BG;
        continue;
      }
      const s = shade(t, x, y);
      out[i] = s >= 5 ? BG : (land && body.era === 'Stable' ? LAND : ramp)[4 - s]!;
    }
  }
  return peak;
}
