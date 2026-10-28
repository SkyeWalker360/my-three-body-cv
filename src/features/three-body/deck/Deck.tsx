'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { emit, on } from '@/lib/events';
import { animationLoop, prefersReducedMotion } from '@/lib/motion';
import { readTokens } from '@/lib/palette';
import { bufferSize } from '../buffer';
import { ENGINE_PALETTE } from '../engine-layout';
import { colourTable, loadEngine } from '../engine';
import { PRESETS } from '../presets';
import type { DeckBody } from './bodies';
import { angularRadius, BASE_FOV, DEG, fov } from './camera';
import { exposureValue } from './exposure';
import { DeckSession } from './session';
import { formatDuration, lightTravelSeconds, sci, simToSeconds, TIME_UNIT } from './units';
import { hole, VANTAGES, type VantageId } from './vantages';

const TARGET_WIDTH = 320;
const ENGINE_SPEED = 0.75; // sim units per real second (sim.SimSpeed)
const DEFAULT_SEED = 318;

function seedFromUrl(): number {
  const n = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SEED;
}

type Hud = {
  vantage: string;
  zoom: number;
  fovDeg: number;
  ev: number;
  elapsed: number;
  focus: DeckBody | null;
  focusDistance: number;
  holeAvailable: boolean;
  eclipses: { name: string; covered: number }[];
  shift: number;
  light: number;
};

/**
 * The Observation Deck: a viewing platform inside the three-body system (Observation Deck
 * brief v3). A native modal dialog with the view on a pixel canvas (aria-hidden) and every
 * readout and control in the DOM. It runs its own engine instance, separate from the
 * background lab.
 */
