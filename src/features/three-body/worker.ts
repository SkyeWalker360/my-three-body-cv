import type { Palette } from '@/lib/palette';
import { Lab, type LabMessage, type LabOutput } from './lab';

export type WorkerInit = {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  palette: Palette;
  reduced: boolean;
};

// Typed by hand: the DOM and WebWorker libs can't both be loaded in one TypeScript program.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerInit | LabMessage>) => void) | null;
  postMessage: (msg: LabOutput) => void;
};
let lab: Lab | null = null;

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    msg.canvas.width = msg.width;
    msg.canvas.height = msg.height;
    const ctx = msg.canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    lab = new Lab(ctx, msg.palette, msg.reduced, (out) => scope.postMessage(out));
    return;
  }
  lab?.handle(msg);
};
