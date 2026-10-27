'use client';

import { useEffect, useRef } from 'react';
import { animationLoop, prefersReducedMotion } from '@/lib/motion';
import { hexToRgb, readPalette } from '@/lib/palette';
import { bayer8 } from '@/lib/dither';
import { laneEmden } from './core';

const SIZE = 64;

/**
 * 64×64 dithered reactor gauge. Brightness follows the n = 3 polytrope density profile;
 * concentric burning shells (iron, silicon, oxygen, envelope) pulse slowly.
 */
export default function CoreGauge({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !active) return;

    const p = readPalette();
    const shells = [p.gold, p.red, p.violet, p.cyan].map(hexToRgb);
    const bg = hexToRgb(p.void);
    const { density } = laneEmden(3);
    const bayer = bayer8();
    const image = ctx.createImageData(SIZE, SIZE);
    const c = SIZE / 2;

    const render = (_dt: number, now: number) => {
      const t = now / 1000;
      const pulse = 1 + 0.06 * Math.sin(t * 2.4);
      const data = image.data;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const r = Math.hypot(x + 0.5 - c, y + 0.5 - c) / (c * 0.95 * pulse);
          const o = (y * SIZE + x) * 4;
          let color = bg;
          if (r < 1) {
            const rho = density[Math.min(density.length - 1, Math.floor(r * density.length))]!;
            // Lift the faint outer layers so they still dither visibly.
            const intensity = Math.pow(rho, 0.35);
            const shell = r < 0.22 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : 3;
            if (intensity > bayer[(y % 8) * 8 + (x % 8)]!) color = shells[shell]!;
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
      render(0, 0);
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
