/** Larson scanner timing, shared by K.A.R.L. and the field scanner. Pure, for tests. */
export const CELLS = 12;
const CORE = 2;
const TRAIL = 6;
export const SWEEP_SECONDS = 1;
/** Faster sweep while K.A.R.L.'s host star is critical (the brief allows 0.4–1.2 s). */
export const CRITICAL_SWEEP_SECONDS = 0.45;

/** Brightness (0–1) of each cell at time t: a 2-cell core sweeping with a fading trail. */
export function larsonLevels(t: number, sweep = SWEEP_SECONDS): number[] {
  const phase = (t / sweep) % 2;
  const forward = phase < 1;
  const travel = CELLS - CORE;
  const head = Math.round((forward ? phase : 2 - phase) * travel);
  return Array.from({ length: CELLS }, (_, i) => {
    if (i >= head && i < head + CORE) return 1;
    const behind = forward ? head - i : i - (head + CORE - 1);
    return behind > 0 && behind <= TRAIL ? 0.7 * (1 - behind / (TRAIL + 1)) : 0.08;
  });
}
