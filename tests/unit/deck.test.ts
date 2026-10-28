import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BODY, ENGINE_PALETTE, STATE } from '@/features/three-body/engine-layout';
import {
  BASE_RADIUS_PX,
  ENGINE_PX_PER_AU,
  readBodies,
  trueStarRadius,
} from '@/features/three-body/deck/bodies';
import {
  aimAt,
  angularRadius,
  basis,
  type Camera,
  clampZoom,
  DEG,
  dot,
  fov,
  length,
  normalize,
  pixelDirection,
  project,
  sub,
} from '@/features/three-body/deck/camera';
import {
  adapt,
  DYNAMIC_RANGE,
  magnitudeFlux,
  radiance,
  targetExposure,
  tone,
} from '@/features/three-body/deck/exposure';
import { drawInterior, interiorLevel } from '@/features/three-body/deck/interior';
import {
  gravity,
  MAX_THRUST,
  specificEnergy,
  stepPlatform,
} from '@/features/three-body/deck/platform';
import { makeSky, renderDeck, STELLAR_TONES } from '@/features/three-body/deck/render';
import {
  AU,
  formatDuration,
  lightTravelSeconds,
  planck,
  schwarzschildAu,
  TIME_UNIT,
  wienPeak,
} from '@/features/three-body/deck/units';
import { ABOVE_HEIGHT, VANTAGES } from '@/features/three-body/deck/vantages';

const camera = (over: Partial<Camera> = {}): Camera => ({
  position: [0, 0, ABOVE_HEIGHT],
  baseForward: [0, 0, -1],
  baseUp: [0, 1, 0],
  yaw: 0,
  pitch: 0,
  zoom: 1,
  width: 320,
  height: 180,
  ...over,
});

describe('units', () => {
  it('maps the G = 1 time unit to about 58.1 days', () => {
    expect(TIME_UNIT).toBeCloseTo(5.02e6, -4);
    expect(TIME_UNIT / 86400).toBeCloseTo(58.1, 0);
  });

  it('gives standard physical values', () => {
    expect(lightTravelSeconds(1)).toBeCloseTo(499, 0);
    expect(schwarzschildAu(1) * AU).toBeCloseTo(2953, -1);
    expect(wienPeak(5800) * 1e9).toBeCloseTo(500, -1);
    // Planck peaks at Wien's wavelength.
    const peak = wienPeak(5800);
    expect(planck(peak, 5800)).toBeGreaterThan(planck(peak * 0.9, 5800));
    expect(planck(peak, 5800)).toBeGreaterThan(planck(peak * 1.1, 5800));
  });

  it('formats durations in sensible units', () => {
    expect(formatDuration(3.2 * 365.25 * 86400)).toBe('3.2 years');
    expect(formatDuration(14 * 86400)).toBe('14 days');
    expect(formatDuration(5 * 3600)).toBe('5.0 h');
  });
});

describe('deck camera', () => {
  it('puts the point straight ahead at the centre of the screen', () => {
    const cam = camera();
    const p = project(basis(cam), cam, [0, 0, 0])!;
    expect(p.x).toBeCloseTo(160);
    expect(p.y).toBeCloseTo(90);
  });

  it('keeps the base up direction at the top of the screen and right on the right', () => {
    const cam = camera();
    const b = basis(cam);
    expect(project(b, cam, [0, 1, 0])!.y).toBeLessThan(90);
    expect(project(b, cam, [1, 0, 0])!.x).toBeGreaterThan(160);
  });

  it('hides what is behind the viewer', () => {
    const cam = camera();
    expect(project(basis(cam), cam, [0, 0, 5])).toBeNull();
  });

  it('spans the 100° field of view across the width', () => {
    const cam = camera();
    const b = basis(cam);
    const edge = pixelDirection(b, cam, 0, 90);
    expect(Math.acos(dot(edge, b.forward)) / DEG).toBeCloseTo(50, 3);
    expect(fov({ ...cam, zoom: 10 }) / DEG).toBeCloseTo(10);
    expect(clampZoom(500)).toBe(50);
  });

  it('aims at a target so it projects to the centre', () => {
    const cam = camera();
    const target: [number, number, number] = [0.8, -0.4, 0.2];
    const aimed = { ...cam, ...aimAt(cam, target) };
    const p = project(basis(aimed), aimed, target)!;
    expect(p.x).toBeCloseTo(160, 3);
    expect(p.y).toBeCloseTo(90, 3);
  });

  it('uses the true angular size θ = asin(R / d)', () => {
    expect(angularRadius(1, 2)).toBeCloseTo(Math.PI / 6);
    expect(angularRadius(2, 1)).toBeCloseTo(Math.PI / 2);
  });
});

