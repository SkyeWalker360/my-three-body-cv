/**
 * Pure geometry for NDT inspection mode: hidden weld defects in a card's pixel border.
 *
 * Coordinates are CSS pixels relative to the card's border box. The `pixel-border` utility
 * draws a 4 px band just outside the border box, so every crack cell sits in that band
 * (x or y between -4 and -1, or between the far edge and the far edge + 3) and never reaches
 * the card's padding, where the CV text lives.
 */

export const BAND = 4;
/** At most this many defects per card (Design Brief). */
export const MAX_DEFECTS = 3;
/** Hit targets are 24 px thick (WCAG 2.2 target size), centred on the band. */
export const HIT = 24;
const MIN_LENGTH = 16;
const MAX_LENGTH = 160;

export type Edge = 'top' | 'right' | 'bottom' | 'left';
export type Cell = readonly [x: number, y: number];
export type Box = { x: number; y: number; w: number; h: number };

export type Defect = {
  edge: Edge;
  /** The bright crack, one cell per pixel. */
  core: Cell[];
  /** Band cells next to the crack that glow dimmer. */
  glow: Cell[];
  /** A dithered bloom just outside the band, away from the card, so the crack reads at a glance. */
  bloom: Cell[];
  /** The stretch of band the crack runs along (the static outline with reduced motion). */
  band: Box;
  /** The clickable indication. */
  hit: Box;
};

/** Small seeded PRNG (mulberry32) so a card's defects keep their shape across renders. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Maps edge-local (u along the edge, v across the band, 0 = outermost) to border-box coords. */
function place(edge: Edge, u: number, v: number, w: number, h: number): Cell {
  switch (edge) {
    case 'top':
      return [u, -BAND + v];
    case 'bottom':
      return [u, h + BAND - 1 - v];
    case 'left':
      return [-BAND + v, u];
    case 'right':
      return [w + BAND - 1 - v, u];
  }
}

/** A box along an edge: `thick` px across, centred on the band, from u0 for `len` px. */
function edgeBox(edge: Edge, u0: number, len: number, thick: number, w: number, h: number): Box {
  const offset = (BAND - thick) / 2;
  switch (edge) {
    case 'top':
      return { x: u0, y: -BAND + offset, w: len, h: thick };
    case 'bottom':
      return { x: u0, y: h + offset, w: len, h: thick };
    case 'left':
      return { x: -BAND + offset, y: u0, w: thick, h: len };
    case 'right':
      return { x: w + offset, y: u0, w: thick, h: len };
  }
}

/**
 * Up to `count` (≤ 3) defects for a `w` × `h` card, each on a different edge. The same seed
 * and size always give the same defects.
 */
export function defects(seed: number, w: number, h: number, count: number): Defect[] {
  if (w < MIN_LENGTH * 2 || h < MIN_LENGTH * 2) return [];
  const random = rng(seed);
  const edges: Edge[] = ['top', 'right', 'bottom', 'left'];
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [edges[i], edges[j]] = [edges[j]!, edges[i]!];
  }

  return edges.slice(0, Math.min(count, MAX_DEFECTS)).map((edge) => {
    const length = edge === 'top' || edge === 'bottom' ? w : h;
    const len = Math.round(
      Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, length * (0.25 + random() * 0.2))),
    );
    const u0 = Math.round(length * 0.1 + random() * (length * 0.9 - len - length * 0.1));

    // The crack is two rows thick and wanders across the band one row at a time.
    let row = Math.floor(random() * (BAND - 1));
    const core: Cell[] = [];
    const glow: Cell[] = [];
    const bloom: Cell[] = [];
    for (let u = u0; u < u0 + len; u++) {
      if (random() < 0.35) row = Math.min(BAND - 2, Math.max(0, row + (random() < 0.5 ? -1 : 1)));
      core.push(place(edge, u, row, w, h), place(edge, u, row + 1, w, h));
      for (let v = 0; v < BAND; v++) {
        if (v !== row && v !== row + 1) glow.push(place(edge, u, v, w, h));
      }
      // Outward bloom (v < 0 is outside the band): solid, then a checkerboard, then sparse.
      bloom.push(place(edge, u, -1, w, h));
      if (u % 2 === 0) bloom.push(place(edge, u, -2, w, h));
      if (u % 4 === 1) bloom.push(place(edge, u, -3, w, h));
    }
    const coreKeys = new Set(core.map(([x, y]) => `${x},${y}`));
    return {
      edge,
      core,
      glow: glow.filter(([x, y]) => !coreKeys.has(`${x},${y}`)),
      bloom,
      band: edgeBox(edge, u0, len, BAND, w, h),
      hit: edgeBox(edge, u0, len, HIT, w, h),
    };
  });
}

/** One magnetic particle drifting onto the crack. */
export type Particle = {
  from: Cell;
  to: Cell;
  delay: number;
  duration: number;
};

/**
 * Particles start outside the card (beyond the band, away from the text) and drift onto
 * random crack cells.
 */
export function particlesFor(defect: Defect, seed: number, count = 10): Particle[] {
  const random = rng(seed);
  const out: [number, number] = {
    top: [0, -1],
    bottom: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  }[defect.edge] as [number, number];
  return Array.from({ length: count }, () => {
    const to = defect.core[Math.floor(random() * defect.core.length)]!;
    const away = 8 + random() * 20;
    const along = (random() - 0.5) * 24;
    const from: Cell = [
      Math.round(to[0] + out[0] * away + (out[0] === 0 ? along : 0)),
      Math.round(to[1] + out[1] * away + (out[1] === 0 ? along : 0)),
    ];
    return { from, to, delay: random() * 0.3, duration: 0.6 + random() * 0.5 };
  });
}

/** Seconds until every particle has landed. */
export function settleTime(particles: Particle[]): number {
  return particles.reduce((t, p) => Math.max(t, p.delay + p.duration), 0);
}

/** Where a particle is `t` seconds after the reveal, eased out so it settles onto the crack. */
export function particleAt(p: Particle, t: number): Cell {
  const k = Math.min(1, Math.max(0, (t - p.delay) / p.duration));
  const e = 1 - Math.pow(1 - k, 3);
  return [
    Math.round(p.from[0] + (p.to[0] - p.from[0]) * e),
    Math.round(p.from[1] + (p.to[1] - p.from[1]) * e),
  ];
}

/** An SVG path of 1 × 1 squares, so cells render crisp at any zoom. */
export function cellsPath(cells: readonly Cell[]): string {
  return cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');
}
