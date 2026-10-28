import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EFFECT, ENGINE_PALETTE } from '@/features/three-body/engine-layout';
import { instantiateEngine } from '@/features/three-body/engine';
import type { DeckBody } from '@/features/three-body/deck/bodies';
import { type Camera, length, sub } from '@/features/three-body/deck/camera';
import { drawEffects, flashRadiance, readEffects } from '@/features/three-body/deck/effects';
import { avoidance, KEEP_OUT, KEEP_OUT_MARGIN } from '@/features/three-body/deck/platform';
import { DeckSession, WIPE_SECONDS } from '@/features/three-body/deck/session';
import { findVantage, VANTAGES } from '@/features/three-body/deck/vantages';
import { parseInput } from '@/features/karl/intents';

const WASM = 'public/engine.wasm';
const camera = (over: Partial<Camera> = {}): Camera => ({
  position: [0, 0, 2.6],
  baseForward: [0, 0, -1],
  baseUp: [0, 1, 0],
  yaw: 0,
  pitch: 0,
  zoom: 1,
  width: 160,
  height: 120,
  ...over,
});

describe('effects', () => {
  const buf = new Float64Array(1 + EFFECT.rows * EFFECT.width);
  buf[0] = 3;
  const row = (i: number, v: number[]) => buf.set(v, 1 + i * EFFECT.width);
  row(0, [EFFECT.shell, 0.5, 0, 0.3, 0.9]);
  row(1, [EFFECT.shock, 0, 0, 1.2, 1]);
  row(2, [EFFECT.flash, 0, 0, 0, 1]);

  it('reads shells, shocks and the flash', () => {
    const e = readEffects(buf);
    expect(e.map((x) => x.kind)).toEqual(['shell', 'shock', 'flash']);
    expect(e[0]!.position).toEqual([0.5, 0, 0]);
    expect(e[1]!.radius).toBe(1.2);
  });

  it('draws rings in palette colours and makes the flash blinding', () => {
    const cam = camera();
    const out = new Uint8Array(cam.width * cam.height);
    drawEffects(out, cam, readEffects(buf), []);
    const used = new Set(out);
    expect(used.has(ENGINE_PALETTE.indexOf('star-3'))).toBe(true);
    expect([...used].every((v) => v < ENGINE_PALETTE.length)).toBe(true);
    const flash = readEffects(buf)[2]!;
    // A billion Suns at 2.6 AU outshines anything else the deck can show.
    expect(flashRadiance(flash, cam, 1e-4)).toBeGreaterThan(1e10);
    expect(flashRadiance({ ...flash, position: [0, 0, 10] }, cam, 1e-4)).toBe(0);
  });
});

describe('vantages', () => {
  const star = (i: number, x: number): DeckBody => ({
    id: `star-${i}`,
    name: `Star ${i + 1}`,
    kind: 'star',
    position: [x, 0, 0],
    velocity: [0, 0, 0],
    mass: 1,
    radius: 0.07,
    trueRadius: 0.005,
    temperature: 5800,
    luminosity: 1,
    star: i,
    colourClass: 2,
    phase: 'Main sequence',
  });

  it('offers L4 only for the triangle and the close pair', () => {
    const bodies = [star(0, -0.5), star(1, 0.5), star(2, 1.5)];
    const offered = [0, 1, 2, 3, 4, 5].filter((p) => VANTAGES.lagrange.available!(bodies, p));
    expect(offered).toEqual([1, 5]);
    const l4 = VANTAGES.lagrange.station(bodies)!;
    expect(l4[0]).toBeCloseTo(0, 6);
    expect(l4[1]).toBeCloseTo(Math.sqrt(3) / 2, 6);
  });

  it('waits for a planet and a hole', () => {
    const bodies = [star(0, -0.5), star(1, 0.5)];
    expect(VANTAGES.planet.available!(bodies, 0)).toBe(false);
    expect(VANTAGES.blackhole.available!(bodies, 0)).toBe(false);
  });

  it('finds vantages by typed name', () => {
    expect(findVantage('hole')).toBe('blackhole');
    expect(findVantage('L4')).toBe('lagrange');
    expect(findVantage('above')).toBe('above');
    expect(findVantage('nowhere')).toBeNull();
  });
});

