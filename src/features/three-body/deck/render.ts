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
  pixelRadius,
  project,
  projectDirection,
  sub,
  type Vec3,
} from './camera';
import { visibleFraction } from './eclipse';
import { flux, magnitudeFlux, radiance, tone } from './exposure';
import { B_CRIT, blueshift, deflection } from './lensing';

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

/**
 * The starfield as a cubemap of magnitudes (six faces of size × size texels), sampled per
 * pixel when lensing. Cube faces need no trigonometry to look up.
 */
/**
 * `flux` is in Suns at 1 AU (0 where there is no star); `band` is each texel's distance from
 * the galactic plane (|sin latitude|), for the Milky Way.
 */
export type SkyMap = { size: number; flux: Float32Array; colour: Uint8Array; band: Float32Array };

export function makeSkyMap(sky: readonly SkyStar[], size = 256): SkyMap {
  const flux = new Float32Array(6 * size * size);
  const colour = new Uint8Array(6 * size * size);
  for (const s of sky) {
    const i = cubeTexel(s.direction[0], s.direction[1], s.direction[2], size);
    const f = magnitudeFlux(s.magnitude);
    if (f > flux[i]!) {
      flux[i] = f;
      colour[i] = s.colour;
    }
  }
  const band = new Float32Array(6 * size * size);
  for (let face = 0; face < 6; face++) {
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const u = ((tx + 0.5) / size) * 2 - 1;
        const v = ((ty + 0.5) / size) * 2 - 1;
        const s = face & 1 ? -1 : 1;
        const d: Vec3 = face < 2 ? [s, u, v] : face < 4 ? [u, s, v] : [u, v, s];
        band[(face * size + ty) * size + tx] = Math.abs(dot(normalize(d), GALACTIC_POLE));
      }
    }
  }
  return { size, flux, colour, band };
}

/** Texel index of direction (x, y, z) in a cubemap with faces of `size` texels. */
export function cubeTexel(x: number, y: number, z: number, size: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  let face: number;
  let u: number;
  let v: number;
  if (ax >= ay && ax >= az) {
    face = x > 0 ? 0 : 1;
    u = y / ax;
    v = z / ax;
  } else if (ay >= az) {
    face = y > 0 ? 2 : 3;
    u = x / ay;
    v = z / ay;
  } else {
    face = z > 0 ? 4 : 5;
    u = x / az;
    v = y / az;
  }
  const tx = Math.min(size - 1, Math.floor(((u + 1) / 2) * size));
  const ty = Math.min(size - 1, Math.floor(((v + 1) / 2) * size));
  return (face * size + ty) * size + tx;
}

/** A black hole close enough to lens the view: its position (AU) and Schwarzschild radius (AU). */
export type Lens = { position: Vec3; rs: number; map: SkyMap };

