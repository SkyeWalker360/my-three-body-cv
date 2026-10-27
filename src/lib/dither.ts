/** Ordered dithering shared by the pixel-art canvases. */

/** Classic recursive 8×8 Bayer matrix, normalised to thresholds in (0, 1). */
export function bayer8(): Float64Array {
  let m = [[0]];
  for (let size = 1; size < 8; size *= 2) {
    const next: number[][] = Array.from({ length: size * 2 }, () => new Array<number>(size * 2));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = 4 * m[y]![x]!;
        next[y]![x] = v;
        next[y]![x + size] = v + 2;
        next[y + size]![x] = v + 3;
        next[y + size]![x + size] = v + 1;
      }
    }
    m = next;
  }
  return Float64Array.from(m.flat(), (v) => (v + 0.5) / 64);
}
