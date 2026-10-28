'use client';

import { useEffect, useRef, useState } from 'react';
import { on } from '@/lib/events';
import { animationLoop, prefersReducedMotion } from '@/lib/motion';
import { CELLS, CRITICAL_SWEEP_SECONDS, larsonLevels, SWEEP_SECONDS } from './scanner';

/**
 * K.A.R.L.'s 12-cell scanner. Red (KITT) by default; amber (the gold token) in KARR mode or
 * while the three-body engine reports the host star critical, when it also sweeps faster.
 */
export default function Larson({ active, karr }: { active: boolean; karr: boolean }) {
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  const [critical, setCritical] = useState(false);
  const amber = karr || critical;

  useEffect(() => {
    // The event gives an instant switch; telemetry catches up a terminal opened mid-supernova.
    const offs = [
      on('core:critical', (d) => setCritical(d.critical)),
      on('threebody:telemetry', (t) => setCritical(t.engine?.critical ?? false)),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  useEffect(() => {
    const paint = (levels: number[]) =>
      levels.forEach((l, i) => {
        const el = cells.current[i];
        if (el) el.style.opacity = String(l);
      });
    if (!active) return;
    if (prefersReducedMotion()) {
      paint(larsonLevels(SWEEP_SECONDS / 2));
      return;
    }
    const sweep = critical ? CRITICAL_SWEEP_SECONDS : SWEEP_SECONDS;
    const loop = animationLoop((_dt, now) => paint(larsonLevels(now / 1000, sweep)));
    loop.start();
    return () => loop.dispose();
  }, [active, critical]);

  return (
    <div
      aria-hidden="true"
      className="flex gap-1 border border-red/40 bg-void p-1"
      title={karr ? 'KARR mode' : critical ? 'Core critical' : 'KITT mode'}
    >
      {Array.from({ length: CELLS }, (_, i) => (
        <span key={i} className="block h-3 w-3 bg-void">
          <span
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={`block h-full w-full ${amber ? 'bg-gold' : 'bg-red'}`}
            style={{ opacity: 0.08 }}
          />
        </span>
      ))}
    </div>
  );
}
