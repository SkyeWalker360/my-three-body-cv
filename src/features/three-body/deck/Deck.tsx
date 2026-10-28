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
import { BASE_FOV, DEG, fov } from './camera';
import { exposureValue } from './exposure';
import { bodyCard, columnNm, spectrum } from './instruments';
import type { Overlays } from './overlays';
import { DeckSession } from './session';
import { formatDuration, sci, simToSeconds, TIME_UNIT } from './units';
import { hole, VANTAGES, type VantageId } from './vantages';

const TARGET_WIDTH = 320;
const ENGINE_SPEED = 0.75; // sim units per real second (sim.SimSpeed)
const DEFAULT_SEED = 318;
const WARPS = [0, 1, 2, 4] as const;
const SPECTRUM_W = 96;
const SPECTRUM_H = 32;

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
  bodies: DeckBody[];
  distances: Record<string, number>;
  holeAvailable: boolean;
  eclipses: { name: string; covered: number }[];
  shift: number;
  light: number;
  telemetry: ReturnType<DeckSession['telemetry']>;
  tracking: string | null;
};

const OVERLAY_LABELS: [keyof Overlays, string][] = [
  ['trails', 'TRAILS'],
  ['lagrange', 'LAGRANGE POINTS'],
  ['jacobi', 'JACOBI CURVES'],
  ['labels', 'LABELS'],
];

/** Spectrograph column colour by wavelength, from palette tokens only. */
function bandToken(nm: number): string {
  if (nm < 380) return 'violet-2';
  if (nm < 450) return 'violet-4';
  if (nm < 495) return 'star-4';
  if (nm < 570) return 'green';
  if (nm < 590) return 'gold-3';
  if (nm < 620) return 'star-1';
  if (nm < 750) return 'red-3';
  return 'red-1';
}

/**
 * The Observation Deck: a viewing platform inside the three-body system (Observation Deck
 * brief v3). A native modal dialog with the view on a pixel canvas (aria-hidden) and every
 * readout and instrument in the DOM. It runs its own engine instance, separate from the
 * background lab.
 */
