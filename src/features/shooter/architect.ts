/**
 * The Architect's 128×128 sprite: a 32×32 copy of Luke's CV photo (only this tiny version is
 * published, never the original), mapped onto a dying-star ramp with Bayer dithering and
 * scaled up 4× (integer factor only).
 * Falls back to a drawn face if the photo can't load.
 */
import { bayer8 } from '@/lib/dither';
import type { Palette } from '@/lib/palette';
import { hexToRgb } from '@/lib/palette';

const SOURCE = 32;
const SCALE = 4;
export const SPRITE_SIZE = SOURCE * SCALE;

export function buildArchitect(src: string, palette: Palette): Promise<HTMLCanvasElement> {
  const ramp = [palette.void, palette.violet, palette.red, palette.gold, palette.ink].map(hexToRgb);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(pixelate(img, ramp));
    img.onerror = () => resolve(fallback(palette));
    img.src = src;
  });
}

function pixelate(img: HTMLImageElement, ramp: [number, number, number][]): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = SOURCE;
  small.height = SOURCE;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  // Centre-crop to a square, then let the browser average down to 32×32.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    SOURCE,
    SOURCE,
  );
  const data = sctx.getImageData(0, 0, SOURCE, SOURCE);
  const bayer = bayer8();
  const levels = ramp.length - 1;
  for (let y = 0; y < SOURCE; y++) {
    for (let x = 0; x < SOURCE; x++) {
      const o = (y * SOURCE + x) * 4;
      const lum =
        (0.299 * data.data[o]! + 0.587 * data.data[o + 1]! + 0.114 * data.data[o + 2]!) / 255;
      const scaled = lum * levels;
      const base = Math.floor(scaled);
      const idx = Math.min(levels, base + (scaled - base > bayer[(y % 8) * 8 + (x % 8)]! ? 1 : 0));
      const c = ramp[idx]!;
      data.data[o] = c[0];
      data.data[o + 1] = c[1];
      data.data[o + 2] = c[2];
      data.data[o + 3] = 255;
    }
  }
  sctx.putImageData(data, 0, 0);
  return upscale(small);
}

function upscale(small: HTMLCanvasElement): HTMLCanvasElement {
  const big = document.createElement('canvas');
  big.width = SPRITE_SIZE;
  big.height = SPRITE_SIZE;
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return big;
}

function fallback(p: Palette): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = SOURCE;
  small.height = SOURCE;
  const ctx = small.getContext('2d')!;
  ctx.fillStyle = p.red;
  ctx.fillRect(4, 4, 24, 24);
  ctx.fillStyle = p.gold;
  ctx.fillRect(9, 11, 4, 4);
  ctx.fillRect(19, 11, 4, 4);
  ctx.fillRect(10, 20, 12, 3);
  return upscale(small);
}
