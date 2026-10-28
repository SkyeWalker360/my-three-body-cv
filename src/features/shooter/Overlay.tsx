'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { findEntry } from '@/lib/entries';
import { emit, on } from '@/lib/events';
import { manifestData } from '@/lib/manifest-data';
import { animationLoop } from '@/lib/motion';
import { type Palette, readPalette, withAlpha } from '@/lib/palette';
import type { Game as GameBlock } from '@/lib/schema';
import { buildShipSheet, FRAME_SIZE, frameForAngle } from '@/lib/ship-sprite';
import { buildArchitect } from './architect';
import { phaseOf, PHASE_NAMES } from './boss';
import { createGame, type GameState, type Input, SHIP_HP, update } from './engine';
import { harvest, type Seed } from './harvest';

/** Overlay pixels are 2 CSS pixels wide. */
const SCALE = 2;
const KEYS: Record<string, keyof Input> = {
  KeyW: 'thrust',
  ArrowUp: 'thrust',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'fire',
};

function gameFor(id: string): GameBlock | undefined {
  if (id === 'skills') {
    return { hp: 4, fragments: manifestData.skills.slice(0, 4).map((s) => s.category) };
  }
  return findEntry(manifestData, id)?.entry.game;
}

/** Used only if no CV block is on screen: seed asteroids straight from the manifest. */
function manifestSeeds(width: number, height: number): Seed[] {
  const ids = [
    ...manifestData.experience,
    ...manifestData.certifications,
    ...manifestData.projects,
    ...manifestData.education,
  ]
    .filter((e) => e.game)
    .map((e) => e.id);
  return ids.map((id, i) => {
    const found = findEntry(manifestData, id)!;
    const label =
      'org' in found.entry
        ? found.entry.org
        : 'name' in found.entry
          ? found.entry.name
          : found.entry.institution;
    return {
      id,
      label,
      rect: { x: ((i + 0.5) / ids.length) * width - 100, y: height * 0.25, w: 200, h: 120 },
    };
  });
}

function fontFamily(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim() ||
    'monospace'
  );
}

/**
 * Layer 3 shooter. ENGAGE scrolls the CV into view, hides the visible blocks and turns them
 * into asteroids. Escape (or the Quit button) ends the run and restores the page.
 */
