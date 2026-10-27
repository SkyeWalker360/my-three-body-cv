/**
 * Canvas code can't use Tailwind classes, so it reads the theme tokens from CSS variables.
 * Every colour drawn on a canvas comes from here, never from an inline hex value.
 */
export type Palette = {
  void: string;
  ink: string;
  inkMuted: string;
  cyan: string;
  gold: string;
  red: string;
  green: string;
  violet: string;
  violetInk: string;
};

const TOKENS: Record<keyof Palette, string> = {
  void: '--color-void',
  ink: '--color-ink',
  inkMuted: '--color-ink-muted',
  cyan: '--color-cyan',
  gold: '--color-gold',
  red: '--color-red',
  green: '--color-green',
  violet: '--color-violet',
  violetInk: '--color-violet-ink',
};

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const out = {} as Palette;
  for (const [key, token] of Object.entries(TOKENS) as [keyof Palette, string][]) {
    out[key] = style.getPropertyValue(token).trim();
  }
  return out;
}

/** Parse "#RRGGBB" into [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