/** Beyond this many Schwarzschild radii the lensing is far below a pixel: skip the pass. */
export const LENS_RANGE = 5000;

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
  /** Gravitational blueshift of incoming light at the platform (1 = none). */
  shift: number;
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
  lens: Lens | null = null,
): Frame {
  const { width: W, height: H } = cam;
  const b = basis(cam);
  const omega = pixelSolidAngle(b);
  out.fill(BG, 0, W * H);

  const toHole = lens ? sub(lens.position, cam.position) : null;
  const r = lens && toHole ? length(toHole) / lens.rs : Infinity;
  const lensing = lens !== null && toHole !== null && r < LENS_RANGE;
  const shift = lensing ? blueshift(r) : 1;
  // Bluer light moves colours up the stellar ramp: about one step per 4% of shift.
  const classShift = Math.round((shift - 1) * 25);
  const tonesFor = (c: number) => TONES[Math.max(0, Math.min(5, c + classShift))]!;
  const bandTone = tone(magnitudeFlux(4) / omega / 40, exposure);

  if (lensing) {
    drawLensedSky(out, b, cam, lens!, normalize(toHole!), r, exposure, omega, bandTone, tonesFor);
  } else {
    // Sky: the Milky Way band and the starfield, both at fixed directions.
    if (bandTone > 0) drawBand(out, b, cam, bandTone);
    for (const s of sky) {
      const p = projectDirection(b, cam, s.direction);
      if (!p) continue;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const v = tone(magnitudeFlux(s.magnitude) / omega, exposure);
      if (v <= 0) continue;
      const c = v > 0.85 ? tonesFor(s.colour)[1]! : SKY_STARS[Math.min(3, Math.floor(v * 4))]!;
      if (v > 0.25 || v * 4 > threshold(x, y)) out[y * W + x] = c;
    }
  }

  // Bodies, far to near, so nearer ones occlude.
  const stars = bodies.filter((s) => s.luminosity > 0);
  const visible: OnScreen[] = [];
  let peak = 0;
  const order = bodies
    .map((body) => ({ body, d: length(sub(body.position, cam.position)) }))
    .sort((a, c) => c.d - a.d);

  for (const { body, d } of order) {
    const hole = body.kind === 'star' && body.phase === 'Black hole';
    // Up close the lensing pass draws the hole (its shadow) instead.
    if (hole && lensing) continue;
    const p = project(b, cam, body.position);
    if (!p) continue;
    const theta = angularRadius(body.radius, d);
    const pr = pixelRadius(b, theta);
    if (p.x < -pr - 2 || p.y < -pr - 2 || p.x > W + pr + 2 || p.y > H + pr + 2) continue;

    let t = 0;
    if (hole) {
      drawBlackHole(out, W, H, p.x, p.y, Math.max(1, pr), time);
    } else if (body.luminosity > 0) {
      const rad = radiance(flux(body.luminosity, d) * shift ** 4, theta, omega);
      peak = Math.max(peak, rad);
      t = tone(rad, exposure);
      drawStar(out, W, H, p.x, p.y, pr, t, tonesFor(body.colourClass));
    } else if (body.kind === 'planet') {
      t = drawPlanet(out, W, H, b, body, p.x, p.y, pr, stars, bodies, exposure, time);
    }
    visible.push({ body, x: p.x, y: p.y, r: pr, distance: d, theta, tone: t });
  }

  if (lensing) {
    const centre = projectDirection(b, cam, toHole!);
    drawShadow(out, cam, centre?.x ?? W / 2, centre?.y ?? H / 2, time);
  }
  return { peak, onScreen: visible, pixelSolidAngle: omega, shift };
}

/** The Milky Way band, with the view direction worked out in scalars (no allocation). */
function drawBand(out: Uint8Array, b: Basis, cam: Camera, bandTone: number) {
  const { width: W, height: H } = cam;
  const [fx, fy, fz] = b.forward;
  const [rx, ry, rz] = b.right;
  const [ux, uy, uz] = b.up;
  const [gx, gy, gz] = GALACTIC_POLE;
  // dot(d, pole) is linear in the pixel offsets before normalising.
  const g0 = (fx * gx + fy * gy + fz * gz) * b.focal;
  const gr = rx * gx + ry * gy + rz * gz;
  const gu = ux * gx + uy * gy + uz * gz;
  for (let y = 0; y < H; y++) {
    const dyp = H / 2 - (y + 0.5);
    for (let x = 0; x < W; x++) {
      const dxp = x + 0.5 - W / 2;
      const lat =
        Math.abs(g0 + gr * dxp + gu * dyp) / Math.sqrt(b.focal * b.focal + dxp * dxp + dyp * dyp);
      if (lat > BAND_WIDTH) continue;
      const v = bandTone * (1 - lat / BAND_WIDTH) * (0.5 + 0.5 * hash(x >> 2, y >> 2));
      if (v > threshold(x, y)) out[y * W + x] = BAND[v > 0.6 ? 1 : 0]!;
    }
  }
}

/**
 * cos α and sin α tabulated over q = b_c / b in (0, 1), so the per-pixel loop needs no
 * logarithm or trigonometry for the bend. Near q = 1 the bend diverges; the last entries
 * cover a ring far thinner than a pixel.
 */
const LUT_SIZE = 8192;
const LUT_COS = new Float32Array(LUT_SIZE);
const LUT_SIN = new Float32Array(LUT_SIZE);
for (let k = 0; k < LUT_SIZE; k++) {
  const q = (k + 0.5) / LUT_SIZE;
  const alpha = deflection(B_CRIT / q);
  LUT_COS[k] = Math.cos(alpha);
  LUT_SIN[k] = Math.sin(alpha);
}

/** Reused between frames so the lensing pass never allocates. */
let shadowMask = new Uint8Array(0);

/**
 * The sky seen past the hole: every pixel's ray is bent back to where it really comes from
 * and the starfield map is sampled there, so the background warps into arcs and an Einstein
 * ring. Rays that end in the hole are marked in `shadowMask` and drawn after the bodies.
 * Scalar maths only: the rotation toward the hole by α is
 * src = d cos α + (h − d cos ψ) sin α / sin ψ.
 */