describe('platform safety', () => {
  it('pushes away from a body inside its keep-out zone, and not outside it', () => {
    const o = { position: [0, 0, 0] as [number, number, number], radius: 0.1 };
    const safe = o.radius * KEEP_OUT + KEEP_OUT_MARGIN;
    expect(avoidance([safe * 0.5, 0, 0], [o], 10)[0]).toBeGreaterThan(0);
    expect(avoidance([safe * 1.1, 0, 0], [o], 10)).toEqual([0, 0, 0]);
  });
});

describe("K.A.R.L.'s deck commands", () => {
  it('carry their arguments', () => {
    expect(parseInput('/vantage hole', {})).toEqual({
      type: 'command',
      command: 'vantage',
      args: 'hole',
    });
    expect(parseInput('/focus star 2', {})).toEqual({
      type: 'command',
      command: 'focus',
      args: 'star 2',
    });
    expect(parseInput('/zoom 10', {})).toEqual({ type: 'command', command: 'zoom', args: '10' });
    expect(parseInput('/deck', {})).toEqual({ type: 'command', command: 'deck' });
  });
});

describe.skipIf(!existsSync(WASM))('deck session, phase 4', () => {
  const session = async () =>
    new DeckSession(await instantiateEngine(readFileSync(WASM)), 160, 120, 0, 318, false);

  it('travels under gravity to a new vantage, never entering a body, and reports the trip', async () => {
    const s = await session();
    s.frame(1 / 60, 1);
    s.travel('barycentre');
    expect(s.transit?.to).toBe('barycentre');
    let closest = Infinity;
    let frames = 0;
    while (s.transit && frames < 60 * 30) {
      s.frame(1 / 60, 1);
      frames++;
      for (const b of s.bodies)
        if (b.kind === 'star')
          closest = Math.min(closest, length(sub(s.platform.position, b.position)) / b.radius);
      if (frames === 30) expect(s.transitElapsed()).toMatch(/days|years/);
    }
    expect(s.transit).toBeNull();
    expect(s.vantage).toBe('barycentre');
    expect(closest).toBeGreaterThan(1);
  });

  it('jumps behind a scanline wipe, moving at its midpoint', async () => {
    const s = await session();
    s.frame(1 / 60, 1);
    s.jump('barycentre');
    s.frame(WIPE_SECONDS / 4, 1);
    expect(s.vantage).toBe('above');
    const dark = ENGINE_PALETTE.indexOf('void-0');
    expect(s.pixels.filter((v) => v === dark).length).toBeGreaterThan(s.pixels.length * 0.2);
    s.frame(WIPE_SECONDS / 4 + 0.01, 1);
    expect(s.vantage).toBe('barycentre');
  });

  it('narrates on request, follows typed commands, and keeps engine memory fixed', async () => {
    const s = await session();
    const before = (s as unknown as { engine: { memory: WebAssembly.Memory } }).engine.memory.buffer
      .byteLength;
    s.age();
    let sawShell = false;
    for (let i = 0; i < 60 * 3; i++) {
      s.frame(1 / 60, 1);
      s.drainEvents();
      sawShell ||= s.effects.some((e) => e.kind === 'shell' || e.kind === 'shock');
    }
    expect(s.narrate().join(' ')).toMatch(/leaving the main sequence/);
    expect(s.findBody('star 3')?.name).toBe('Star 3');
    expect(s.findBody('planet')?.kind).toBe('planet');
    s.setZoom(500);
    expect(s.camera.zoom).toBe(50);
    for (let i = 0; i < 60 * 8; i++) {
      s.frame(1 / 60, 1);
      sawShell ||= s.effects.some((e) => e.kind === 'shell' || e.kind === 'shock');
    }
    expect(sawShell).toBe(true);
    const after = (s as unknown as { engine: { memory: WebAssembly.Memory } }).engine.memory.buffer
      .byteLength;
    expect(after).toBe(before);
  });
});
