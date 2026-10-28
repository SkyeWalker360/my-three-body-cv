'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { entryTitle, findEntry, type ManifestEntry } from '@/lib/entries';
import { emit, on } from '@/lib/events';
import { manifestData } from '@/lib/manifest-data';
import { animationLoop, prefersReducedMotion, watchReducedMotion } from '@/lib/motion';
import {
  BAND,
  type Box,
  cellsPath,
  type Defect,
  defects,
  hashString,
  particleAt,
  particlesFor,
  settleTime,
  type Particle,
} from './defects';
import { type Section, writeUps } from './writeups';

/** Cards draw a 1 px border; absolutely positioned children start inside it. */
const BORDER = 1;
const PAD = BAND + BORDER;

type Target = {
  el: HTMLElement;
  host: HTMLElement;
  id: string;
  label: string;
  entry: ManifestEntry;
  groups: Section[][];
};

type Size = { w: number; h: number };
type Open = { id: string; index: number; opener: HTMLElement | null };

const key = (id: string, index: number) => `${id}:${index}`;

/** Finds every CV card with a manifest entry and gives it a host for the overlay. */
function collectTargets(): Target[] {
  const out: Target[] = [];
  document.querySelectorAll<HTMLElement>('[data-destructible][data-id]').forEach((el) => {
    const id = el.dataset.id!;
    const entry = findEntry(manifestData, id);
    if (!entry) return;
    const groups = writeUps(entry);
    if (groups.length === 0) return;
    const host = document.createElement('div');
    host.dataset.inspection = '';
    host.className = 'pointer-events-none absolute inset-0';
    el.append(host);
    out.push({ el, host, id, label: el.dataset.label ?? entryTitle(entry), entry, groups });
  });
  return out;
}

/**
 * Layer 3 easter egg: NDT inspection mode. M toggles it; hidden weld defects in each card's
 * pixel border light up like magnetic particle indications, and each one opens a short
 * write-up taken verbatim from the manifest. With reduced motion the indications appear as
 * static outlines.
 */
