/**
 * The ship sprite. Placeholder art drawn as a 1× bitmap until the Aseprite export lands in
 * public/sprites/; the 16 headings are pre-rendered once at startup so nothing is rotated
 * at draw time.
 */
import type { Palette } from '@/lib/palette';

export const FRAMES = 16;
export const FRAME_SIZE = 16;

// Points up (−y). c = hull, g = cockpit, r = thruster.
const SHIP = [
  '.....c.....',
  '....ccc....',
  '....cgc....',
  '...ccgcc...',
  '...ccccc...',
  '..ccccccc..',
  '..cc.c.cc..',
  '.cc..c..cc.',
  '.c..r.r..c.',
  'cc.......cc',
];

/** Which of the 16 frames to use for a heading in radians (0 = east, clockwise on screen). */
export function frameForAngle(angle: number): number {
  const step = (2 * Math.PI) / FRAMES;
  return ((Math.round(angle / step) % FRAMES) + FRAMES) % FRAMES;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Build a horizontal strip of 16 frames, each FRAME_SIZE square. */
export function buildShipSheet(palette: Palette): HTMLCanvasElement {
  const sheet = document.createElement('canvas');
  sheet.width = FRAME_SIZE * FRAMES;
  sheet.height = FRAME_SIZE;
  const ctx = sheet.getContext('2d') as Ctx;
  const colors: Record<string, string> = { c: palette.cyan, g: palette.gold, r: palette.red };
  const h = SHIP.length;
  const w = SHIP[0]!.length;
  const half = FRAME_SIZE / 2;

  for (let f = 0; f < FRAMES; f++) {
    // Sprite points north (−π/2); rotate so it points along this frame's heading.
    const rot = (f * 2 * Math.PI) / FRAMES + Math.PI / 2;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    for (let py = 0; py < FRAME_SIZE; py++) {
      for (let px = 0; px < FRAME_SIZE; px++) {
        // Inverse-map each destination pixel back into the source bitmap (nearest neighbour).
        const dx = px + 0.5 - half;
        const dy = py + 0.5 - half;
        const sx = Math.floor(dx * cos - dy * sin + w / 2);
        const sy = Math.floor(dx * sin + dy * cos + h / 2);
        const ch = SHIP[sy]?.[sx];
        const color = ch ? colors[ch] : undefined;
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(f * FRAME_SIZE + px, py, 1, 1);
      }
    }
  }
  return sheet;
}