export default function Deck() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<DeckSession | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [focusName, setFocusName] = useState<string | null>(null);
  const preset = useRef(0);
  const [presetIndex, setPresetIndex] = useState(0);

  useEffect(
    () =>
      on('threebody:telemetry', (t) => {
        preset.current = t.preset.index;
      }),
    [],
  );

  const show = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    opener.current = document.activeElement;
    d.showModal();
    setOpen(true);
    emit('deck:opened');
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      show();
    }
    return on('deck:open', show);
  }, [show]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      emit('deck:closed');
      const o = opener.current;
      if (o instanceof HTMLElement) o.focus();
    };
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
  }, []);

  // While open: load the engine once, size the buffer to the stage, and run the view.
  useEffect(() => {
    if (!open) return;
    const el = canvas.current;
    const box = stage.current;
    const ctx = el?.getContext('2d');
    if (!el || !box || !ctx) return;
    let disposed = false;
    let image: ImageData | null = null;
    let words: Uint32Array | null = null;
    const lut = colourTable(readTokens(ENGINE_PALETTE));

    const fit = () => {
      const s = session.current;
      const { width, height, scale } = bufferSize(box.clientWidth, box.clientHeight, TARGET_WIDTH);
      el.width = width;
      el.height = height;
      el.style.width = `${width * scale}px`;
      el.style.height = `${height * scale}px`;
      image = ctx.createImageData(width, height);
      words = new Uint32Array(image.data.buffer);
      s?.resize(width, height);
      return { width, height };
    };

    let lastHud = 0;
    const loop = animationLoop((dt, now) => {
      const s = session.current;
      if (!s || !image || !words) return;
      s.frame(dt, 1);
      const px = s.pixels;
      for (let i = 0; i < px.length; i++) words[i] = lut[px[i]!]!;
      ctx.putImageData(image, 0, 0);
      if (now - lastHud > 250) {
        lastHud = now;
        const focus = s.nearestToCentre();
        const c = s.camera;
        setHud({
          vantage: VANTAGES[s.vantage].name,
          zoom: c.zoom,
          fovDeg: fov(c) / DEG,
          ev: s.lastFrame ? exposureValue(s.exposure, s.lastFrame.pixelSolidAngle) : 0,
          elapsed: s.elapsed,
          focus,
          focusDistance: focus
            ? Math.hypot(...focus.position.map((v, k) => v - c.position[k]!))
            : 0,
          holeAvailable: hole(s.bodies) !== undefined,
          eclipses: s.eclipses,
          shift: s.lastFrame?.shift ?? 1,
          light: s.light.level,
        });
      }
    });

    const observer = new ResizeObserver(() => fit());
    observer.observe(box);

    (async () => {
      try {
        if (!session.current) {
          const engine = await loadEngine(asset('/engine.wasm'));
          if (disposed) return;
          const { width, height } = fit();
          setPresetIndex(preset.current);
          session.current = new DeckSession(
            engine,
            width,
            height,
            preset.current,
            seedFromUrl(),
            prefersReducedMotion(),
          );
        }
        fit();
        loop.start();
      } catch {
        setError('The deck needs WebAssembly, which this browser has turned off.');
      }
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      loop.dispose();
    };
  }, [open]);

  const s = () => session.current;
  const lookStep = () => (s() ? fov(s()!.camera) / 12 : 0);
  const announceFocus = (b: DeckBody | null) => setFocusName(b ? `Focused on ${b.name}` : null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const sess = s();
    if (!sess) return;
    if ((e.target as HTMLElement).closest('button, select')) {
      if (!e.key.startsWith('Arrow')) return;
    }
    const step = lookStep();
    const actions: Record<string, () => void> = {
      ArrowLeft: () => sess.look(-step, 0),
      ArrowRight: () => sess.look(step, 0),
      ArrowUp: () => sess.look(0, step),
      ArrowDown: () => sess.look(0, -step),
      '+': () => sess.zoomBy(1.25),
      '=': () => sess.zoomBy(1.25),
      '-': () => sess.zoomBy(1 / 1.25),
      f: () => {
        const b = sess.nearestToCentre();
        if (b) sess.focus(b);
        announceFocus(b);
      },
    };
    const act = actions[e.key] ?? actions[e.key.toLowerCase()];
    if (!act) return;
    e.preventDefault();
    act();
  };

  // Drag to look: one buffer pixel of drag turns the view by one pixel's worth of angle.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sess = s();
    const el = canvas.current;
    if (!drag.current || !sess || !el) return;
    const perPx = fov(sess.camera) / el.getBoundingClientRect().width;
    sess.look(-(e.clientX - drag.current.x) * perPx, (e.clientY - drag.current.y) * perPx);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => (drag.current = null);
  const onWheel = (e: React.WheelEvent) => s()?.zoomBy(Math.exp(-e.deltaY * 0.0015));

  const pickVantage = (id: VantageId) => s()?.setVantage(id);
  const pickPreset = (index: number) => {
    setPresetIndex(index);
    s()?.setPreset(index, seedFromUrl());
  };

  const focus = hud?.focus;
  const theta = focus && hud ? angularRadius(focus.trueRadius, hud.focusDistance) : 0;
  const magnification = focus ? focus.radius / focus.trueRadius : 1;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="deck-title"
      onKeyDown={onKeyDown}
      className="karl-dialog m-0 h-dvh open:flex max-h-dvh w-full max-w-none flex-col border-0 bg-void p-0 text-ink"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-cyan/30 px-4 py-2">
        <h2 id="deck-title" className="mr-auto font-pixel text-xs text-cyan">
          OBSERVATION DECK
        </h2>
        <form method="dialog" className="sm:order-last">
          <button type="submit" className="btn btn-red">
            EXIT
          </button>
        </form>
        <div role="group" aria-label="Vantage" className="flex w-full gap-2 sm:w-auto">
          {(Object.keys(VANTAGES) as VantageId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="btn btn-cyan flex-1 sm:flex-none"
              aria-pressed={hud?.vantage === VANTAGES[id].name}
              disabled={id === 'blackhole' && !hud?.holeAvailable}
              title={
                id === 'blackhole' && !hud?.holeAvailable
                  ? 'Age the blue-white giant until it collapses into a black hole'
                  : undefined
              }
              onClick={() => pickVantage(id)}
            >
              {VANTAGES[id].short}
              <span className="sr-only"> ({VANTAGES[id].name})</span>
            </button>
          ))}
        </div>
      </header>

      <div
        ref={stage}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvas}
          aria-hidden="true"
          className="pixelated cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        {error && (
          <p role="alert" className="absolute font-terminal text-lg text-red">
            {error}
          </p>
        )}
      </div>

      <section
        aria-label="Console"
        className="grid gap-3 border-t border-cyan/30 px-4 py-3 font-terminal text-lg sm:grid-cols-[1fr_auto]"
      >
        <div className="space-y-1">
          <p>
            <span className="text-ink-muted">VANTAGE</span> {hud?.vantage ?? '—'} ·{' '}
            <span className="text-ink-muted">ZOOM</span> {hud ? `${hud.zoom.toFixed(1)}×` : '—'}{' '}
            (FOV {hud ? hud.fovDeg.toFixed(hud.fovDeg < 10 ? 1 : 0) : BASE_FOV / DEG}°) ·{' '}
            <span className="text-ink-muted">EXPOSURE</span> {hud ? `${hud.ev.toFixed(1)} EV` : '—'}
          </p>
          <p>
            <span className="text-ink-muted">TIME</span> 1 s ={' '}
            {formatDuration(ENGINE_SPEED * TIME_UNIT)} ·{' '}
            <span className="text-ink-muted">ELAPSED</span>{' '}
            {hud ? formatDuration(simToSeconds(hud.elapsed)) : '—'}
          </p>
          <p className="text-gold">
            COMPACT SCALE: bodies are drawn at the lab&apos;s size, far larger than life. Distances
            are true.
          </p>
          {focus && hud && (
            <p>
              <span className="text-ink-muted">NEAREST TO CENTRE</span> {focus.name}
              {focus.starKind ? ` (${focus.starKind}, ${focus.phase})` : ''}
              {focus.era ? ` (${focus.era})` : ''} · {hud.focusDistance.toFixed(2)} AU · light{' '}
              {formatDuration(lightTravelSeconds(hud.focusDistance))} · true size{' '}
              {sci((2 * theta) / DEG, 2)}° · drawn ×{sci(magnification, 1)}
            </p>
          )}
          {hud && hud.eclipses.length > 0 && (
            <p className="text-gold">
              <span className="text-ink-muted">ECLIPSE</span>{' '}
              {hud.eclipses
                .map((e) => `${e.name} ${Math.round(e.covered * 100)}% covered`)
                .join(' · ')}{' '}
              · deck light {Math.round(hud.light * 100)}%
            </p>
          )}
          {hud && hud.shift > 1.0005 && (
            <p className="text-cyan">
              <span className="text-ink-muted">GRAVITATIONAL BLUESHIFT</span> incoming light ×
              {hud.shift.toFixed(3)} (+{((hud.shift - 1) * 100).toFixed(1)}%) · lensed sky
            </p>
          )}
          <p role="status" className="sr-only">
            {focusName ?? ''}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">SYSTEM</span>
            <select
              className="border border-cyan/50 bg-void px-2 py-1 text-ink"
              value={presetIndex}
              onChange={(e) => pickPreset(Number(e.target.value))}
            >
              {PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-gold" onClick={() => s()?.zoomBy(1.5)}>
            ZOOM +
          </button>
          <button type="button" className="btn btn-gold" onClick={() => s()?.zoomBy(1 / 1.5)}>
            ZOOM −
          </button>
          <button type="button" className="btn btn-violet" onClick={() => s()?.age()}>
            AGE A STAR
          </button>
          <button
            type="button"
            className="btn btn-cyan"
            onClick={() => {
              const sess = s();
              const b = sess?.nearestToCentre() ?? null;
              if (sess && b) sess.focus(b);
              announceFocus(b);
            }}
          >
            FOCUS (F)
          </button>
        </div>
        <p className="text-sm text-ink-muted sm:col-span-2">
          Drag or arrow keys to look · +/− or the wheel to zoom · F to centre the nearest body · Esc
          to leave.
        </p>
      </section>
    </dialog>
  );
}
