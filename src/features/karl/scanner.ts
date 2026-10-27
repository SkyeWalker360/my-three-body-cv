/** Larson scanner timing. Pure, for tests. */
export const CELLS = 12;
const CORE = 2;
const TRAIL = 6;
export const SWEEP_SECONDS = 1;

/** Brightness (0–1) of each cell at time t: a 2-cell core sweeping with a fading trail. */
export function larsonLevels(t: number): number[] {
  const phase = (t / SWEEP_SECONDS) % 2;
  const forward = phase < 1;
  const travel = CELLS - CORE;
  const head = Math.round((forward ? phase : 2 - phase) * travel);
  return Array.from({ length: CELLS }, (_, i) => {
    if (i >= head && i < head + CORE) return 1;
    const behind = forward ? head - i : i - (head + CORE - 1);
    return behind > 0 && behind <= TRAIL ? 0.7 * (1 - behind / (TRAIL + 1)) : 0.08;
  });
}
