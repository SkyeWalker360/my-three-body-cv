'use client';

import { useEffect, useRef } from 'react';
import { animationLoop, prefersReducedMotion } from '@/lib/motion';
import { CELLS, larsonLevels, SWEEP_SECONDS } from './scanner';

/** K.A.R.L.'s 12-cell scanner. Red (KITT) by default; KARR mode uses the gold token as its amber. */
export default function Larson({ active, karr }: { active: boolean; karr: boolean }) {
  const cells = useRef<(HTMLSpanElement | null)[]>([]);

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
    const loop = animationLoop((_dt, now) => paint(larsonLevels(now / 1000)));
    loop.start();
    return () => loop.dispose();
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className="flex gap-1 border border-red/40 bg-void p-1"
      title={karr ? 'KARR mode' : 'KITT mode'}
    >
      {Array.from({ length: CELLS }, (_, i) => (
        <span key={i} className="block h-3 w-3 bg-void">
          <span
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={`block h-full w-full ${karr ? 'bg-gold' : 'bg-red'}`}
            style={{ opacity: 0.08 }}
          />
        </span>
      ))}
    </div>
  );
}