describe('platform', () => {
  const sun = [{ position: [0, 0, 0] as [number, number, number], mass: 1 }];

  it('falls freely as a test particle and conserves orbital energy', () => {
    // Circular orbit at 1 AU: v = 1 in G = 1 units.
    let p = {
      position: [1, 0, 0] as [number, number, number],
      velocity: [0, 1, 0] as [number, number, number],
    };
    const e0 = specificEnergy(p, sun);
    for (let i = 0; i < 200; i++) p = stepPlatform(p, sun, 0.05, null);
    expect(Math.abs((specificEnergy(p, sun) - e0) / e0)).toBeLessThan(1e-4);
    expect(length(p.position)).toBeCloseTo(1, 3);
  });

  it('holds its station against gravity while the thrust cap allows', () => {
    const target: [number, number, number] = [0, 0, ABOVE_HEIGHT];
    expect(length(gravity(target, sun))).toBeLessThan(MAX_THRUST);
    let p = { position: target, velocity: [0, 0, 0] as [number, number, number] };
    for (let i = 0; i < 100; i++) p = stepPlatform(p, sun, 0.05, target);
    expect(length(sub(p.position, target))).toBeLessThan(1e-3);
  });

  it('cannot hover where gravity beats the thrust cap', () => {
    const target: [number, number, number] = [0, 0, 0.1];
    expect(length(gravity(target, sun))).toBeGreaterThan(MAX_THRUST);
    let p = { position: target, velocity: [0, 0, 0] as [number, number, number] };
    p = stepPlatform(p, sun, 0.01, target);
    expect(p.position[2]).toBeLessThan(0.1);
  });
});

describe('exposure', () => {
  it('maps the peak to white and drops to black DYNAMIC_RANGE decades below', () => {
    expect(tone(10, 0.1)).toBe(1);
    expect(tone(10 * 10 ** -DYNAMIC_RANGE, 0.1)).toBeCloseTo(0);
    expect(tone(1, 0.1)).toBeCloseTo(1 - 1 / DYNAMIC_RANGE);
  });

  it('adapts toward the target faster for glare than for darkness', () => {
    const bright = adapt(1, 0.01, 0.1);
    const dark = adapt(1, 100, 0.1);
    expect(Math.log(1 / bright)).toBeGreaterThan(Math.log(dark));
    expect(adapt(1, 0.01, 0.1, true)).toBe(0.01);
  });

  it('caps exposure so an empty sky is not blown out', () => {
    const omega = 1e-4;
    expect(targetExposure(0, omega)).toBe(omega / magnitudeFlux(-1.5));
  });

  it('spreads a resolved disc and concentrates a point', () => {
    expect(radiance(1, 0.1, 1e-4)).toBeCloseTo(1 / (Math.PI * 0.01));
    expect(radiance(1, 1e-5, 1e-4)).toBeCloseTo(1e4);
  });
});

describe('bodies', () => {
  const state = new Float64Array(STATE.length);
  const bodies = new Float64Array(BODY.rows * BODY.width);
  state[STATE.bodies] = 4;
  for (let i = 0; i < 3; i++) {
    const s = STATE.stars + i * STATE.starWidth;
    state[s] = i;
    state[s + 2] = [2600, 5800, 16000][i]!;
    state[s + 3] = BASE_RADIUS_PX[i]!;
    state[s + 5] = [0, 2, 5][i]!;
    bodies[i * BODY.width + BODY.x] = i - 1;
    bodies[i * BODY.width + BODY.mass] = 1;
    bodies[i * BODY.width + BODY.extra] = [0.02, 1, 20][i]!;
  }
  bodies[3 * BODY.width + BODY.kind] = 1;
  state[STATE.era] = 1;

  it('reads stars first, then the planet, with drawn and true sizes', () => {
    const list = readBodies(state, bodies);
    expect(list.map((b) => b.kind)).toEqual(['star', 'star', 'star', 'planet']);
    expect(list[1]!.radius).toBeCloseTo(5 / ENGINE_PX_PER_AU);
    expect(list[1]!.trueRadius * AU).toBeCloseTo(6.957e8, -6);
    expect(list[2]!.luminosity).toBe(20);
    expect(list[3]!.era).toBe('Stable');
  });

  it('grows a giant to ~100 solar radii and collapses remnants', () => {
    const giant = trueStarRadius(1, 1, 5 * 2.6, 1) * AU;
    expect(giant / 6.957e8).toBeCloseTo(100, 0);
    expect(trueStarRadius(2, 4, 6, 1)).toBeCloseTo(schwarzschildAu(1));
  });
});

