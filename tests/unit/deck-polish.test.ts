import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_PALETTE } from '@/features/three-body/engine-layout';
import { instantiateEngine } from '@/features/three-body/engine';
import { fov } from '@/features/three-body/deck/camera';
import { DOME_INDICATIONS, drawInspection } from '@/features/three-body/deck/interior';
import { DeckSession } from '@/features/three-body/deck/session';

const WASM = 'public/engine.wasm';

describe('dome inspection', () => {
  it('gathers particles, then holds three gold cracks on the frame', () => {
    const W = 320;
    const H = 180;
    const gold = ENGINE_PALETTE.indexOf('gold-3');
    const early = new Uint8Array(W * H);
    drawInspection(early, W, H, { x: 0, y: 0 }, 0.2, false);
    expect(early.includes(gold)).toBe(false);
    const late = new Uint8Array(W * H);
    drawInspection(late, W, H, { x: 0, y: 0 }, 2, false);
    const cracks = late.filter((v) => v === gold).length;
    expect(cracks).toBe(DOME_INDICATIONS.reduce((n, d) => n + d.length, 0));
    // Reduced motion: no drift, the cracks are there at once.
    const instant = new Uint8Array(W * H);
    drawInspection(instant, W, H, { x: 0, y: 0 }, 0, true);
    expect(instant.filter((v) => v === gold).length).toBe(cracks);
  });
});

describe.skipIf(!existsSync(WASM))('pixel stability', () => {
  it('renders turns smaller than a pixel as a sub-pixel offset, not new pixels', async () => {
    const e = await instantiateEngine(readFileSync(WASM));
    const s = new DeckSession(e, 160, 90, 0, 318, true);
    // Two frames: the first one sets the exposure the second renders with.
    s.frame(1 / 60, 0);
    s.frame(0, 0);
    const a = s.pixels.slice();
    const step = fov(s.camera) / s.camera.width;
    s.look(step * 0.3, 0);
    s.frame(0, 0);
    expect(s.subpixel.x).toBeCloseTo(-0.3, 5);
    // The pixels away from the animated frame bands are identical.
    let diff = 0;
    for (let y = 12; y < 78; y++)
      for (let x = 6; x < 154; x++) if (s.pixels[y * 160 + x] !== a[y * 160 + x]) diff++;
    expect(diff).toBe(0);
    s.look(step * 0.4, 0);
    s.frame(0, 0);
    expect(Math.abs(s.subpixel.x)).toBeLessThanOrEqual(0.5);
  });

  it('holds the scanner and lights still with reduced motion', async () => {
    const e = await instantiateEngine(readFileSync(WASM));
    const s = new DeckSession(e, 160, 90, 0, 318, true);
    s.frame(1 / 60, 0);
    const top = s.pixels.slice(0, 160 * 8);
    s.frame(0.5, 0);
    expect(s.pixels.slice(0, 160 * 8)).toEqual(top);
  });
});
