'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { emit, on } from '@/lib/events';
import { animationLoop } from '@/lib/motion';
import { readPalette } from '@/lib/palette';
import { buildShipSheet } from '@/lib/ship-sprite';
import { buildArchitect } from './architect';
import { createGame, type GameState, type Input, update } from './engine';
import { harvest } from './harvest';
import { draw, fontFamily, SCALE } from './render';
import { gameFor, manifestSeeds } from './seeds';

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

/** Fewer than this many blocks on screen (a phone shows one card) and the field is topped up. */
const MIN_ASTEROIDS = 4;

/**
 * Layer 3 shooter. ENGAGE scrolls the CV into view, hides the visible blocks and turns them
 * into asteroids. Escape (or the Quit button) ends the run and restores the page. On touch
 * screens the game runs on the field scanner's handheld instead (see ./handheld).
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
        if (seeds.length < MIN_ASTEROIDS) {
          // Top up with the manifest entries that aren't already on screen.
          const have = new Set(seeds.map((s) => s.id));
          seeds = [...seeds, ...manifestSeeds(width, height).filter((s) => !have.has(s.id))];
        }
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
