'use client';

import { useEffect, useRef } from 'react';
import { on } from '@/lib/events';
import { animationLoop, prefersReducedMotion } from '@/lib/motion';
import { hexToRgb, readPalette } from '@/lib/palette';
import { bayer8 } from '@/lib/dither';
import { laneEmden } from './core';

const SIZE = 64;

/** Distance from the centre to a regular hexagon's edge (flat top), as a fraction of its radius. */
function hexEdge(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return Math.max(ay / (Math.sqrt(3) / 2), ax + ay / Math.sqrt(3));
}

/**
 * 64×64 dithered reactor gauge: an exposed white core inside hexagonal containment rings.
 * Brightness follows the n = 3 polytrope density profile; the burning shells (iron, silicon,
 * oxygen, envelope) and the rings pulse faster and harder as K.A.R.L.'s host star in the
 * three-body engine climbs the giant branch.
 */
export default function CoreGauge({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stress = useRef(0);

  useEffect(
    () =>
      on('threebody:telemetry', (t) => {
        const e = t.engine;
        stress.current = e ? (e.critical ? Math.max(e.hostProgress, 0.6) : e.hostProgress) : 0;
      }),
    [],
  );

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !active) return;

    const p = readPalette();
    const shells = [p.gold, p.red, p.violet, p.cyan].map(hexToRgb);
    const bg = hexToRgb(p.void);
    const core = hexToRgb(p.ink);
    const ring = hexToRgb(p.cyan);
    const ringHot = hexToRgb(p.gold);
    const { density } = laneEmden(3);
    const bayer = bayer8();
    const image = ctx.createImageData(SIZE, SIZE);
    const c = SIZE / 2;

    let phase = 0;
    const render = (dt: number) => {
      const s = stress.current;
      phase += dt * (2.4 + 9 * s);
      const pulse = 1 + (0.06 + 0.1 * s) * Math.sin(phase);
      const data = image.data;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const dx = x + 0.5 - c;
          const dy = y + 0.5 - c;
          // The core sits inside the rings, so it fills 70% of the gauge.
          const r = Math.hypot(dx, dy) / (c * 0.7 * pulse);
          const o = (y * SIZE + x) * 4;
          const threshold = bayer[(y % 8) * 8 + (x % 8)]!;
          let color = bg;
          if (r < 0.1) {
            color = core;
          } else if (r < 1) {
            const rho = density[Math.min(density.length - 1, Math.floor(r * density.length))]!;
            // Lift the faint outer layers so they still dither visibly.
            const intensity = Math.pow(rho, 0.35);
            const shell = r < 0.22 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : 3;
            if (intensity > threshold) color = shells[shell]!;
          }
          // Two hexagonal containment rings, 1 px wide, dithered; they glow gold under stress.
          const h = hexEdge(dx, dy) / c;
          const ringPulse = 1 + 0.03 * s * Math.sin(phase * 2);
          for (const radius of [0.78, 0.96]) {
            if (Math.abs(h - radius * ringPulse) < 0.022 && threshold < 0.85) {
              color = s > 0.5 && threshold < s ? ringHot : ring;
            }
          }
          data[o] = color[0];
          data[o + 1] = color[1];
          data[o + 2] = color[2];
          data[o + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    if (prefersReducedMotion()) {
      render(0);
      return;
    }
    const loop = animationLoop(render);
    loop.start();
    return () => loop.dispose();
  }, [active]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
      className="pixelated size-16 shrink-0 border border-gold/50"
    />
  );
}
