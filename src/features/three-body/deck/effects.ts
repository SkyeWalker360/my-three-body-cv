import { bayer8 } from '@/lib/dither';
import { EFFECT, ENGINE_PALETTE } from '../engine-layout';
import type { DeckBody } from './bodies';
import { basis, type Camera, length, project, sub, type Vec3 } from './camera';
import { flux, radiance } from './exposure';
import { STELLAR_TONES } from './render';

/**
 * Living-system events seen from the deck (brief §3.1): giants' gas shells (the planetary
 * nebula), a supernova's flash and shock front, read from the engine's effects buffer and
 * drawn as rings in the orbital plane at the size the lab draws them.
 */

export type Effect = {
  kind: 'shell' | 'shock' | 'flash';
  position: Vec3;
  /** AU. */
  radius: number;
  /** 1 fresh … 0 faded. */
  strength: number;
};

/** A supernova peaks around a billion Suns; the flash fades over its ten engine frames. */
export const FLASH_LUMINOSITY = 1e9;

const BAYER = bayer8();
const P = (n: string) => ENGINE_PALETTE.indexOf(n);
const SHOCK_HOT = P('star-3');
const SHOCK = P('cyan-4');
const SHOCK_INNER = P('cyan-2');
const FLASH = P('star-3');

export function readEffects(buf: Float64Array): Effect[] {
  const n = Math.min(EFFECT.rows, Math.max(0, Math.round(buf[0]!)));
  const out: Effect[] = [];
  for (let i = 0; i < n; i++) {
    const o = 1 + i * EFFECT.width;
    const k = buf[o + EFFECT.kind]!;
    out.push({
      kind: k === EFFECT.shell ? 'shell' : k === EFFECT.shock ? 'shock' : 'flash',
      position: [buf[o + EFFECT.x]!, buf[o + EFFECT.y]!, 0],
      radius: buf[o + EFFECT.radius]!,
      strength: buf[o + EFFECT.strength]!,
    });
  }
  return out;
}

/** Radiance of a visible flash (for auto-exposure): it clamps the exposure like real glare. */
export function flashRadiance(e: Effect, cam: Camera, omega: number): number {
  if (e.kind !== 'flash') return 0;
  const b = basis(cam);
  const p = project(b, cam, e.position);
  if (!p || p.x < 0 || p.y < 0 || p.x >= cam.width || p.y >= cam.height) return 0;
  const d = Math.max(1e-3, length(sub(e.position, cam.position)));
  return radiance(flux(FLASH_LUMINOSITY * e.strength, d), 0, omega);
}

function ring(
  out: Uint8Array,
  cam: Camera,
  centre: Vec3,
  r: number,
  strength: number,
  colour: number,
) {
  const { width: W, height: H } = cam;
  const b = basis(cam);
  const c = project(b, cam, centre);
  const edge = project(b, cam, [centre[0] + r, centre[1], 0]);
  const span = c && edge ? Math.hypot(edge.x - c.x, edge.y - c.y) : 50;
  const steps = Math.max(24, Math.min(720, Math.round(span * 7)));
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const p = project(b, cam, [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), 0]);
    if (!p) continue;
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    // Fading rings thin out by dithering rather than blending.
    if (strength > BAYER[(y & 7) * 8 + (x & 7)]!) out[y * W + x] = colour;
  }
}

/** Draws shells, shocks and the flash; a shell around the platform shows as haze. */
export function drawEffects(
  out: Uint8Array,
  cam: Camera,
  effects: readonly Effect[],
  bodies: readonly DeckBody[],
) {
  const { width: W, height: H } = cam;
  for (const e of effects) {
    if (e.kind === 'shell') {
      const star = nearestStar(bodies, e.position);
      const tones = STELLAR_TONES[Math.max(0, Math.min(5, star?.colourClass ?? 2))]!;
      ring(out, cam, e.position, e.radius, e.strength * 0.85, P(tones[2]!));
      const inside = length(sub(cam.position, e.position)) < e.radius;
      if (inside) {
        // The nebula washing over the deck: a sparse dithered haze in the star's tones.
        const haze = P(tones[4]!);
        const amount = e.strength * 0.18;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (BAYER[(y & 7) * 8 + (x & 7)]! < amount) out[y * W + x] = haze;
      }
    } else if (e.kind === 'shock') {
      ring(out, cam, e.position, e.radius, e.strength, e.strength > 0.75 ? SHOCK_HOT : SHOCK);
      ring(out, cam, e.position, e.radius * 0.74, e.strength * 0.5, SHOCK_INNER);
    } else {
      const b = basis(cam);
      const p = project(b, cam, e.position);
      if (!p) continue;
      const r = 2 + e.strength * 6;
      for (let y = Math.floor(p.y - r); y <= p.y + r; y++)
        for (let x = Math.floor(p.x - r); x <= p.x + r; x++)
          if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - p.x, y - p.y) <= r)
            out[y * W + x] = FLASH;
    }
  }
}

function nearestStar(bodies: readonly DeckBody[], at: Vec3): DeckBody | undefined {
  let best: DeckBody | undefined;
  let bestD = Infinity;
  for (const b of bodies) {
    if (b.kind !== 'star') continue;
    const d = length(sub(b.position, at));
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
