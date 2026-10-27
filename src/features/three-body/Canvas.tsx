'use client';

import { useEffect, useRef, useState } from 'react';
import { emit, on } from '@/lib/events';
import { prefersReducedMotion, watchReducedMotion } from '@/lib/motion';
import { asset } from '@/lib/asset';
import { readPalette, readTokens } from '@/lib/palette';
import { bufferSize } from './buffer';
import { ENGINE_PALETTE, MAX_PIXELS } from './engine-layout';
import type { LabMessage, LabOutput } from './lab';
import { startLab, type LabInit } from './start';
import type { WorkerInit } from './worker';

/** The default seed; ?seed=N in the URL replays a specific run. */
const DEFAULT_SEED = 318;

function seedFromUrl(): number {
  const n = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isInteger(n) && n > 0 && n < 2 ** 32 ? n : DEFAULT_SEED;
}

/**
 * Layer 0: the three-body background. Prefers a Web Worker drawing on an OffscreenCanvas;
 * falls back to the main thread. Either way it runs the Go/WASM engine when engine.wasm
 * loads, and the TypeScript solver when it doesn't.
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
      if (out.type === 'ready')
        emit('threebody:ready', { presets: out.presets, engine: out.engine });
      else if (out.type === 'telemetry') emit('threebody:telemetry', out.telemetry);
      else if (out.type === 'event')
        emit('threebody:event', { kind: out.kind, message: out.message });
      else emit('core:critical', { critical: out.critical });
    };

    const size = () => {
      const b = bufferSize(window.innerWidth, window.innerHeight, 480, MAX_PIXELS);
      canvas.style.width = `${b.width * b.scale}px`;
      canvas.style.height = `${b.height * b.scale}px`;
      return b;
    };
    const initial = size();
    const init: LabInit = {
      palette: readPalette(),
      colors: readTokens(ENGINE_PALETTE),
      reduced: prefersReducedMotion(),
      wasmUrl:
        typeof WebAssembly === 'object'
          ? new URL(asset('/engine.wasm'), window.location.href).href
          : null,
      seed: seedFromUrl(),
    };

    let send: (msg: LabMessage) => void = () => {};
    let worker: Worker | null = null;

    if ('transferControlToOffscreen' in canvas && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        const offscreen = canvas.transferControlToOffscreen();
        const msg: WorkerInit = {
          ...init,
          type: 'init',
          canvas: offscreen,
          width: initial.width,
          height: initial.height,
        };
        worker.postMessage(msg, [offscreen]);
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
      if (ctx) send = startLab(ctx, init, onOutput);
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
      on('threebody:age', () => send({ type: 'age' })),
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
