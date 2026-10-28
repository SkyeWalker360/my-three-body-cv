import { describe, expect, it } from 'vitest';
import { ENGINE_PALETTE } from '@/features/three-body/engine-layout';
import type { DeckBody } from '@/features/three-body/deck/bodies';
import {
  basis,
  type Camera,
  DEG,
  dot,
  normalize,
  type Vec3,
} from '@/features/three-body/deck/camera';
import { discOverlap, visibleFraction } from '@/features/three-body/deck/eclipse';
import { interiorLevel } from '@/features/three-body/deck/interior';
import {
  B_CRIT,
  blueshift,
  deflection,
  lensedDirection,
  shadowRadius,
} from '@/features/three-body/deck/lensing';
import { makeSky, makeSkyMap, renderDeck } from '@/features/three-body/deck/render';
import { schwarzschildAu } from '@/features/three-body/deck/units';
import { HOLE_DISTANCE_RS, VANTAGES } from '@/features/three-body/deck/vantages';

const body = (over: Partial<DeckBody>): DeckBody => ({
  id: 'x',
  name: 'X',
  kind: 'star',
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  mass: 1,
  radius: 0.07,
  trueRadius: 0.005,
  temperature: 5800,
  luminosity: 1,
  star: 0,
  colourClass: 2,
  phase: 'Main sequence',
  ...over,
});

const camera = (over: Partial<Camera> = {}): Camera => ({
  position: [0, 0, 2],
  baseForward: [0, 0, -1],
  baseUp: [0, 1, 0],
  yaw: 0,
  pitch: 0,
  zoom: 1,
  width: 160,
  height: 120,
  ...over,
});

describe('eclipses', () => {
  it('computes circle overlaps', () => {
    expect(discOverlap(1, 1, 3)).toBe(0);
    expect(discOverlap(1, 0.5, 0)).toBeCloseTo(Math.PI * 0.25);
    // Two unit circles one radius apart overlap by 2π/3 − √3/2.
    expect(discOverlap(1, 1, 1)).toBeCloseTo((2 * Math.PI) / 3 - Math.sqrt(3) / 2);
  });

  it('hides a star behind a nearer body, and dims the deck interior', () => {
    const star = body({ position: [0, 0, 0], luminosity: 1 });
    const moon = body({
      id: 'm',
      kind: 'planet',
      luminosity: 0,
      position: [0, 0, 1],
      radius: 0.06,
    });
    const observer: Vec3 = [0, 0, 2];
    const clear = visibleFraction(observer, star, [star]);
    const eclipsed = visibleFraction(observer, star, [star, moon]);
    expect(clear).toBe(1);
    // The moon is half as far and nearly as big, so it covers the whole disc.
    expect(eclipsed).toBeLessThan(0.05);
    const lightClear = interiorLevel(clear * (1 / 4));
    const lightEclipsed = interiorLevel(eclipsed * (1 / 4));
    expect(lightEclipsed).toBeLessThan(lightClear);
  });

  it('ignores bodies behind the star', () => {
    const star = body({ position: [0, 0, 0] });
    const behind = body({ id: 'b', kind: 'planet', luminosity: 0, position: [0, 0, -1] });
    expect(visibleFraction([0, 0, 2], star, [star, behind])).toBe(1);
  });
});

