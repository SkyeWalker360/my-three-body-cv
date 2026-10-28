/**
 * The shooter on the field scanner's screen, for phones (and the scanner's hidden cheat code).
 * Same engine and renderer as the overlay, but the CV sits behind the modal dialog, so the
 * field is seeded from the manifest. The scanner lazily imports this and feeds `input` from its
 * D-pad and A button, the way K.A.R.L. runs Noctus Umbra inside its log.
 */
import { asset } from '@/lib/asset';
import { emit } from '@/lib/events';
import { animationLoop } from '@/lib/motion';
import { readPalette } from '@/lib/palette';
import { buildShipSheet } from '@/lib/ship-sprite';
import { buildArchitect } from './architect';
import { createGame, type GameState, type Input, update } from './engine';
import { draw, fontFamily, SCALE } from './render';
import { gameFor, manifestSeeds } from './seeds';

export type HandheldOutcome = 'victory' | 'defeat';

export type Handheld = {
  /** Held buttons; the scanner sets these flags directly. */
  input: Input;
  /** A fresh field after a win or a hull breach. */
  restart: () => void;
  /** Ends the run (emitting shooter:end as a quit if it was still going) and stops drawing. */
  dispose: () => void;
};

const idle = (): Input => ({ thrust: false, brake: false, left: false, right: false, fire: false });

/** Runs the game on `canvas`, sized to fill `screen` at whole-number scale. */
export function mountHandheld(
  canvas: HTMLCanvasElement,
  screen: HTMLElement,
  events: {
    onStart: (asteroids: number) => void;
    onEnd: (outcome: HandheldOutcome, score: number) => void;
  },
): Handheld {
  const ctx = canvas.getContext('2d')!;
  const palette = readPalette();
  const font = fontFamily();
  const ship = buildShipSheet(palette);
  let architect: HTMLCanvasElement | null = null;
  void buildArchitect(asset('/sprites/architect-32.png'), palette).then((c) => (architect = c));

  const handle: Handheld = { input: idle(), restart, dispose };
  let game: GameState | null = null;
  let ended = false;

  const resize = () => {
    canvas.width = Math.max(1, Math.floor(screen.clientWidth / SCALE));
    canvas.height = Math.max(1, Math.floor(screen.clientHeight / SCALE));
    canvas.style.width = `${canvas.width * SCALE}px`;
    canvas.style.height = `${canvas.height * SCALE}px`;
    ctx.imageSmoothingEnabled = false;
    if (game) {
      game.width = canvas.width * SCALE;
      game.height = canvas.height * SCALE;
    }
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(screen);

  const loop = animationLoop((dt) => {
    if (!game) return;
    update(game, handle.input, dt, Math.random);
    draw(ctx, game, palette, font, ship, architect);
    if (game.status !== 'playing' && !ended) {
      ended = true;
      emit('shooter:end', { score: game.score, outcome: game.status });
      events.onEnd(game.status, game.score);
    }
  });

  function restart() {
    const width = canvas.width * SCALE;
    const height = canvas.height * SCALE;
    const seeds = manifestSeeds(width, height);
    handle.input = idle();
    game = createGame(seeds, gameFor, width, height, Math.random);
    ended = false;
    emit('shooter:start');
    events.onStart(seeds.length);
    loop.start();
  }

  function dispose() {
    if (game && !ended) emit('shooter:end', { score: game.score, outcome: 'quit' });
    game = null;
    loop.dispose();
    observer.disconnect();
  }

  restart();
  return handle;
}