/** Per-frame ray parameters and the traced direction, as typed arrays (fast, no closures). */
const RAY_P = new Float64Array(16);
const RAY = new Float64Array(3);
const LENS_SMOOTH = B_CRIT * 1.6;
const RING_OUTER = B_CRIT * 1.05;

/**
 * Traces the ray through pixel centre (x, y) back to the sky, into RAY. Returns 0 sky,
 * 1 shadow, 2 photon ring, plus 4 where the bend varies slowly enough to interpolate.
 * RAY_P: forward(0–2) right(3–5) up(6–8) toHole(9–11) focal(12) W/2(13) H/2(14) r(15).
 */
function traceRay(x: number, y: number): number {
  const P = RAY_P;
  const dxp = x + 0.5 - P[13]!;
  const dyp = P[14]! - (y + 0.5);
  const f = P[12]!;
  let dx = P[0]! * f + P[3]! * dxp + P[6]! * dyp;
  let dy = P[1]! * f + P[4]! * dxp + P[7]! * dyp;
  let dz = P[2]! * f + P[5]! * dxp + P[8]! * dyp;
  const n = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx *= n;
  dy *= n;
  dz *= n;
  const hx = P[9]!;
  const hy = P[10]!;
  const hz = P[11]!;
  const r = P[15]!;
  let cosPsi = dx * hx + dy * hy + dz * hz;
  if (cosPsi > 1) cosPsi = 1;
  else if (cosPsi < -1) cosPsi = -1;
  const sinPsi = Math.sqrt(1 - cosPsi * cosPsi);
  const bi = (r * sinPsi) / Math.sqrt(1 - 1 / r);
  let kind = 0;
  if (cosPsi > 0 && bi <= RING_OUTER) kind = bi <= B_CRIT ? 1 : 2;
  if (kind !== 1 && sinPsi > 1e-9) {
    const at = Math.min(LUT_SIZE - 1, Math.floor((B_CRIT / bi) * LUT_SIZE));
    const ca = LUT_COS[at]!;
    const k = LUT_SIN[at]! / sinPsi;
    RAY[0] = dx * ca + (hx - dx * cosPsi) * k;
    RAY[1] = dy * ca + (hy - dy * cosPsi) * k;
    RAY[2] = dz * ca + (hz - dz * cosPsi) * k;
  } else {
    RAY[0] = dx;
    RAY[1] = dy;
    RAY[2] = dz;
  }
  return kind + (bi > LENS_SMOOTH || cosPsi <= 0 ? 4 : 0);
}

/**
 * Per-pixel lensing results, cached while the view geometry (orientation, zoom, direction and
 * distance to the hole) stays put: riding with the hole, that's every frame until the visitor
 * looks around. Each pixel stores its sky texel, or −1 (shadow) / −2 (ring, texel in lensRing).
 */
const lensKey = new Float64Array(18);
let lensTexel = new Int32Array(0);
let lensRing = new Uint8Array(0);