describe('planet phases', () => {
  const litPixels = (starAt: Vec3) => {
    const cam = camera();
    const out = new Uint8Array(cam.width * cam.height);
    const star = body({ position: starAt, radius: 0.01, luminosity: 1 });
    const planet = body({
      id: 'planet',
      kind: 'planet',
      luminosity: 0,
      position: [0, 0, 0],
      radius: 0.4,
      era: 'Frozen',
      colourClass: 0,
    });
    // Expose for the planet's own brightness so only the geometry matters.
    renderDeck(out, cam, [planet, star], [], 2e4, 0);
    const bg = ENGINE_PALETTE.indexOf('void-0');
    // Count planet pixels near the centre that aren't background.
    let lit = 0;
    for (let y = 30; y < 90; y++)
      for (let x = 50; x < 110; x++) if (out[y * cam.width + x] !== bg) lit++;
    return lit;
  };

  it('is full when the star is behind the viewer and new when it is behind the planet', () => {
    const full = litPixels([0, 0, 10]);
    const half = litPixels([10, 0, 0]);
    const fresh = litPixels([0, 0, -10]);
    expect(full).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(fresh);
  });

  it('lights the side facing the star', () => {
    const cam = camera();
    const out = new Uint8Array(cam.width * cam.height);
    const star = body({ position: [10, 0, 0], radius: 0.01 });
    const planet = body({ id: 'p', kind: 'planet', luminosity: 0, radius: 0.4, era: 'Frozen' });
    renderDeck(out, cam, [planet, star], [], 2e4, 0);
    const bg = ENGINE_PALETTE.indexOf('void-0');
    const count = (x0: number, x1: number) => {
      let n = 0;
      for (let y = 40; y < 80; y++)
        for (let x = x0; x < x1; x++) if (out[y * cam.width + x] !== bg) n++;
      return n;
    };
    // Star at +x is on the right of the screen.
    expect(count(81, 110)).toBeGreaterThan(count(50, 79) * 3);
  });
});

describe('lensing', () => {
  it('bends light by 2 r_s / b far from the hole and captures inside b_c', () => {
    expect(deflection(1e4)).toBeCloseTo(2e-4, 6);
    expect(deflection(B_CRIT * 0.99)).toBe(Infinity);
    expect(deflection(B_CRIT * 1.001)).toBeGreaterThan(Math.PI);
  });

  it('gives the shadow its size: b_c / r far away, and a blueshift of 1/√(1 − r_s/r)', () => {
    expect(shadowRadius(1e5)).toBeCloseTo(B_CRIT / 1e5, 8);
    expect(shadowRadius(HOLE_DISTANCE_RS) / DEG).toBeCloseTo(12.0, 0);
    expect(blueshift(HOLE_DISTANCE_RS)).toBeCloseTo(1.0445, 3);
  });

  it('traces rays back toward the hole, and ends rays aimed at it', () => {
    const toHole: Vec3 = [0, 0, -1];
    expect(lensedDirection([0, 0, -1], toHole, 12)).toBeNull();
    const view = normalize([0.6, 0, -0.8]);
    const src = lensedDirection(view, toHole, 12)!;
    expect(dot(src, toHole)).toBeGreaterThan(dot(view, toHole));
  });

  it('draws the shadow at its true size from the black-hole vantage', () => {
    const rs = schwarzschildAu(1);
    const h = body({ phase: 'Black hole', luminosity: 0, temperature: 0, position: [0, 0, 0] });
    const position = VANTAGES.blackhole.station([h])!;
    const cam = camera({
      position,
      baseForward: VANTAGES.blackhole.forward,
      baseUp: VANTAGES.blackhole.up,
      width: 200,
      height: 200,
    });
    const out = new Uint8Array(cam.width * cam.height);
    const frame = renderDeck(out, cam, [h], makeSky(400), 1e6, 0, {
      position: h.position,
      rs,
      map: makeSkyMap(makeSky(400)),
    });
    expect(frame.shift).toBeCloseTo(blueshift(HOLE_DISTANCE_RS), 3);
    // The photon ring hugs the shadow: its two crossings of the centre row span the shadow.
    const ring = new Set(['cyan-4', 'red-3'].map((n) => ENGINE_PALETTE.indexOf(n)));
    const row = 100;
    const xs: number[] = [];
    for (let x = 0; x < cam.width; x++) if (ring.has(out[row * cam.width + x]!)) xs.push(x);
    const width = xs[xs.length - 1]! - xs[0]!;
    const b = basis(cam);
    const expected = 2 * b.focal * Math.tan(shadowRadius(HOLE_DISTANCE_RS));
    expect(Math.abs(width - expected)).toBeLessThan(expected * 0.12);
  });
});
