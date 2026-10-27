import { emit } from './events';

const REDUCED = '(prefers-reduced-motion: reduce)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

export function prefersReducedMotion(): boolean {
  return matches(REDUCED);
}

export function hasFinePointer(): boolean {
  return matches(FINE_POINTER);
}

/** Calls `cb` (and emits motion:reduced) whenever the reduced-motion preference changes. */
export function watchReducedMotion(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(REDUCED);
  const listener = () => {
    cb(mq.matches);
    emit('motion:reduced', { reduced: mq.matches });
  };
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}

/**
 * A requestAnimationFrame loop that pauses while the tab is hidden.
 * `tick` receives elapsed seconds since the previous frame (clamped to 0.1 s).
 */
export function animationLoop(tick: (dt: number, now: number) => void): {
  start: () => void;
  stop: () => void;
  dispose: () => void;
} {
  let raf = 0;
  let last = 0;
  let wanted = false;

  const frame = (now: number) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    tick(dt, now);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? halt() : wanted && run());
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start: () => {
      wanted = true;
      run();
    },
    stop: () => {
      wanted = false;
      halt();
    },
    dispose: () => {
      wanted = false;
      halt();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