describe('render', () => {
  it('mirrors the Go engine stellar tones', () => {
    const go = readFileSync('engine/raster/palette.go', 'utf8');
    const block = /var StellarTones = \[6\]Tones\{([\s\S]*?)\n\}/.exec(go)![1]!;
    const rows = block
      .split('\n')
      .filter((l) => l.includes('{'))
      .map((l) =>
        [...l.matchAll(/R\((\w+)Ramp, (\d)\)/g)].map((m) => `${m[1]!.toLowerCase()}-${m[2]}`),
      );
    expect(STELLAR_TONES).toEqual(rows);
  });

  it('writes only palette indices, and shows the stars from the default vantage', () => {
    const cam = camera();
    const out = new Uint8Array(cam.width * cam.height);
    const list = readBodies(
      (() => {
        const s = new Float64Array(STATE.length);
        s[STATE.bodies] = 3;
        for (let i = 0; i < 3; i++) {
          const o = STATE.stars + i * STATE.starWidth;
          s[o] = i;
          s[o + 2] = 5800;
          s[o + 3] = BASE_RADIUS_PX[i]!;
          s[o + 5] = 2;
        }
        return s;
      })(),
      (() => {
        const b = new Float64Array(BODY.rows * BODY.width);
        for (let i = 0; i < 3; i++) {
          b[i * BODY.width + BODY.x] = (i - 1) * 0.8;
          b[i * BODY.width + BODY.mass] = 1;
          b[i * BODY.width + BODY.extra] = 1;
        }
        return b;
      })(),
    );
    const frame = renderDeck(out, cam, list, makeSky(200), 1e-9, 0);
    expect(out.every((v) => v < ENGINE_PALETTE.length)).toBe(true);
    expect(frame.onScreen).toHaveLength(3);
    expect(frame.peak).toBeGreaterThan(0);
    // With exposure set for the stars, they draw; nothing whites out the whole screen.
    const lit = renderDeck(out, cam, list, makeSky(200), 1 / frame.peak, 0);
    const white = ENGINE_PALETTE.indexOf('star-3');
    const whiteCount = out.filter((v) => v === white).length;
    expect(lit.onScreen.every((s) => s.tone > 0.5)).toBe(true);
    expect(whiteCount).toBeLessThan(out.length * 0.05);
  });

  it('draws the interior from palette entries only, darker in shadow', () => {
    const W = 320;
    const H = 180;
    const dark = new Uint8Array(W * H).fill(255);
    const bright = new Uint8Array(W * H).fill(255);
    drawInterior(
      dark,
      W,
      H,
      { level: interiorLevel(0.001), colourClass: 2 },
      { x: 0, y: 0 },
      0,
      false,
    );
    drawInterior(
      bright,
      W,
      H,
      { level: interiorLevel(10), colourClass: 2 },
      { x: 0, y: 0 },
      0,
      false,
    );
    const sum = (a: Uint8Array) => {
      // Brightness proxy: the frame's void step (void-1 … void-4).
      let n = 0;
      for (const v of a) {
        const name = ENGINE_PALETTE[v];
        if (name?.startsWith('void-')) n += Number(name.slice(5));
      }
      return n;
    };
    for (const v of bright) expect(v === 255 || v < ENGINE_PALETTE.length).toBe(true);
    expect(sum(bright)).toBeGreaterThan(sum(dark));
  });

  it('has a station for every vantage that holds one', () => {
    expect(VANTAGES.above.station([])).toEqual([0, 0, ABOVE_HEIGHT]);
    expect(VANTAGES.free.station([])).toBeNull();
    expect(normalize(VANTAGES.above.forward)).toEqual([0, 0, -1]);
  });
});
