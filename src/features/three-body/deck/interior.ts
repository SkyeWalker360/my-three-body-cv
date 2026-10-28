import { bayer8 } from '@/lib/dither';
import { larsonLevels } from '@/lib/larson';
import { ENGINE_PALETTE } from '../engine-layout';
import { STELLAR_TONES } from './render';

/**
 * The observation dome's frame, drawn over the view: a large window with a thin frame
 * (Luke, 28 Oct), K.A.R.L.'s 12-cell scanner bar along the top, a slim console strip and two
 * seat backs. It's placeholder art built from palette steps only, drawn at the buffer's pixel
 * size, until Luke draws the real frame in Aseprite (public/sprites/deck-frame.png).
 *
 * Lighting comes from the stars: `light` is 0 (dark) to 1 (bright sunlight) and `colourClass`
 * is the stellar class of the star contributing most, which tints the frame's inner edges.
 */

const BAYER = bayer8();
const P = (name: string) => ENGINE_PALETTE.indexOf(name);
const FRAME = ['void-1', 'void-2', 'void-3', 'void-4'].map(P);
const CELL_ON = P('red-3');
const CELL_MID = P('red-2');
const CELL_AMBER = P('gold-3');
const CELL_OFF = P('red-0');
const CONSOLE_LED = [P('cyan-3'), P('green'), P('gold-3')];

export const TOP = 9;
export const SIDE = 4;
export const CONSOLE = 12;

export type Light = { level: number; colourClass: number };

/** Interior brightness from the starlight reaching the deck (flux in Suns at 1 AU). */
export function interiorLevel(totalFlux: number): number {
  if (totalFlux <= 0) return 0;
  return Math.max(0, Math.min(1, (Math.log10(totalFlux) + 2) / 3));
}

export function drawInterior(
  out: Uint8Array,
  W: number,
  H: number,
  light: Light,
  offset: { x: number; y: number },
  time: number,
  critical: boolean,
) {
  const base = Math.min(3, Math.floor(light.level * 3.99));
  const edge = STELLAR_TONES[Math.max(0, Math.min(5, light.colourClass))]![3]!;
  const edgeIdx = P(edge);
  const ox = Math.round(offset.x);
  const oy = Math.round(offset.y);
  const top = TOP + oy;
  const bottom = H - CONSOLE + oy;
  const left = SIDE + ox;
  const right = W - SIDE + ox;
  const seat = (x: number, y: number, cx: number) =>
    Math.abs(x - cx) < 9 &&
    y > H - CONSOLE - 10 + oy &&
    (y > H - CONSOLE - 8 + oy || Math.abs(x - cx) < 7);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inFrame = y < top || y >= bottom || x < left || x >= right;
      const inSeat = seat(x, y, Math.round(W * 0.3) + ox) || seat(x, y, Math.round(W * 0.7) + ox);
      if (!inFrame && !inSeat) continue;
      const t = BAYER[(y & 7) * 8 + (x & 7)]!;
      // Faces toward the window catch more light: the inner rim one step brighter.
      const rim = y === top - 1 || y === bottom || x === left - 1 || x === right;
      let step = base - (inSeat ? 1 : 0) + (rim ? 1 : 0);
      if (!rim && t > 0.85) step -= 1;
      step = Math.max(0, Math.min(3, step));
      out[y * W + x] = rim && light.level > 0.55 ? edgeIdx : FRAME[step]!;
    }
  }

  // K.A.R.L.'s scanner bar, centred in the top band.
  const levels = larsonLevels(time, critical ? 0.45 : 1);
  const cellW = 4;
  const startX = Math.round(W / 2 - (levels.length * (cellW + 1)) / 2) + ox;
  const cy = Math.max(1, Math.floor(top / 2) - 1);
  levels.forEach((v, i) => {
    const c = v > 0.9 ? (critical ? CELL_AMBER : CELL_ON) : v > 0.3 ? CELL_MID : CELL_OFF;
    for (let dx = 0; dx < cellW; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        const x = startX + i * (cellW + 1) + dx;
        const y = cy + dy;
        if (x >= 0 && x < W && y >= 0 && y < H) out[y * W + x] = c;
      }
    }
  });

  // Console LEDs blinking slowly along the strip.
  for (let i = 0; i < 8; i++) {
    const x = Math.round(W * 0.42) + i * 4 + ox;
    const y = H - Math.ceil(CONSOLE / 2) + oy;
    const on = Math.sin(time * (0.7 + i * 0.37) + i) > 0.2;
    if (on && x >= 0 && x < W && y >= 0 && y < H) out[y * W + x] = CONSOLE_LED[i % 3]!;
  }
}
