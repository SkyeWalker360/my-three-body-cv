import { bayer8 } from '@/lib/dither';
import { ENGINE_PALETTE } from '../engine-layout';
import type { DeckBody } from './bodies';
import { basis, type Camera, project, type Vec3 } from './camera';
import { contour, effectivePotential, lagrangeJacobi, lagrangePoints } from './instruments';

/**
 * Console overlays drawn into the view (brief §4): orbit trails, Lagrange points and Jacobi
 * zero-velocity contours. All off by default for a clean view, all in palette colours.
 */

export type Overlays = { trails: boolean; lagrange: boolean; jacobi: boolean; labels: boolean };
export const NO_OVERLAYS: Overlays = {
  trails: false,
  lagrange: false,
  jacobi: false,
  labels: false,
};

const BAYER = bayer8();
const P = (n: string) => ENGINE_PALETTE.indexOf(n);
const TRAIL = [P('void-3'), P('void-4'), P('cyan-2')];
const LAGRANGE = P('violet-4');
const JACOBI = [P('violet-2'), P('violet-3'), P('violet-4')];

export const TRAIL_LENGTH = 160;

/** A fixed-size ring of past positions per star. */
export class Trails {
  readonly points: Vec3[][] = [[], [], []];
  private last = -Infinity;

  record(bodies: readonly DeckBody[], simTime: number, every = 0.02) {
    if (simTime < this.last) this.clear();
    if (simTime - this.last < every) return;
    this.last = simTime;
    for (const b of bodies) {
      if (b.kind !== 'star' || b.star < 0) continue;
      const list = this.points[b.star]!;
      list.push(b.position);
      if (list.length > TRAIL_LENGTH) list.shift();
    }
  }

  clear() {
    this.points.forEach((p) => (p.length = 0));
    this.last = -Infinity;
  }
}

/** Bresenham line in palette index `c`, optionally dotted. */
function line(
  out: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: number,
  dotted = false,
) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2048; n++) {
    if (x >= 0 && y >= 0 && x < W && y < H && (!dotted || ((x + y) & 1) === 0)) out[y * W + x] = c;
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function drawOverlays(
  out: Uint8Array,
  cam: Camera,
  bodies: readonly DeckBody[],
  trails: Trails,
  o: Overlays,
) {
  const { width: W, height: H } = cam;
  const b = basis(cam);

  if (o.trails) {
    for (const list of trails.points) {
      for (let i = 1; i < list.length; i++) {
        const p = project(b, cam, list[i - 1]!);
        const q = project(b, cam, list[i]!);
        if (!p || !q) continue;
        const age = i / list.length;
        const x = Math.round(q.x);
        const y = Math.round(q.y);
        // Older points thin out by dithering, newer ones brighten up the ramp.
        if (age < BAYER[(y & 7) * 8 + (x & 7)]! * 0.9) continue;
        line(out, W, H, p.x, p.y, q.x, q.y, TRAIL[Math.min(2, Math.floor(age * 3))]!);
      }
    }
  }

  const stars = bodies.filter((s) => s.kind === 'star').sort((s, t) => t.mass - s.mass);
  if ((o.lagrange || o.jacobi) && stars.length >= 2) {
    const [a, c] = stars as [DeckBody, DeckBody];
    if (o.lagrange) {
      for (const pt of lagrangePoints(a, c)) {
        const p = project(b, cam, pt);
        if (!p) continue;
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        for (let k = -2; k <= 2; k++) {
          if (k === 0) continue;
          for (const [px, py] of [
            [x + k, y],
            [x, y + k],
          ] as const)
            if (px >= 0 && py >= 0 && px < W && py < H) out[py * W + px] = LAGRANGE;
        }
      }
    }
    if (o.jacobi) drawJacobi(out, cam, a, c);
  }
}

/** Zero-velocity curves at the Jacobi constants of L1, L2 and L3, in the pair's rotating frame. */
function drawJacobi(out: Uint8Array, cam: Camera, a: DeckBody, c: DeckBody) {
  const { width: W, height: H } = cam;
  const b = basis(cam);
  const M = a.mass + c.mass;
  const mu = c.mass / M;
  const dx = c.position[0] - a.position[0];
  const dy = c.position[1] - a.position[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const cx = (a.position[0] * a.mass + c.position[0] * c.mass) / M;
  const cy = (a.position[1] * a.mass + c.position[1] * c.mass) / M;
  const n = 64;
  const span = 1.8;
  const grid = new Float64Array(n * n);
  const toLocal = (i: number) => -span + (2 * span * i) / (n - 1);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      grid[j * n + i] = 2 * effectivePotential(toLocal(i), toLocal(j), mu);
  const toWorld = (gx: number, gy: number): Vec3 => {
    const x = toLocal(gx);
    const y = toLocal(gy);
    return [cx + (x * ux - y * uy) * d, cy + (x * uy + y * ux) * d, 0];
  };
  lagrangeJacobi(mu).forEach((level, k) => {
    for (const [x0, y0, x1, y1] of contour(grid, n, level)) {
      const p = project(b, cam, toWorld(x0, y0));
      const q = project(b, cam, toWorld(x1, y1));
      if (p && q) line(out, W, H, p.x, p.y, q.x, q.y, JACOBI[k]!);
    }
  });
}
