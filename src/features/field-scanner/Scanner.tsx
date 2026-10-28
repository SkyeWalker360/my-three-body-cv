'use client';

import {
  type KeyboardEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ContactLinks } from '@/components/cv/Contact';
import { emit, on } from '@/lib/events';
import { CELLS, larsonLevels } from '@/lib/larson';
import { manifestData as manifest } from '@/lib/manifest-data';
import { animationLoop, hasFinePointer, prefersReducedMotion } from '@/lib/motion';
import { hexToRgb, type RampName, readRamp } from '@/lib/palette';
import { loadLogbook, saveLogbook } from './logbook';
import { INITIAL, type ScannerAction, type ScannerState, step } from './navigation';
import { buildRegions, type ChipTone, type Specimen, specimenNumber } from './regions';
import { DUST, EMPTY, silhouette, SPRITE_SIZE, specimenSprite } from './sprite';

const CHIP: Record<ChipTone, string> = {
  cyan: 'border-cyan text-cyan',
  gold: 'border-gold text-gold',
  ink: 'border-ink-muted text-ink',
  muted: 'border-ink-muted/60 text-ink-muted',
  violet: 'border-violet text-violet-ink',
};

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right' | 'a' | 'b'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'a',
  z: 'a',
  Z: 'a',
  x: 'b',
  X: 'b',
  Backspace: 'b',
};

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration on this device; haptics are never required.
  }
}

/** Ramp colours as RGB triples, read once per open. */
function rampColours(names: RampName[]): [number, number, number][] {
  return names.flatMap((n) => readRamp(n).map(hexToRgb));
}

/**
 * Layer 2, mobile: the K.A.R.L. Field Scanner. A native modal <dialog> that shows the CV as
 * specimens to scan. It never replaces the HTML CV; it only opens when a visitor asks.
 */