function lensGeometry(b: Basis, cam: Camera, toHole: Vec3, r: number, size: number) {
  const { width: W, height: H } = cam;
  const key = [...b.forward, ...b.right, ...b.up, ...toHole, b.focal, W, H, r, size];
  let same = lensTexel.length === W * H;
  for (let k = 0; k < key.length && same; k++) same = Math.abs(lensKey[k]! - key[k]!) < 1e-9;
  if (same) return;
  lensKey.set(key);
  lensTexel = new Int32Array(W * H);
  lensRing = new Uint8Array(W * H);
  // Exact rays on a grid of every other pixel; pixels between smooth grid points interpolate.
  const GW = (W >> 1) + 2;
  const GH = (H >> 1) + 2;
  const gx = new Float32Array(GW * GH);
  const gy = new Float32Array(GW * GH);
  const gz = new Float32Array(GW * GH);
  const gk = new Uint8Array(GW * GH);
  RAY_P.set([...b.forward, ...b.right, ...b.up, ...toHole, b.focal, W / 2, H / 2, r]);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const g = j * GW + i;
      gk[g] = traceRay(i * 2, j * 2);
      gx[g] = RAY[0]!;
      gy[g] = RAY[1]!;
      gz[g] = RAY[2]!;
    }
  }
  for (let y = 0; y < H; y++) {
    const j0 = y >> 1;
    const wy = y & 1 ? 0.5 : 0;
    for (let x = 0; x < W; x++) {
      const g00 = j0 * GW + (x >> 1);
      const g01 = g00 + GW;
      let kind: number;
      let sx: number;
      let sy: number;
      let sz: number;
      if (wy === 0 && (x & 1) === 0) {
        kind = gk[g00]!;
        sx = gx[g00]!;
        sy = gy[g00]!;
        sz = gz[g00]!;
      } else if (gk[g00]! & gk[g00 + 1]! & gk[g01]! & gk[g01 + 1]! & 4) {
        // All four corners are smooth: interpolate (the cube lookup needs no normalising).
        const wx = x & 1 ? 0.5 : 0;
        const a = (1 - wx) * (1 - wy);
        const bb = wx * (1 - wy);
        const c = (1 - wx) * wy;
        const d = wx * wy;
        sx = gx[g00]! * a + gx[g00 + 1]! * bb + gx[g01]! * c + gx[g01 + 1]! * d;
        sy = gy[g00]! * a + gy[g00 + 1]! * bb + gy[g01]! * c + gy[g01 + 1]! * d;
        sz = gz[g00]! * a + gz[g00 + 1]! * bb + gz[g01]! * c + gz[g01 + 1]! * d;
        kind = 4;
      } else {
        kind = traceRay(x, y);
        sx = RAY[0]!;
        sy = RAY[1]!;
        sz = RAY[2]!;
      }
      const i = y * W + x;
      const k = kind & 3;
      lensTexel[i] = k === 1 ? -1 : cubeTexel(sx, sy, sz, size);
      lensRing[i] = k === 2 ? 1 : 0;
    }
  }
}

function drawLensedSky(
  out: Uint8Array,
  b: Basis,
  cam: Camera,
  lens: Lens,
  toHole: Vec3,
  r: number,
  exposure: number,
  omega: number,
  bandTone: number,
  tonesFor: (c: number) => number[],
) {
  const { width: W, height: H } = cam;
  const map = lens.map;
  lensGeometry(b, cam, toHole, r, map.size);
  if (shadowMask.length < W * H) shadowMask = new Uint8Array(W * H);
  const mask = shadowMask;
  const texel = lensTexel;
  const ring = lensRing;
  const flux = map.flux;
  const colour = map.colour;
  const band = map.band;
  const starScale = 4 / Math.max(omega, (4 / map.size) ** 2);
  for (let i = 0; i < W * H; i++) {
    const t = texel[i]!;
    if (t < 0) {
      mask[i] = 1;
      continue;
    }
    mask[i] = ring[i]! ? 2 : 0;
    const f = flux[t]!;
    if (f > 0) {
      const v = tone(f * starScale, exposure);
      if (v > 0.15) {
        out[i] = v > 0.85 ? tonesFor(colour[t]!)[1]! : SKY_STARS[Math.min(3, Math.floor(v * 4))]!;
        continue;
      }
    }
    if (bandTone > 0) {
      const lat = band[t]!;
      if (lat < BAND_WIDTH) {
        const x = i % W;
        const y = (i / W) | 0;
        const bv = bandTone * (1 - lat / BAND_WIDTH) * (0.5 + 0.5 * hash(x >> 2, y >> 2));
        if (bv > threshold(x, y)) out[i] = BAND[bv > 0.6 ? 1 : 0]!;
      }
    }
  }
}

/** The shadow, and the thin photon ring at its edge (cyan on the approaching side, red receding). */
function drawShadow(out: Uint8Array, cam: Camera, holeX: number, holeY: number, time: number) {
  const { width: W, height: H } = cam;
  const spin = time * 0.6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = shadowMask[y * W + x];
      if (!m) continue;
      if (m === 1) out[y * W + x] = SHADOW;
      else {
        const side = Math.atan2(holeY - (y + 0.5), x + 0.5 - holeX);
        out[y * W + x] = RING[Math.cos(side - spin) > 0 ? 0 : 1]!;
      }
    }
  }
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
  body: DeckBody,
  cx: number,
  cy: number,
  r: number,
  stars: readonly DeckBody[],
  bodies: readonly DeckBody[],
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
      // Starlight the planet itself can see: another body crossing a star eclipses it.
      f: flux(s.luminosity, dist) * visibleFraction(body.position, s, bodies, body),
    };
  });
  const ramp = PLANET_RAMPS[body.era ?? 'Stable'] ?? PLANET_RAMPS.Stable!;
  const omega = pixelSolidAngle(b);
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
