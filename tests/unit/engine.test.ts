import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  colourTable,
  describeEvent,
  EngineLab,
  instantiateEngine,
} from '@/features/three-body/engine';
import { ENGINE_PALETTE, EVENT, PLANET_BODY } from '@/features/three-body/engine-layout';
import type { LabOutput } from '@/features/three-body/lab';

const WASM = 'public/engine.wasm';
// CI builds the engine before the unit tests; locally, run `pnpm engine` first.
const hasEngine = existsSync(WASM);

/** A 2D context that keeps the last frame put on it. */
function fakeCtx(width = 480, height = 270) {
  const canvas = { width, height };
  let last: ImageData | null = null;
  const ctx = {
    canvas,
    imageSmoothingEnabled: true,
    createImageData: (w: number, h: number) =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
    putImageData: (img: ImageData) => {
      last = img;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, frame: () => last };
}

const colors = ENGINE_PALETTE.map((_, i) => `#${(i * 5).toString(16).padStart(2, '0')}0000`);

describe('engine helpers', () => {
  it('packs palette colours as little-endian RGBA words', () => {
    const lut = colourTable(['#102030']);
    expect(lut[0]).toBe(((255 << 24) | (0x30 << 16) | (0x20 << 8) | 0x10) >>> 0);
  });

  it('describes events in plain sentences', () => {
    const kinds = ['Red dwarf', 'Yellow dwarf', 'Blue-white giant'];
    expect(describeEvent(EVENT.supernova, 2, 0, kinds)?.message).toBe(
      'Supernova! star 3 (blue-white giant) exploded.',
    );
    expect(describeEvent(EVENT.engulfment, 1, PLANET_BODY, kinds)?.kind).toBe('engulfment');
    expect(describeEvent(EVENT.criticalOn, 0, 0, kinds)).toBeNull();
  });
});

describe.skipIf(!hasEngine)('EngineLab with the built engine.wasm', () => {
  async function start() {
    const e = await instantiateEngine(readFileSync(WASM));
    const { ctx, frame } = fakeCtx();
    const out: LabOutput[] = [];
    const lab = new EngineLab(e, ctx, colors, false, (m) => out.push(m), 318);
    lab.handle({ type: 'pause' });
    return { e, lab, out, frame };
  }

  it('announces itself as the WASM engine and reports telemetry with extras', async () => {
    const { lab, out } = await start();
    expect(out[0]).toMatchObject({ type: 'ready', engine: 'wasm' });
    lab.handle({ type: 'preset', index: 0 });
    const t = out.findLast((m) => m.type === 'telemetry');
    expect(t?.type === 'telemetry' && t.telemetry.engine?.stars).toHaveLength(3);
    expect(t?.type === 'telemetry' && t.telemetry.engine?.stars[2]?.kind).toBe('Blue-white giant');
  });

  it('draws only palette colours', async () => {
    const { e, lab, frame } = await start();
    for (let i = 0; i < 120; i++) e.advance(1000 / 60);
    (lab as unknown as { draw(): void }).draw();
    const img = frame()!;
    const allowed = new Set(colourTable(colors));
    const words = new Uint32Array(img.data.buffer);
    for (const w of words) expect(allowed.has(w)).toBe(true);
  });

  it('ageing the giant ends in a supernova and turns the core critical, then calm', async () => {
    const { e, lab, out } = await start();
    lab.handle({ type: 'age' });
    for (let i = 0; i < 60 * 12; i++) {
      e.advance(1000 / 60);
      (lab as unknown as { drainEvents(): void }).drainEvents();
    }
    const kinds = out.flatMap((m) => (m.type === 'event' ? [m.kind] : []));
    expect(kinds).toContain('giant');
    expect(kinds).toContain('supernova');
    const critical = out.flatMap((m) => (m.type === 'critical' ? [m.critical] : []));
    expect(critical[0]).toBe(true);
    expect(critical.at(-1)).toBe(false);
  });
});
