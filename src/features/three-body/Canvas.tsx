'use client';

import { useEffect, useRef, useState } from 'react';
import { emit, on } from '@/lib/events';
import { prefersReducedMotion, watchReducedMotion } from '@/lib/motion';
import { readPalette } from '@/lib/palette';
import { bufferSize } from './buffer';
import { Lab, type LabMessage, type LabOutput } from './lab';
import type { WorkerInit } from './worker';

/**
 * Layer 0: the three-body background. Prefers a Web Worker drawing on an OffscreenCanvas;
 * falls back to running the same Lab on the main thread.
 */
export default function ThreeBodyCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [dimmed, setDimmed] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Created here rather than in JSX: a canvas can hand its control to a worker only once,
    // and React may run this effect twice in development.
    const canvas = document.createElement('canvas');
    canvas.className = 'pixelated block';
    host.appendChild(canvas);

    const onOutput = (out: LabOutput) => {
      if (out.type === 'ready') emit('threebody:ready', { presets: out.presets });
      else emit('threebody:telemetry', out.telemetry);
    };

    const size = () => {
      const b = bufferSize(window.innerWidth, window.innerHeight);
      canvas.style.width = `${b.width * b.scale}px`;
      canvas.style.height = `${b.height * b.scale}px`;
      return b;
    };
    const initial = size();
    const palette = readPalette();
    const reduced = prefersReducedMotion();

    let send: (msg: LabMessage) => void = () => {};
    let worker: Worker | null = null;

    if ('transferControlToOffscreen' in canvas && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        const offscreen = canvas.transferControlToOffscreen();
        const init: WorkerInit = {
          type: 'init',
          canvas: offscreen,
          width: initial.width,
          height: initial.height,
          palette,
          reduced,
        };
        worker.postMessage(init, [offscreen]);
        worker.onmessage = (e: MessageEvent<LabOutput>) => onOutput(e.data);
        const w = worker;
        send = (msg) => w.postMessage(msg);
      } catch {
        worker?.terminate();
        worker = null;
      }
    }

    if (!worker) {
      canvas.width = initial.width;
      canvas.height = initial.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        const lab = new Lab(ctx, palette, reduced, onOutput);
        send = (msg) => lab.handle(msg);
      }
    }

    let shooterActive = false;
    const onResize = () => {
      const b = size();
      send({ type: 'resize', width: b.width, height: b.height });
    };
    const onVisibility = () => {
      if (document.hidden) send({ type: 'pause' });
      else if (!shooterActive) send({ type: 'resume' });
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    const unsubs = [
      on('threebody:preset', (d) => send({ type: 'preset', index: d.index })),
      on('threebody:kick', () => send({ type: 'kick' })),
      on('threebody:shadow', (d) => send({ type: 'shadow', on: d.on })),
      on('karl:opened', () => setDimmed(true)),
      on('karl:closed', () => setDimmed(false)),
      on('shooter:start', () => {
        shooterActive = true;
        send({ type: 'pause' });
      }),
      on('shooter:end', () => {
        shooterActive = false;
        send({ type: 'resume' });
      }),
      watchReducedMotion((r) => send({ type: 'reduced', reduced: r })),
    ];

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubs.forEach((u) => u());
      if (worker) worker.terminate();
      else send({ type: 'pause' });
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-300"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    />
  );
}