export default function Deck({ initialView }: { initialView?: 'deck' | 'lab' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const spectro = useRef<HTMLCanvasElement>(null);
  const session = useRef<DeckSession | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [announce, setAnnounce] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [warp, setWarp] = useState<(typeof WARPS)[number]>(1);
  const [overlays, setOverlays] = useState<Overlays>({
    trails: false,
    lagrange: false,
    jacobi: false,
    labels: false,
  });
  const [ghost, setGhost] = useState(false);
  const [labView, setLabView] = useState(initialView === 'lab');
  const [events, setEvents] = useState<string[]>([]);
  const preset = useRef(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const warpRef = useRef(warp);
  const labRef = useRef(labView);
  useEffect(() => {
    warpRef.current = warp;
  }, [warp]);
  useEffect(() => {
    labRef.current = labView;
    if (session.current) session.current.labView = labView;
  }, [labView]);
  useEffect(() => {
    if (session.current) session.current.overlays = overlays;
  }, [overlays]);

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
    return on('deck:open', (d) => {
      if (d.view) setLabView(d.view === 'lab');
      show();
    });
  }, [show]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      // A supernova on the deck stops counting once you leave it.
      emit('core:critical', { critical: false });
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
    let scale = 1;
    const lut = colourTable(readTokens(ENGINE_PALETTE));

    const size = (width: number, height: number, s: number) => {
      el.width = width;
      el.height = height;
      el.style.width = `${width * s}px`;
      el.style.height = `${height * s}px`;
      image = ctx.createImageData(width, height);
      words = new Uint32Array(image.data.buffer);
      scale = s;
    };
    const fit = () => {
      const b = bufferSize(box.clientWidth, box.clientHeight, TARGET_WIDTH);
      if (!labRef.current) size(b.width, b.height, b.scale);
      session.current?.resize(b.width, b.height);
      return b;
    };

    const placeLabels = (s: DeckSession) => {
      const host = labels.current;
      if (!host) return;
      if (!s.overlays.labels || labRef.current) {
        if (host.childElementCount) host.replaceChildren();
        return;
      }
      const list = s.lastFrame?.onScreen ?? [];
      while (host.childElementCount < list.length) {
        const span = document.createElement('span');
        span.className = 'absolute font-terminal text-lg leading-none text-ink whitespace-nowrap';
        host.append(span);
      }
      const rect = el.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      [...host.children].forEach((node, i) => {
        const span = node as HTMLElement;
        const o = list[i];
        if (!o || o.body.kind === 'fragment') {
          span.hidden = true;
          return;
        }
        span.hidden = false;
        span.textContent = o.body.name;
        const x = rect.left - boxRect.left + (o.x + o.r + 2) * scale;
        const y = rect.top - boxRect.top + (o.y - o.r - 2) * scale;
        span.style.transform = `translate(${Math.round(x)}px, ${Math.round(y) - 16}px)`;
      });
    };

    let lastHud = 0;
    const loop = animationLoop((dt, now) => {
      const s = session.current;
      if (!s) return;
      s.frame(dt, warpRef.current);
      if (labRef.current) {
        const f = s.labFrame();
        if (!image || image.width !== f.width || image.height !== f.height) {
          const sc = Math.max(
            1,
            Math.floor(Math.min(box.clientWidth / f.width, box.clientHeight / f.height)),
          );
          size(f.width, f.height, sc);
        }
        for (let i = 0; i < f.pixels.length; i++) words![i] = lut[f.pixels[i]!]!;
      } else {
        if (!image || image.width !== s.camera.width || image.height !== s.camera.height) fit();
        const px = s.pixels;
        for (let i = 0; i < px.length; i++) words![i] = lut[px[i]!]!;
      }
      ctx.putImageData(image!, 0, 0);
      placeLabels(s);

      const drained = s.drainEvents();
      // The deck is K.A.R.L.'s own spacer: a star going critical turns its scanner amber.
      for (const e of drained)
        if (e.kind === 'critical') emit('core:critical', { critical: !!e.critical });
      const fresh = drained.filter((e) => e.kind !== 'critical');
      if (fresh.length) setEvents((list) => [...fresh.map((e) => e.message), ...list].slice(0, 6));

      if (now - lastHud > 250) {
        lastHud = now;
        const c = s.camera;
        setHud({
          vantage: VANTAGES[s.vantage].name,
          zoom: c.zoom,
          fovDeg: fov(c) / DEG,
          ev: s.lastFrame ? exposureValue(s.exposure, s.lastFrame.pixelSolidAngle) : 0,
          elapsed: s.elapsed,
          bodies: s.bodies.filter((b) => b.kind !== 'fragment'),
          distances: Object.fromEntries(
            s.bodies.map((b) => [
              b.id,
              Math.hypot(...b.position.map((v, k) => v - c.position[k]!)),
            ]),
          ),
          holeAvailable: hole(s.bodies) !== undefined,
          eclipses: s.eclipses,
          shift: s.lastFrame?.shift ?? 1,
          light: s.light.level,
          telemetry: s.telemetry(),
          tracking: s.tracking,
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
          session.current.labView = labRef.current;
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

  // Leaving the lab view: give the deck its own buffer size back.
  useEffect(() => {
    const box = stage.current;
    const el = canvas.current;
    const s = session.current;
    if (labView || !box || !el || !s) return;
    const b = bufferSize(box.clientWidth, box.clientHeight, TARGET_WIDTH);
    s.resize(b.width, b.height);
  }, [labView]);

  const card = hud?.bodies.find((b) => b.id === selected) ?? null;

  // The spectrograph redraws when the selected star or its temperature changes.
  const spectroT = card && card.temperature > 0 ? Math.round(card.temperature) : 0;
  useEffect(() => {
    const el = spectro.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const names = [
      'void-1',
      'ink',
      ...new Set(Array.from({ length: SPECTRUM_W }, (_, i) => bandToken(columnNm(i, SPECTRUM_W)))),
    ];
    const tokens = readTokens(names);
    const named = new Map(names.map((n, i) => [n, tokens[i]!]));
    ctx.fillStyle = named.get('void-1')!;
    ctx.fillRect(0, 0, SPECTRUM_W, SPECTRUM_H);
    if (!spectroT) return;
    const { bars, peakNm } = spectrum(spectroT, SPECTRUM_W);
    bars.forEach((v, i) => {
      const h = Math.max(1, Math.round(v * (SPECTRUM_H - 2)));
      ctx.fillStyle = named.get(bandToken(columnNm(i, SPECTRUM_W)))!;
      ctx.fillRect(i, SPECTRUM_H - h, 1, h);
    });
    const peakCol = Math.round(((peakNm - 100) / 2400) * SPECTRUM_W);
    if (peakCol >= 0 && peakCol < SPECTRUM_W) {
      ctx.fillStyle = named.get('ink')!;
      for (let y = 0; y < SPECTRUM_H; y += 2) ctx.fillRect(peakCol, y, 1, 1);
    }
  }, [spectroT]);

  const s = () => session.current;
  const lookStep = () => (s() ? fov(s()!.camera) / 12 : 0);

  const select = (b: DeckBody | null) => {
    const sess = s();
    if (!sess || !b) return;
    sess.focus(b);
    setSelected(b.id);
    setAnnounce(`Focused on ${b.name}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const sess = s();
    if (!sess) return;
    if ((e.target as HTMLElement).closest('button, select, input')) {
      if (!e.key.startsWith('Arrow') || (e.target as HTMLElement).closest('input, select')) return;
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
      f: () => select(sess.nearestToCentre()),
    };
    const act = actions[e.key] ?? actions[e.key.toLowerCase()];
    if (!act) return;
    e.preventDefault();
    act();
  };

  // Drag to look; a tap without dragging picks the body under the pointer.
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sess = s();
    const el = canvas.current;
    const d = drag.current;
    if (!d || !sess || !el || labView) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    if (d.moved < 4) return;
    const perPx = fov(sess.camera) / el.getBoundingClientRect().width;
    sess.look(-dx * perPx, dy * perPx);
    drag.current = { x: e.clientX, y: e.clientY, moved: d.moved };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const sess = s();
    const el = canvas.current;
    if (!d || d.moved >= 4 || !sess || !el || labView) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * el.width;
    const y = ((e.clientY - rect.top) / rect.height) * el.height;
    select(sess.pick(x, y));
  };
  const onWheel = (e: React.WheelEvent) => s()?.zoomBy(Math.exp(-e.deltaY * 0.0015));

  const pickPreset = (index: number) => {
    setPresetIndex(index);
    setSelected(null);
    setEvents([]);
    s()?.setPreset(index, seedFromUrl());
  };

  const t = hud?.telemetry;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="deck-title"
      onKeyDown={onKeyDown}
      className="karl-dialog m-0 h-dvh max-h-dvh w-full max-w-none flex-col border-0 bg-void p-0 text-ink open:flex"
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
        <div
          role="group"
          aria-label="Vantage"
          className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto sm:gap-2"
        >
          {(Object.keys(VANTAGES) as VantageId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="btn btn-cyan justify-center px-1 sm:px-4"
              aria-pressed={!labView && hud?.vantage === VANTAGES[id].name}
              disabled={id === 'blackhole' && !hud?.holeAvailable}
              title={
                id === 'blackhole' && !hud?.holeAvailable
                  ? 'Age the blue-white giant until it collapses into a black hole'
                  : undefined
              }
              onClick={() => {
                setLabView(false);
                s()?.setVantage(id);
              }}
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
          onPointerCancel={() => (drag.current = null)}
          onWheel={onWheel}
        />
        <div
          ref={labels}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        />
        {labView && (
          <p className="absolute top-2 left-4 font-terminal text-lg text-gold">
            LAB VIEW: the engine&apos;s own orthographic picture, from above
          </p>
        )}
        {error && (
          <p role="alert" className="absolute font-terminal text-lg text-red">
            {error}
          </p>
        )}
      </div>

      <section
        aria-label="Console"
        className="max-h-[48dvh] space-y-3 overflow-y-auto border-t border-cyan/30 px-4 py-3 font-terminal text-lg"
      >
        <div className="space-y-1">
          <p>
            <span className="text-ink-muted">VANTAGE</span> {hud?.vantage ?? '—'} ·{' '}
            <span className="text-ink-muted">ZOOM</span> {hud ? `${hud.zoom.toFixed(1)}×` : '—'}{' '}
            (FOV {hud ? hud.fovDeg.toFixed(hud.fovDeg < 10 ? 1 : 0) : BASE_FOV / DEG}°) ·{' '}
            <span className="text-ink-muted">EXPOSURE</span> {hud ? `${hud.ev.toFixed(1)} EV` : '—'}
          </p>
          <p>
            <span className="text-ink-muted">TIME</span>{' '}
            {warp === 0 ? 'paused' : `1 s = ${formatDuration(ENGINE_SPEED * TIME_UNIT * warp)}`} ·{' '}
            <span className="text-ink-muted">ELAPSED</span>{' '}
            {hud ? formatDuration(simToSeconds(hud.elapsed)) : '—'}
          </p>
          <p className="text-gold">
            COMPACT SCALE: bodies are drawn at the lab&apos;s size, far larger than life. Distances
            are true.
          </p>
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
            {announce}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section aria-labelledby="deck-bodies" className="space-y-2">
            <h3 id="deck-bodies" className="font-pixel text-xs text-cyan">
              BODIES
            </h3>
            <div className="flex flex-wrap gap-2">
              {hud?.bodies.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="btn btn-ghost"
                  aria-pressed={selected === b.id}
                  onClick={() => select(b)}
                >
                  {b.name.toUpperCase()}
                </button>
              ))}
            </div>
            {card && hud ? (
              <dl
                aria-label={`${card.name} body card`}
                className="grid grid-cols-[auto_1fr] gap-x-3"
              >
                <dt className="text-ink-muted">Name</dt>
                <dd>
                  {card.name}
                  {hud.tracking === card.id ? ' (tracking)' : ''}
                </dd>
                {bodyCard(card, hud.distances[card.id] ?? 0).map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-ink-muted">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-ink-muted">Pick a body, tap one in the window, or press F.</p>
            )}
          </section>

          <section aria-labelledby="deck-spectro" className="space-y-2">
            <h3 id="deck-spectro" className="font-pixel text-xs text-cyan">
              SPECTROGRAPH
            </h3>
            <canvas
              ref={spectro}
              width={SPECTRUM_W}
              height={SPECTRUM_H}
              aria-hidden="true"
              className="pixelated h-24 w-72 max-w-full border border-cyan/30"
            />
            <p>
              {card && card.temperature > 0
                ? `${card.name}: blackbody at ${Math.round(card.temperature)} K, peak ${Math.round(2.897771955e6 / card.temperature)} nm (Wien's law). 100–2500 nm shown; the visible band is coloured.`
                : 'Select a star to see its blackbody spectrum.'}
            </p>
          </section>

          <section aria-labelledby="deck-controls" className="space-y-2">
            <h3 id="deck-controls" className="font-pixel text-xs text-cyan">
              CONTROLS
            </h3>
            <div role="group" aria-label="Time" className="flex flex-wrap gap-2">
              {WARPS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="btn btn-ghost"
                  aria-pressed={warp === w}
                  onClick={() => setWarp(w)}
                >
                  {w === 0 ? 'PAUSE' : `${w}×`}
                </button>
              ))}
            </div>
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
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-gold" onClick={() => s()?.zoomBy(1.5)}>
                ZOOM +
              </button>
              <button type="button" className="btn btn-gold" onClick={() => s()?.zoomBy(1 / 1.5)}>
                ZOOM −
              </button>
              <button
                type="button"
                className="btn btn-cyan"
                onClick={() => select(s()?.nearestToCentre() ?? null)}
              >
                FOCUS (F)
              </button>
              <button type="button" className="btn btn-violet" onClick={() => s()?.age()}>
                AGE A STAR
              </button>
              <button type="button" className="btn btn-violet" onClick={() => s()?.kick()}>
                KICK
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={ghost}
                onClick={() => {
                  s()?.setGhost(!ghost);
                  setGhost(!ghost);
                }}
              >
                CHAOS GHOST
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={labView}
                onClick={() => setLabView(!labView)}
              >
                LAB VIEW
              </button>
            </div>
            <fieldset className="flex flex-wrap gap-x-4">
              <legend className="text-ink-muted">OVERLAYS</legend>
              {OVERLAY_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overlays[key]}
                    onChange={(e) => setOverlays({ ...overlays, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="deck-telemetry">
            <h3 id="deck-telemetry" className="font-pixel text-xs text-cyan">
              TELEMETRY
            </h3>
            {t && (
              <p>
                K {t.kinetic.toFixed(4)} · U {t.potential.toFixed(4)} · E {t.total.toFixed(4)} ·
                |ΔE/E₀| {sci(t.drift, 1)}
                {ghost ? ` · ghost gap ${sci(t.ghostGap, 2)} AU` : ''}
              </p>
            )}
          </section>
          <section aria-labelledby="deck-events">
            <h3 id="deck-events" className="font-pixel text-xs text-cyan">
              EVENTS
            </h3>
            <ol aria-live="polite" className="text-gold">
              {events.length ? (
                events.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)
              ) : (
                <li className="text-ink-muted">Quiet. Age a star to change that.</li>
              )}
            </ol>
          </section>
        </div>
        <p className="text-sm text-ink-muted">
          Drag or arrow keys to look · tap a body to focus · +/− or the wheel to zoom · F to centre
          the nearest body · Esc to leave.
        </p>
      </section>
    </dialog>
  );
}
