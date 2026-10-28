import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BODY,
  EFFECT,
  ENGINE_PALETTE,
  EVENT,
  MAX_PIXELS,
  STATE,
} from '@/features/three-body/engine-layout';

const state = readFileSync('engine/sim/state.go', 'utf8');
const palette = readFileSync('engine/raster/palette.go', 'utf8');
const frame = readFileSync('engine/raster/frame.go', 'utf8');

const goConst = (src: string, name: string): number => {
  const m = new RegExp(`\\b${name}\\s*=\\s*([0-9_]+)`).exec(src);
  if (!m) throw new Error(`no ${name} in Go source`);
  return Number(m[1]!.replaceAll('_', ''));
};

describe('engine layout mirror', () => {
  it('lists the palette in the Go order', () => {
    const block = /var Names = \[Count\]string\{([\s\S]*?)\n\}/.exec(palette)![1]!;
    const names = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(ENGINE_PALETTE).toEqual(names);
  });

  it('every palette name is a theme token', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    for (const name of ENGINE_PALETTE) expect(css).toContain(`--color-${name}:`);
  });

  it('uses the Go state offsets', () => {
    const map: Record<string, string> = {
      kinetic: 'StateKinetic',
      potential: 'StatePotential',
      total: 'StateTotal',
      drift: 'StateDrift',
      ghostGap: 'StateGhostGap',
      simTime: 'StateSimTime',
      preset: 'StatePreset',
      ghostOn: 'StateGhostOn',
      era: 'StateEra',
      civil: 'StateCivil',
      lights: 'StateLights',
      critical: 'StateCritical',
      bodies: 'StateBodies',
      stars: 'StateStars',
      starWidth: 'StateStarWidth',
    };
    for (const [key, go] of Object.entries(map)) {
      expect(STATE[key as keyof typeof STATE], key).toBe(goConst(state, go));
    }
    expect(STATE.length).toBe(STATE.stars + 3 * STATE.starWidth);
  });

  it('uses the Go bodies layout', () => {
    const map: Record<string, string> = {
      x: 'BodyX',
      y: 'BodyY',
      vx: 'BodyVX',
      vy: 'BodyVY',
      mass: 'BodyMass',
      kind: 'BodyKind',
      extra: 'BodyExtra',
      width: 'BodyWidth',
      rows: 'BodiesRows',
    };
    for (const [key, go] of Object.entries(map)) {
      expect(BODY[key as keyof typeof BODY], key).toBe(goConst(state, go));
    }
  });

  it('uses the Go effects layout', () => {
    const map: Record<string, string> = {
      kind: 'EffectKind',
      x: 'EffectX',
      y: 'EffectY',
      radius: 'EffectRadius',
      strength: 'EffectStrength',
      width: 'EffectWidth',
      rows: 'EffectsRows',
      shell: 'EffectShell',
      shock: 'EffectShock',
      flash: 'EffectFlash',
    };
    for (const [key, go] of Object.entries(map)) {
      expect(EFFECT[key as keyof typeof EFFECT], key).toBe(goConst(state, go));
    }
  });

  it('uses the Go event kinds and frame limit', () => {
    expect(EVENT.supernova).toBe(goConst(state, 'EventSupernova'));
    expect(EVENT.criticalOn).toBe(goConst(state, 'EventCriticalOn'));
    expect(EVENT.criticalOff).toBe(goConst(state, 'EventCriticalOff'));
    expect(EVENT.electrical).toBe(goConst(state, 'EventElectrical'));
    expect(MAX_PIXELS).toBe(goConst(frame, 'MaxPixels'));
  });
});
