'use client';

import { useEffect, useRef } from 'react';
import { on } from '@/lib/events';
import { animationLoop, hasFinePointer, prefersReducedMotion } from '@/lib/motion';
import { readPalette } from '@/lib/palette';
import { ParticlePool, POOL_SIZE, particleSize, rampIndex } from './particles';
import { buildShipSheet, FRAME_SIZE, frameForAngle } from '@/lib/ship-sprite';

const LERP = 0.18;
/** Overlay pixels are 2 CSS pixels wide. */
const SCALE = 2;
const BODY_CLASS = 'ship-cursor';

/**
 * The inspection probe: a magnetic yoke (body plus two legs) with gold poles, 11 × 10 px,
 * as [x, y, w, h, colour] rects. Drawn instead of the ship while inspection mode is on.
 */
const YOKE: [number, number, number, number, 'cyan' | 'gold'][] = [
  [0, 0, 11, 2, 'cyan'],
  [0, 2, 2, 6, 'cyan'],
  [9, 2, 2, 6, 'cyan'],
  [0, 8, 2, 2, 'gold'],
  [9, 8, 2, 2, 'gold'],
];

/**
 * Layer 3: the spaceship cursor. Only runs with a fine hovering pointer and without
 * reduced motion; it steps aside (restoring the native cursor) while K.A.R.L.'s modal
 * dialog is open, because a modal dialog renders above every z-index.
 */
export default function ShipCursor() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const palette = readPalette();
    const ramp = [palette.ink, palette.cyan, palette.gold, palette.red, palette.violet];
    const sheet = buildShipSheet(palette);
    const pool = new ParticlePool();

    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ship = { ...target, angle: -Math.PI / 2 };
    let seen = false;
    let suspended = false;
    let probe = false;

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / SCALE);
      canvas.height = Math.ceil(window.innerHeight / SCALE);
      canvas.style.width = `${canvas.width * SCALE}px`;
      canvas.style.height = `${canvas.height * SCALE}px`;
      ctx.imageSmoothingEnabled = false;
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!seen || suspended) return;

      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      // Frame-rate independent form of `ship += (target - ship) * LERP` at 60 Hz.
      const k = 1 - Math.pow(1 - LERP, dt * 60);
      ship.x += dx * k;
      ship.y += dy * k;
      const moving = Math.hypot(dx, dy) > 1;
      if (moving) ship.angle = Math.atan2(dy, dx);

      if (moving && !probe) {
        const count = 2 + Math.floor(Math.random() * 3);
        const bx = ship.x / SCALE - Math.cos(ship.angle) * 6;
        const by = ship.y / SCALE - Math.sin(ship.angle) * 6;
        for (let i = 0; i < count; i++) {
          const spread = (Math.random() - 0.5) * 0.8;
          const speed = 0.5 + Math.random() * 0.6;
          pool.spawn(
            bx,
            by,
            -Math.cos(ship.angle + spread) * speed,
            -Math.sin(ship.angle + spread) * speed,
            0.4 + Math.random() * 0.3,
          );
        }
      }
      pool.update(dt);

      for (let i = 0; i < POOL_SIZE; i++) {
        if (pool.life[i]! <= 0) continue;
        const f = pool.fraction(i);
        const s = particleSize(f);
        ctx.fillStyle = ramp[rampIndex(f, ramp.length)]!;
        ctx.fillRect(Math.floor(pool.x[i]! - s / 2), Math.floor(pool.y[i]! - s / 2), s, s);
      }

      if (probe) {
        const px = Math.floor(ship.x / SCALE) - 5;
        const py = Math.floor(ship.y / SCALE) - 5;
        for (const [x, y, w, h, c] of YOKE) {
          ctx.fillStyle = palette[c];
          ctx.fillRect(px + x, py + y, w, h);
        }
      } else {
        const frame = frameForAngle(ship.angle);
        ctx.drawImage(
          sheet,
          frame * FRAME_SIZE,
          0,
          FRAME_SIZE,
          FRAME_SIZE,
          Math.floor(ship.x / SCALE - FRAME_SIZE / 2),
          Math.floor(ship.y / SCALE - FRAME_SIZE / 2),
          FRAME_SIZE,
          FRAME_SIZE,
        );
      }

      // 1 px reticle on the true pointer.
      const tx = Math.floor(target.x / SCALE);
      const ty = Math.floor(target.y / SCALE);
      ctx.fillStyle = palette.cyan;
      ctx.fillRect(tx - 2, ty, 1, 1);
      ctx.fillRect(tx + 2, ty, 1, 1);
      ctx.fillRect(tx, ty - 2, 1, 1);
      ctx.fillRect(tx, ty + 2, 1, 1);
      ctx.fillRect(tx, ty, 1, 1);
    };

    const loop = animationLoop(draw);

    const enabled = () => hasFinePointer() && !prefersReducedMotion();
    const apply = () => {
      const active = enabled() && !suspended;
      document.documentElement.classList.toggle(BODY_CLASS, active && seen);
      if (active) loop.start();
      else {
        loop.stop();
        pool.clear();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    const suspend = (value: boolean) => {
      suspended = value;
      apply();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      target = { x: e.clientX, y: e.clientY };
      if (!seen) {
        seen = true;
        ship.x = target.x;
        ship.y = target.y;
        apply();
      }
    };
    const onLeave = () => {
      seen = false;
      apply();
    };
    const onClick = (e: MouseEvent) => {
      if (suspended || !enabled()) return;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const speed = 1 + Math.random() * 1.5;
        pool.spawn(
          e.clientX / SCALE,
          e.clientY / SCALE,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          0.5,
        );
      }
    };

    const media = [
      window.matchMedia('(hover: hover) and (pointer: fine)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ];
    resize();
    apply();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('click', onClick);
    media.forEach((m) => m.addEventListener('change', apply));
    const unsubs = [
      on('karl:opened', () => suspend(true)),
      on('karl:closed', () => suspend(false)),
      on('shooter:start', () => suspend(true)),
      on('shooter:end', () => suspend(false)),
      on('inspection:mode', ({ on: value }) => {
        probe = value;
      }),
    ];

    return () => {
      loop.dispose();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('click', onClick);
      media.forEach((m) => m.removeEventListener('change', apply));
      unsubs.forEach((u) => u());
      document.documentElement.classList.remove(BODY_CLASS);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pixelated pointer-events-none fixed top-0 left-0 z-50"
    />
  );
}