export default function Scanner() {
  const regions = useMemo(() => buildRegions(manifest), []);
  const all = useMemo(() => regions.flatMap((r) => r.specimens), [regions]);
  const sizes = useMemo(() => regions.map((r) => r.specimens.length), [regions]);
  const optionsIndex = regions.length;

  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const leds = useRef<(HTMLSpanElement | null)[]>([]);
  const body = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const detail = useRef<HTMLElement>(null);
  const fromKeyboard = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScannerState>(INITIAL);
  const [logged, setLogged] = useState<Set<string>>(() =>
    loadLogbook(new Set(all.map((s) => s.key))),
  );
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [notice, setNotice] = useState('');
  const [finePointer] = useState(hasFinePointer);

  const region = regions[state.region];
  const current: Specimen | undefined = region?.specimens[state.selected];
  const seen = !!current && (logged.has(current.key) || state.view === 'detail');
  const percent = all.length ? Math.round((logged.size / all.length) * 100) : 0;

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Opening an entry logs it, the first time.
  const logSpecimen = useCallback(
    (specimen: Specimen) => {
      if (logged.has(specimen.key)) return;
      const next = new Set(logged).add(specimen.key);
      setLogged(next);
      saveLogbook(next);
      buzz([12, 30, 24]);
      setNotice(
        next.size === all.length
          ? 'Logbook complete. Final signal detected.'
          : `New specimen logged: ${specimenNumber(specimen.no)}`,
      );
    },
    [all.length, logged],
  );

  const act = useCallback(
    (action: ScannerAction) => {
      if ((action.type === 'up' || action.type === 'down') && state.view === 'detail') {
        body.current?.scrollBy({ top: action.type === 'down' ? 80 : -80 });
        return;
      }
      buzz(10);
      setConfirmWipe(false);
      const next = step(state, action, sizes);
      setState(next);
      const opened = regions[next.region]?.specimens[next.selected];
      if (next.view === 'detail' && opened) logSpecimen(opened);
    },
    [logSpecimen, regions, sizes, state],
  );

  // Keep the keyboard focus on what changed, so screen readers follow along.
  useEffect(() => {
    if (!fromKeyboard.current) return;
    fromKeyboard.current = false;
    if (state.view === 'detail') detail.current?.focus();
    else rows.current[state.selected]?.focus();
  }, [state]);

  useEffect(() => {
    if (state.view === 'list') rows.current[state.selected]?.scrollIntoView({ block: 'nearest' });
    else body.current?.scrollTo({ top: 0 });
  }, [state]);

  // One animation loop for the sprite and the LED strip, only while the dialog is open.
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!open || !ctx) return;
    const [bg, dust] = readRamp('void')
      .filter((_, i) => i === 1 || i === 3)
      .map(hexToRgb) as [[number, number, number], [number, number, number]];
    const image = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
    const cache = new Map<string, [number, number, number][]>();

    const draw = (t: number) => {
      if (current) {
        let frame = specimenSprite(current.key, current.sprite, current.ramp, t);
        if (!seen) frame = silhouette(frame);
        const id = frame.ramps.join();
        let colours = cache.get(id);
        if (!colours) cache.set(id, (colours = rampColours(frame.ramps)));
        const d = image.data;
        frame.cells.forEach((v, i) => {
          const c = v === EMPTY ? bg : v === DUST ? dust : colours[v]!;
          d[i * 4] = c[0];
          d[i * 4 + 1] = c[1];
          d[i * 4 + 2] = c[2];
          d[i * 4 + 3] = 255;
        });
        ctx.putImageData(image, 0, 0);
      } else {
        // Options screen: K.A.R.L.'s ship.
        const frame = specimenSprite('options', 'ship', 'cyan', t);
        const colours = rampColours(frame.ramps);
        const d = image.data;
        frame.cells.forEach((v, i) => {
          const c = v === EMPTY ? bg : v === DUST ? dust : colours[v]!;
          d.set([c[0], c[1], c[2], 255], i * 4);
        });
        ctx.putImageData(image, 0, 0);
      }
      larsonLevels(t).forEach((l, i) => {
        const el = leds.current[i];
        if (el) el.style.opacity = String(l);
      });
    };

    if (prefersReducedMotion()) {
      draw(0.5);
      return;
    }
    let elapsed = 0;
    const loop = animationLoop((dt) => draw((elapsed += dt)));
    loop.start();
    return () => loop.dispose();
  }, [current, open, seen]);

  const show = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    opener.current = document.activeElement;
    d.showModal();
    setOpen(true);
    emit('scanner:opened');
  }, []);

  const close = useCallback(() => dialog.current?.close(), []);

  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      show();
    }
    return on('scanner:open', show);
  }, [show]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      setConfirmWipe(false);
      emit('scanner:closed');
      const o = opener.current;
      if (o instanceof HTMLElement) o.focus();
    };
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const type = KEYS[e.key];
    if (!type) return;
    // Enter on a focused button already clicks it.
    if (e.key === 'Enter' && (e.target as HTMLElement).closest('button, a')) return;
    e.preventDefault();
    fromKeyboard.current = true;
    act({ type });
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
      act({ type: dx < 0 ? 'right' : 'left' });
  };

  const logEverything = () => {
    const next = new Set(all.map((s) => s.key));
    setLogged(next);
    saveLogbook(next);
    setNotice('Every specimen logged. Final signal detected.');
  };
  const wipe = () => {
    const next = new Set<string>();
    setLogged(next);
    saveLogbook(next);
    setConfirmWipe(false);
    setNotice('Logbook wiped.');
  };
  const engage = () => {
    close();
    emit('shooter:launch');
  };
  const backToCv = () => {
    close();
    document.getElementById('experience-title')?.scrollIntoView();
  };

  const controlBtn =
    'flex size-11 items-center justify-center border-2 border-cyan/50 bg-void font-pixel text-xs text-cyan active:translate-y-0.5 active:bg-cyan active:text-void';

  return (
    <dialog
      ref={dialog}
      aria-labelledby="scanner-title"
      onKeyDown={onKeyDown}
      className="karl-dialog m-0 h-dvh max-h-dvh w-full max-w-none border-0 bg-transparent p-0 text-ink sm:m-auto sm:h-[92dvh] sm:max-h-[56rem] sm:w-[28rem] sm:border-2 sm:border-cyan"
    >
      <div className="glass flex h-full flex-col gap-3 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-3">
          <h2 id="scanner-title" className="shrink-0 font-pixel text-xs leading-relaxed text-cyan">
            K.A.R.L.
            <span className="block text-ink-muted">SCANNER</span>
          </h2>
          <div aria-hidden="true" className="flex flex-1 gap-0.5 border border-red/40 bg-void p-1">
            {Array.from({ length: CELLS }, (_, i) => (
              <span key={i} className="block h-3 flex-1 bg-void">
                <span
                  ref={(el) => {
                    leds.current[i] = el;
                  }}
                  className="block h-full w-full bg-red"
                  style={{ opacity: 0.08 }}
                />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="flex min-h-11 min-w-11 items-center justify-center font-pixel text-xs text-ink-muted hover:text-ink"
            aria-label="Close field scanner"
          >
            ✕
          </button>
        </header>

        <div
          className="flex min-h-0 flex-1 flex-col gap-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Viewer screen */}
          <section
            aria-label="Viewer"
            className="crt flex gap-3 border-2 border-cyan/50 bg-void p-2"
          >
            <canvas
              ref={canvas}
              width={SPRITE_SIZE}
              height={SPRITE_SIZE}
              aria-hidden="true"
              className="pixelated size-32 shrink-0 border border-cyan/30"
            />
            <div className="min-w-0 space-y-1 font-terminal text-lg leading-tight">
              {current ? (
                <>
                  <p className="font-pixel text-xs text-ink-muted">{specimenNumber(current.no)}</p>
                  <p className="text-2xl leading-none text-gold">{seen ? current.name : '? ? ?'}</p>
                  <ul className="flex flex-wrap gap-1" aria-label="Types">
                    {current.chips.map((c) => (
                      <li key={c.label} className={`border px-1 ${CHIP[c.tone]}`}>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  {current.habitat && (
                    <p className="text-ink-muted">{seen ? current.habitat : 'Habitat unknown'}</p>
                  )}
                  <p className={logged.has(current.key) ? 'text-green' : 'text-ink-muted'}>
                    {logged.has(current.key) ? '● LOGGED' : '○ PRESS A TO SCAN'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-pixel text-xs text-ink-muted">SYS</p>
                  <p className="text-2xl leading-none text-gold">Options</p>
                  <p className="text-ink-muted">
                    Logbook {logged.size}/{all.length}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Log screen */}
          <section
            aria-label="Log"
            className="flex min-h-0 flex-1 flex-col border-2 border-cyan/50 bg-void"
          >
            <div
              role="tablist"
              aria-label="Regions"
              className="flex shrink-0 overflow-x-auto border-b-2 border-cyan/40"
            >
              {[...regions.map((r) => r.label), 'OPTIONS'].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  id={`scanner-tab-${i}`}
                  aria-selected={i === state.region}
                  aria-controls="scanner-panel"
                  tabIndex={i === state.region ? 0 : -1}
                  onClick={() => act({ type: 'tab', region: i })}
                  className={`min-h-11 shrink-0 px-2 font-terminal text-lg ${
                    i === state.region ? 'bg-cyan text-void' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              ref={body}
              id="scanner-panel"
              role="tabpanel"
              aria-labelledby={`scanner-tab-${state.region}`}
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {state.region === optionsIndex ? (
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <h3 className="font-pixel text-xs text-gold">PILOT</h3>
                    <p className="mt-1">{manifest.person.name}</p>
                    <p className="text-ink-muted">{manifest.person.title}</p>
                  </div>
                  <ContactLinks person={manifest.person} />
                  <div>
                    <h3 className="font-pixel text-xs text-gold">LOGBOOK</h3>
                    <p className="mt-1">
                      {logged.size} of {all.length} specimens logged.{' '}
                      {logged.size === all.length
                        ? 'Final signal detected.'
                        : 'Log them all to find the final signal.'}
                    </p>
                    {logged.size === all.length &&
                      (finePointer ? (
                        <button type="button" onClick={engage} className="btn btn-red mt-2">
                          ENGAGE THE ARCHITECT
                        </button>
                      ) : (
                        <p className="mt-1 text-ink-muted">
                          The Architect waits on a desktop, with a keyboard.
                        </p>
                      ))}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={logEverything} className="btn btn-ghost">
                        LOG EVERYTHING
                      </button>
                      {confirmWipe ? (
                        <>
                          <button type="button" onClick={wipe} className="btn btn-red">
                            YES, WIPE IT
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmWipe(false)}
                            className="btn btn-ghost"
                          >
                            KEEP IT
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmWipe(true)}
                          className="btn btn-red"
                        >
                          WIPE LOGBOOK
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={backToCv} className="btn btn-cyan">
                    READ THE FULL CV
                  </button>
                </div>
              ) : state.view === 'list' ? (
                <ul aria-label={`${region?.label ?? ''} specimens`}>
                  {region?.specimens.map((s, i) => {
                    const got = logged.has(s.key);
                    const selected = i === state.selected;
                    return (
                      <li key={s.key}>
                        <button
                          ref={(el) => {
                            rows.current[i] = el;
                          }}
                          type="button"
                          aria-current={selected ? 'true' : undefined}
                          aria-label={`Specimen ${specimenNumber(s.no).slice(1)}, ${
                            got ? s.name : 'not scanned'
                          }`}
                          onClick={() => act({ type: 'pick', index: i })}
                          className={`grid min-h-11 w-full grid-cols-[3.5rem_minmax(0,1fr)_1rem] items-center gap-2 px-2 text-left font-terminal text-xl ${
                            selected ? 'bg-cyan/15 text-cyan' : 'text-ink'
                          }`}
                        >
                          <span className="text-ink-muted">{specimenNumber(s.no)}</span>
                          <span className="truncate">
                            {selected && (
                              <span aria-hidden="true" className="text-gold">
                                ▶{' '}
                              </span>
                            )}
                            {got ? s.name : '? ? ? ? ?'}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`size-3 border-2 ${got ? 'border-green bg-green' : 'border-cyan/50'}`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                current && (
                  <article
                    ref={detail}
                    tabIndex={-1}
                    aria-live="polite"
                    aria-labelledby="scanner-entry-name"
                    className="space-y-3 text-sm leading-relaxed outline-none"
                  >
                    <h3 id="scanner-entry-name" className="sr-only">
                      {current.name}
                    </h3>
                    {current.period && (
                      <p className="font-terminal text-lg text-ink-muted">{current.period}</p>
                    )}
                    <div>
                      <h4 className="font-pixel text-xs text-gold">
                        {current.siteCopy ? 'LAB NOTE' : 'OBSERVATION LOG'}
                      </h4>
                      {current.log.map((block, i) => (
                        <div key={i} className="mt-2">
                          {block.heading && <p className="font-bold text-cyan">{block.heading}</p>}
                          {block.lines.length > 1 ? (
                            <ul className="list-['–_'] space-y-1 pl-4">
                              {block.lines.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{block.lines[0]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {current.chain && (
                      <div>
                        <h4 className="font-pixel text-xs text-gold">EVOLUTION</h4>
                        <ol className="mt-2 flex flex-wrap items-center gap-1 font-terminal text-lg">
                          {current.chain.labels.map((label, i) => (
                            <li key={label} className="flex items-center gap-1">
                              {i > 0 && <span aria-hidden="true">▸</span>}
                              <span
                                aria-current={i === current.chain!.here ? 'step' : undefined}
                                className={`border px-1 ${
                                  i === current.chain!.here
                                    ? 'border-cyan text-cyan'
                                    : 'border-ink-muted/60 text-ink-muted'
                                }`}
                              >
                                {label}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
            <p
              role="status"
              className="min-h-7 shrink-0 border-t border-cyan/30 px-2 font-terminal text-lg text-gold"
            >
              {notice}
            </p>
          </section>
        </div>

        {/* Controls */}
        <div
          className="flex shrink-0 items-center justify-between gap-2"
          aria-label="Controls"
          role="group"
        >
          <div className="grid grid-cols-[repeat(3,2.75rem)] grid-rows-[repeat(3,2.75rem)]">
            <button
              type="button"
              aria-label="Up"
              onClick={() => act({ type: 'up' })}
              className={`${controlBtn} col-start-2`}
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="Left"
              onClick={() => act({ type: 'left' })}
              className={`${controlBtn} col-start-1 row-start-2`}
            >
              ◀
            </button>
            <span aria-hidden="true" className="col-start-2 row-start-2 bg-void" />
            <button
              type="button"
              aria-label="Right"
              onClick={() => act({ type: 'right' })}
              className={`${controlBtn} col-start-3 row-start-2`}
            >
              ▶
            </button>
            <button
              type="button"
              aria-label="Down"
              onClick={() => act({ type: 'down' })}
              className={`${controlBtn} col-start-2 row-start-3`}
            >
              ▼
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => act({ type: 'options' })}
              className="min-h-11 border border-ink-muted/60 px-2 font-pixel text-xs text-ink-muted"
            >
              OPTIONS
            </button>
            <p className="font-terminal text-lg text-gold" aria-label={`${percent}% logged`}>
              CORE {percent}%
            </p>
          </div>
          <div className="flex items-end gap-3">
            <button
              type="button"
              aria-label="B, back"
              onClick={() => act({ type: 'b' })}
              className="flex size-14 items-center justify-center border-2 border-violet bg-void font-pixel text-xs text-violet-ink active:translate-y-0.5"
            >
              B
            </button>
            <button
              type="button"
              aria-label="A, scan"
              onClick={() => act({ type: 'a' })}
              className="mb-5 flex size-14 items-center justify-center border-2 border-gold bg-void font-pixel text-xs text-gold active:translate-y-0.5"
            >
              A
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
