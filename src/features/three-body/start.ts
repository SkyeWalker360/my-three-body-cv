/**
 * Starts the lab on a canvas context: the Go/WASM engine when it loads, otherwise the
 * TypeScript solver. Messages sent before either is ready are queued and replayed.
 */
import type { Palette } from '@/lib/palette';
import { EngineLab, loadEngine } from './engine';
import { Lab, type Ctx, type LabLike, type LabMessage, type LabOutput } from './lab';

export type LabInit = {
  palette: Palette;
  /** Hex colour for each engine palette index (ENGINE_PALETTE order). */
  colors: string[];
  reduced: boolean;
  /** Absolute URL of engine.wasm, or null to use the TypeScript solver. */
  wasmUrl: string | null;
  seed: number;
};

export function startLab(
  ctx: Ctx,
  init: LabInit,
  post: (msg: LabOutput) => void,
): (msg: LabMessage) => void {
  let lab: LabLike | null = null;
  const queue: LabMessage[] = [];
  const ready = (l: LabLike) => {
    lab = l;
    for (const msg of queue.splice(0)) l.handle(msg);
  };
  const fallback = () => ready(new Lab(ctx, init.palette, init.reduced, post));
  if (init.wasmUrl) {
    loadEngine(init.wasmUrl)
      .then((e) => ready(new EngineLab(e, ctx, init.colors, init.reduced, post, init.seed)))
      .catch(fallback);
  } else {
    fallback();
  }
  return (msg) => (lab ? lab.handle(msg) : queue.push(msg));
}
