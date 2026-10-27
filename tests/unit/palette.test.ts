import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hexToRgb, RAMP_NAMES } from '@/lib/palette';
import { parseRamps, toGpl } from '../../scripts/palette-lib';

const css = readFileSync('src/app/globals.css', 'utf8');
const ramps = parseRamps(css);

function token(name: string): string {
  return css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!.toLowerCase();
}

function luminance(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

describe('shading ramps', () => {
  it('contain the base tokens unchanged', () => {
    expect(ramps.void[1]).toBe(token('void'));
    for (const name of ['cyan', 'gold', 'red', 'violet'] as const) {
      expect(ramps[name][3]).toBe(token(name));
    }
  });

  it('get strictly brighter from step 0 to step 5', () => {
    for (const name of RAMP_NAMES) {
      const lum = ramps[name].map(luminance);
      for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeGreaterThan(lum[i - 1]!);
    }
  });

  it('match the committed Aseprite palette (run `pnpm palette` if this fails)', () => {
    expect(readFileSync('design/three-body-cv.gpl', 'utf8')).toBe(toGpl(ramps));
  });
});