export default function Inspection() {
  // Mounted by the first toggle, so it starts switched on.
  const [active, setActive] = useState(true);
  const [targets, setTargets] = useState<Target[]>([]);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<Open | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const particleRefs = useRef<Map<string, SVGRectElement[]>>(new Map());
  const shooting = useRef(false);
  // A short toast confirms the mode came on, then gets out of the way of the CV text.
  const [toast, setToast] = useState(false);

  useEffect(() => watchReducedMotion(setReduced), []);

  useEffect(() => {
    const offs = [
      on('inspection:toggle', () => {
        if (!shooting.current) setActive((a) => !a);
      }),
      on('shooter:start', () => {
        shooting.current = true;
        setActive(false);
      }),
      on('shooter:end', () => {
        shooting.current = false;
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  useEffect(() => emit('inspection:mode', { on: active }), [active]);

  // Attach to the cards while active; track their size so filters and resizes stay correct.
  useEffect(() => {
    if (!active) return;
    const found = collectTargets();
    // The observer reports every card once straight away, which also publishes the targets.
    const observer = new ResizeObserver(() => {
      setTargets(found);
      setSizes(
        Object.fromEntries(found.map((t) => [t.id, { w: t.el.offsetWidth, h: t.el.offsetHeight }])),
      );
    });
    found.forEach((t) => observer.observe(t.el));
    return () => {
      observer.disconnect();
      found.forEach((t) => t.host.remove());
      setTargets([]);
      setSettled(false);
    };
  }, [active]);

  const layout = useMemo(
    () =>
      targets.map((t) => {
        const size = sizes[t.id];
        const found: Defect[] =
          size && size.w > 0 ? defects(hashString(t.id), size.w, size.h, t.groups.length) : [];
        const particles: Particle[][] = found.map((d, i) =>
          particlesFor(d, hashString(key(t.id, i))),
        );
        return { target: t, size, found, particles };
      }),
    [targets, sizes],
  );
  const total = layout.reduce((n, l) => n + l.found.length, 0);
  const animate = active && !reduced && total > 0;

  // One loop drifts every particle onto its crack, then stops and the cracks hold.
  useEffect(() => {
    if (!animate || settled) return;
    const end = Math.max(0, ...layout.flatMap((l) => l.particles.map(settleTime)));
    let t = 0;
    const loop = animationLoop((dt) => {
      t += dt;
      layout.forEach((l) =>
        l.particles.forEach((ps, i) => {
          const rects = particleRefs.current.get(key(l.target.id, i));
          ps.forEach((p, j) => {
            const [x, y] = particleAt(p, t);
            rects?.[j]?.setAttribute('x', String(x));
            rects?.[j]?.setAttribute('y', String(y));
          });
        }),
      );
      if (t >= end) {
        loop.stop();
        setSettled(true);
      }
    });
    loop.start();
    return () => loop.dispose();
  }, [animate, settled, layout]);

  useEffect(() => {
    if (!active) return;
    const show = setTimeout(() => setToast(true), 0);
    const hide = setTimeout(() => setToast(false), 3000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setToast(false);
    };
  }, [active]);

  // Escape switches the mode off when no write-up is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // When the mode comes on, focus the first indication on screen so Tab walks through them.
  useEffect(() => {
    if (!active || total === 0) return;
    const first = [...document.querySelectorAll<HTMLElement>('[data-indication]')].find((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    first?.focus({ preventScroll: true });
    // Only on the first layout after switching on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total > 0]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const openWriteUp = useCallback((id: string, index: number, opener: HTMLElement) => {
    setOpened((s) => new Set(s).add(key(id, index)));
    setOpen({ id, index, opener });
  }, []);

  const onClose = () => {
    const opener = open?.opener;
    setOpen(null);
    opener?.focus();
  };

  const current = open && targets.find((t) => t.id === open.id);
  const cards = layout.filter((l) => l.found.length > 0).length;

  return (
    <>
      <p role="status" className="sr-only">
        {active
          ? `Inspection mode on: ${total} indications on ${cards} cards. Tab between them, Enter opens one, M or Escape switches off.`
          : 'Inspection mode off.'}
      </p>

      {toast && (
        <p
          aria-hidden="true"
          className="pixel-border pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 bg-gold px-4 py-3 font-pixel text-xs whitespace-nowrap text-void [--pixel-border:var(--color-gold)]"
        >
          INSPECTING · {total} FOUND · M TO EXIT
        </p>
      )}

      {active &&
        layout.map(({ target, size, found, particles }) => {
          if (!size || found.length === 0) return null;
          const passed = found.every((_, i) => opened.has(key(target.id, i)));
          const drifting = animate && !settled;
          return createPortal(
            <>
              <svg
                aria-hidden="true"
                width={size.w + BAND * 2}
                height={size.h + BAND * 2}
                viewBox={`${-BAND} ${-BAND} ${size.w + BAND * 2} ${size.h + BAND * 2}`}
                shapeRendering="crispEdges"
                className="absolute overflow-visible"
                style={{ left: -PAD, top: -PAD }}
              >
                {found.map((d, i) => (
                  <g key={i}>
                    {/* The crack is cut into the border, so it reads on every accent colour. */}
                    <rect
                      x={d.band.x}
                      y={d.band.y}
                      width={d.band.w}
                      height={d.band.h}
                      fill="var(--color-void-0)"
                    />
                    {reduced ? (
                      <rect
                        x={d.band.x + 0.5}
                        y={d.band.y + 0.5}
                        width={d.band.w - 1}
                        height={d.band.h - 1}
                        fill="none"
                        stroke="var(--color-gold-3)"
                        strokeDasharray="2 2"
                      />
                    ) : (
                      !drifting && (
                        <>
                          <path d={cellsPath(d.bloom)} fill="var(--color-gold-1)" />
                          <path d={cellsPath(d.glow)} fill="var(--color-gold-2)" />
                        </>
                      )
                    )}
                    {!drifting && (
                      <path
                        d={cellsPath(d.core)}
                        fill={passed ? 'var(--color-green)' : 'var(--color-gold-3)'}
                      />
                    )}
                    {drifting &&
                      particles[i]!.map((p, j) => (
                        <rect
                          key={j}
                          ref={(r) => {
                            const k = key(target.id, i);
                            const list = particleRefs.current.get(k) ?? [];
                            if (r) list[j] = r;
                            particleRefs.current.set(k, list);
                          }}
                          x={p.from[0]}
                          y={p.from[1]}
                          width={2}
                          height={2}
                          fill="var(--color-gold-4)"
                        />
                      ))}
                  </g>
                ))}
              </svg>
              {found.map((d, i) => (
                <IndicationButton
                  key={i}
                  box={d.hit}
                  label={`Indication ${i + 1} of ${found.length} on ${target.label}${
                    opened.has(key(target.id, i)) ? ', opened' : ''
                  }`}
                  onOpen={(el) => openWriteUp(target.id, i, el)}
                />
              ))}
            </>,
            target.host,
            target.id,
          );
        })}

      <dialog
        ref={dialog}
        aria-labelledby="inspection-title"
        onClose={onClose}
        className="pixel-border m-auto max-h-[80dvh] bg-void w-[min(36rem,calc(100vw-2rem))] border border-gold/40 p-6 text-ink [--pixel-border:var(--color-gold)] backdrop:bg-void/80"
      >
        {current && open && (
          <div className="space-y-4">
            <p className="font-terminal text-lg text-gold">
              INDICATION {open.index + 1} OF {current.groups.length}
            </p>
            <h2 id="inspection-title" className="font-pixel text-xs leading-relaxed text-cyan">
              {entryTitle(current.entry)}
            </h2>
            {current.groups[open.index]!.map((s, i) => (
              <div key={i} className="space-y-2">
                {s.title && <h3 className="font-terminal text-lg text-gold">{s.title}</h3>}
                <ul className="list-disc space-y-1 pl-6 text-sm leading-relaxed marker:text-gold">
                  {s.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
            <form method="dialog" className="flex justify-end">
              <button type="submit" className="btn btn-gold" autoFocus>
                CLOSE
              </button>
            </form>
          </div>
        )}
      </dialog>
    </>
  );
}

function IndicationButton({
  box,
  label,
  onOpen,
}: {
  box: Box;
  label: string;
  onOpen: (el: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      data-indication
      aria-label={label}
      aria-haspopup="dialog"
      onClick={(e) => onOpen(e.currentTarget)}
      className="pointer-events-auto absolute cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-gold"
      style={{ left: box.x - BORDER, top: box.y - BORDER, width: box.w, height: box.h }}
    />
  );
}
