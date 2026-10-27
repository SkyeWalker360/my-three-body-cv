import type { LabMessage, LabOutput } from './lab';
import { startLab, type LabInit } from './start';

export type WorkerInit = LabInit & {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
};

// Typed by hand: the DOM and WebWorker libs can't both be loaded in one TypeScript program.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerInit | LabMessage>) => void) | null;
  postMessage: (msg: LabOutput) => void;
};
let send: ((msg: LabMessage) => void) | null = null;

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    msg.canvas.width = msg.width;
    msg.canvas.height = msg.height;
    const ctx = msg.canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    send = startLab(ctx, msg, (out) => scope.postMessage(out));
    return;
  }
  send?.(msg);
};