export default function ShooterOverlay({ autoStart }: { autoStart: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const game = useRef<GameState | null>(null);
  const hidden = useRef<HTMLElement[]>([]);
  const input = useRef<Input>({
    thrust: false,
    brake: false,
    left: false,
    right: false,
    fire: false,
  });
  const loop = useRef<ReturnType<typeof animationLoop> | null>(null);
  const [phase, setPhaseState] = useState<'off' | 'playing' | 'ended'>('off');
  // The key handler reads this ref, so a key pressed before React re-renders still counts
  // (Escape straight after launch used to be lost, leaving the CV hidden).
  const phaseRef = useRef<'off' | 'playing' | 'ended'>('off');
  const setPhase = useCallback((p: 'off' | 'playing' | 'ended') => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState<'victory' | 'defeat'>('defeat');

  const restoreDom = useCallback(() => {
    for (const el of hidden.current) {
      el.style.visibility = '';
      el.classList.add('restore-fade');
      el.addEventListener('animationend', () => el.classList.remove('restore-fade'), {
        once: true,
      });
    }
    hidden.current = [];
    document.documentElement.classList.remove('shooter-active');
  }, []);

  const stop = useCallback(
    (outcome: 'victory' | 'defeat' | 'quit') => {
      loop.current?.stop();
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      const score = game.current?.score ?? 0;
      game.current = null;
      restoreDom();
      setPhase('off');
      emit('shooter:end', { score, outcome });
      document.getElementById('shooter-launch')?.focus();
    },
    [restoreDom, setPhase],
  );

  const start = useCallback(() => {
    if (game.current) return;
    document
      .querySelector('[data-destructible]')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    // Wait two frames so layout settles after the scroll before reading rects.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        let seeds = harvest();
        if (seeds.length === 0) seeds = manifestSeeds(width, height);
        for (const s of seeds) {
          if (s.el) {
            s.el.style.visibility = 'hidden';
            hidden.current.push(s.el);
          }
        }
        document.documentElement.classList.add('shooter-active');
        input.current = { thrust: false, brake: false, left: false, right: false, fire: false };
        game.current = createGame(seeds, gameFor, width, height, Math.random);
        setPhase('playing');
        setStatus(`Shooter started: ${seeds.length} CV blocks became asteroids.`);
        emit('shooter:start');
        loop.current?.start();
      }),
    );
  }, [setPhase]);

  // Rendering and the game loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const palette = readPalette();
    const font = fontFamily();
    const ship = buildShipSheet(palette);
    let architect: HTMLCanvasElement | null = null;
    void buildArchitect(asset('/sprites/architect-32.png'), palette).then((c) => (architect = c));

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / SCALE);
      canvas.height = Math.ceil(window.innerHeight / SCALE);
      canvas.style.width = `${canvas.width * SCALE}px`;
      canvas.style.height = `${canvas.height * SCALE}px`;
      ctx.imageSmoothingEnabled = false;
      if (game.current) {
        game.current.width = window.innerWidth;
        game.current.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let announced = '';
    loop.current = animationLoop((dt) => {
      const g = game.current;
      if (!g) return;
      update(g, input.current, dt, Math.random);
      draw(ctx, g, palette, font, ship, architect);
      if (g.status !== 'playing' && announced !== g.status) {
        announced = g.status;
        setOutcome(g.status);
        setPhase('ended');
        setStatus(
          g.status === 'victory'
            ? `Victory! The Architect is down. Score ${g.score}.`
            : `Hull breach. Score ${g.score}.`,
        );
      }
      if (g.status === 'playing') announced = '';
    });

    return () => {
      loop.current?.dispose();
      window.removeEventListener('resize', resize);
    };
  }, [setPhase]);

  useEffect(() => {
    if (phase === 'ended') restoreRef.current?.focus();
  }, [phase]);

  // Keyboard controls while a run is active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const phase = phaseRef.current;
      if (phase === 'off') return;
      if (e.code === 'Escape') {
        e.preventDefault();
        stop('quit');
        return;
      }
      const key = KEYS[e.code];
      if (!key) return;
      // Let Space and arrows reach a focused button on the end screen.
      if (phase === 'ended') return;
      e.preventDefault();
      input.current[key] = e.type === 'keydown';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [stop]);

  // First start comes from the host that lazy-loaded us; later ones from the event bus.
  const booted = useRef(false);
  useEffect(() => {
    if (autoStart && !booted.current) {
      booted.current = true;
      start();
    }
    return on('shooter:launch', () => {
      if (!game.current) start();
    });
  }, [autoStart, start]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pixelated pointer-events-none fixed top-0 left-0 z-40"
      />
      <p role="status" className="sr-only">
        {status}
      </p>
      {phase === 'playing' && (
        <button
          type="button"
          onClick={() => stop('quit')}
          className="btn btn-red fixed top-4 right-4 z-40"
        >
          QUIT (ESC)
        </button>
      )}
      {phase === 'ended' && (
        <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center gap-4 px-4">
          <button
            ref={restoreRef}
            type="button"
            onClick={() => stop(outcome)}
            className="btn btn-cyan"
          >
            RESTORE WEBSITE
          </button>
          <button
            type="button"
            onClick={() => {
              stop(outcome);
              requestAnimationFrame(() => start());
            }}
            className="btn btn-red"
          >
            PLAY AGAIN
          </button>
        </div>
      )}
    </>
  );
}

function draw(
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
    ctx.fillText(`THE ARCHITECT · ${PHASE_NAMES[phase]}`, Math.floor(W / 2), 20);
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
