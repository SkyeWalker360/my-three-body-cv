/** Turning CV blocks into asteroid seeds. `inViewport` is pure; `harvest` reads the DOM. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Seed = {
  id: string;
  label: string;
  rect: Rect;
  el?: HTMLElement;
};

/** A block counts when its centre is on screen and at least 40% of it is visible. */
export function inViewport(r: Rect, vw: number, vh: number): boolean {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (cx < 0 || cx > vw || cy < 0 || cy > vh) return false;
  const visibleW = Math.max(0, Math.min(vw, r.x + r.w) - Math.max(0, r.x));
  const visibleH = Math.max(0, Math.min(vh, r.y + r.h) - Math.max(0, r.y));
  return (visibleW * visibleH) / (r.w * r.h) >= 0.4;
}

export function harvest(): Seed[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const seeds: Seed[] = [];
  document.querySelectorAll<HTMLElement>('[data-destructible]').forEach((el) => {
    // Skip blocks hidden by the CV filters.
    if (el.offsetParent === null) return;
    const b = el.getBoundingClientRect();
    const rect = { x: b.left, y: b.top, w: b.width, h: b.height };
    if (!inViewport(rect, vw, vh)) return;
    seeds.push({
      id: el.dataset.id ?? 'block',
      label: el.dataset.label ?? 'CV BLOCK',
      rect,
      el,
    });
  });
  return seeds;
}
