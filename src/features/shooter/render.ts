/**
 * Draws a shooter frame on a buffer whose pixels are SCALE CSS pixels wide. Shared by the
 * full-page overlay and the field scanner's handheld screen.
 */
import { type Palette, withAlpha } from '@/lib/palette';
import { FRAME_SIZE, frameForAngle } from '@/lib/ship-sprite';
import { phaseOf, PHASE_NAMES } from './boss';
import { type GameState, SHIP_HP } from './engine';

/** Shooter pixels are 2 CSS pixels wide. */
export const SCALE = 2;

export function fontFamily(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim() ||
    'monospace'
  );
}

export function draw(
  ctx: CanvasRenderingContext2D,
  g: GameState,
  p: Palette,
  font: string,
  ship: HTMLCanvasElement,
  architect: HTMLCanvasElement | null,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const px = (v: number) => Math.floor(v / SCALE);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = withAlpha(p.void, 0.45);
  ctx.fillRect(0, 0, W, H);
  ctx.font = `8px ${font}`;
  ctx.textBaseline = 'middle';

  for (const a of g.asteroids) {
    const w = px(a.w);
    const h = px(a.h);
    const x = px(a.x) - Math.floor(w / 2);
    const y = px(a.y) - Math.floor(h / 2);
    ctx.fillStyle = p.void;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = a.pebble ? p.gold : p.cyan;
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillRect(x + w - 2, y, 2, h);
    const maxChars = Math.max(1, Math.floor((w - 6) / 8));
    const label = a.label.length > maxChars ? `${a.label.slice(0, maxChars - 1)}…` : a.label;
    ctx.fillStyle = a.pebble ? p.ink : p.gold;
    ctx.fillText(label, x + 4, y + Math.floor(h / 2));
    if (!a.pebble) {
      ctx.fillStyle = p.green;
      ctx.fillRect(x + 4, y + h - 6, Math.round((w - 8) * (a.hp / a.maxHp)), 2);
    }
  }

  if (g.boss) {
    const b = g.boss;
    const size = px(b.size);
    const x = px(b.x) - size / 2;
    const y = px(b.y) - size / 2;
    const phase = phaseOf(b);
    if (phase === 2) {
      // Flux lines: alternating north/south rings.
      ctx.strokeStyle = withAlpha(p.green, 0.5);
      for (let r = 1; r <= 3; r++) {
        const pad = r * 8 + Math.floor((g.time * 20) % 8) * (b.polarity > 0 ? -1 : 1);
        ctx.strokeRect(x - pad + 0.5, y - pad + 0.5, size + pad * 2, size + pad * 2);
      }
    }
    if (architect) ctx.drawImage(architect, x, y, size, size);
    else {
      ctx.fillStyle = p.red;
      ctx.fillRect(x, y, size, size);
    }
    const frame =
      phase === 3
        ? Math.floor(g.time * 8) % 2
          ? p.gold
          : p.violet
        : phase === 2
          ? p.green
          : p.red;
    ctx.fillStyle = frame;
    ctx.fillRect(x - 2, y - 2, size + 4, 2);
    ctx.fillRect(x - 2, y + size, size + 4, 2);
    ctx.fillRect(x - 2, y, 2, size);
    ctx.fillRect(x + size, y, 2, size);
    if (b.flash > 0) {
      ctx.fillStyle = withAlpha(p.ink, 0.5);
      ctx.fillRect(x, y, size, size);
    }
    // Boss HP bar and name.
    const barW = Math.min(W - 16, 200);
    const bx = Math.floor((W - barW) / 2);
    ctx.fillStyle = p.void;
    ctx.fillRect(bx, 6, barW, 6);
    ctx.fillStyle = p.green;
    ctx.fillRect(bx, 6, Math.round(barW * (b.hp / b.maxHp)), 6);
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    // The handheld screen is too narrow for the full title: show the phase alone.
    const title = `THE ARCHITECT · ${PHASE_NAMES[phase]}`;
    const fits = ctx.measureText(title).width <= W - 8;
    ctx.fillText(fits ? title : PHASE_NAMES[phase], Math.floor(W / 2), 20);
    ctx.textAlign = 'left';
  }

  for (const b of g.bullets) {
    if (!b.hostile) {
      ctx.fillStyle = p.red;
      ctx.fillRect(px(b.x) - 1, px(b.y) - 1, 2, 2);
    } else if (b.label) {
      ctx.fillStyle = p.violetInk;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, px(b.x), px(b.y));
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = p.gold;
      ctx.fillRect(px(b.x) - 1, px(b.y) - 1, 3, 3);
    }
  }

  ctx.fillStyle = p.gold;
  for (const s of g.sparks) ctx.fillRect(px(s.x), px(s.y), 1, 1);

  const s = g.ship;
  if (g.status !== 'defeat' && (s.invulnerable <= 0 || Math.floor(g.time * 12) % 2 === 0)) {
    const f = frameForAngle(s.angle);
    ctx.drawImage(
      ship,
      f * FRAME_SIZE,
      0,
      FRAME_SIZE,
      FRAME_SIZE,
      px(s.x) - FRAME_SIZE / 2,
      px(s.y) - FRAME_SIZE / 2,
      FRAME_SIZE,
      FRAME_SIZE,
    );
  }

  // HUD
  ctx.fillStyle = p.ink;
  ctx.fillText(`SCORE ${g.score}`, 8, H - 12);
  ctx.fillText('HULL', 8, H - 24);
  for (let i = 0; i < SHIP_HP; i++) {
    ctx.fillStyle = i < s.hp ? p.green : withAlpha(p.inkMuted, 0.4);
    ctx.fillRect(44 + i * 8, H - 27, 6, 6);
  }

  if (g.status !== 'playing') {
    const boxW = Math.min(W - 16, 240);
    const boxH = 64;
    const x = Math.floor((W - boxW) / 2);
    const y = Math.floor((H - boxH) / 2);
    ctx.fillStyle = p.void;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = g.status === 'victory' ? p.gold : p.red;
    ctx.fillRect(x, y, boxW, 2);
    ctx.fillRect(x, y + boxH - 2, boxW, 2);
    ctx.textAlign = 'center';
    ctx.fillText(g.status === 'victory' ? 'VICTORY' : 'HULL BREACH', Math.floor(W / 2), y + 20);
    ctx.fillStyle = p.ink;
    ctx.fillText(`SCORE ${g.score}`, Math.floor(W / 2), y + 42);
    ctx.textAlign = 'left';
  }
}
