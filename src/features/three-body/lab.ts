/**
 * The three-body laboratory: simulation state, fixed-timestep clock, trails, shadow copy
 * and pixel renderer. Runs unchanged in the worker or, as a fallback, on the main thread.
 */
import type { Palette } from '@/lib/palette';
import type { PresetSummary, Telemetry } from '@/lib/events';
import { PRESETS } from './presets';
import {
  type BodyState,
  cloneState,
  computeAccelerations,
  createState,
  divergence,
  energies,
  kick,
  maxRadius,
  step,
} from './solver';

/** Simulation time units per real second. A Figure-8 period (~6.3) takes about 8 s. */
export const SIM_SPEED = 0.75;
export const MAX_STEPS_PER_FRAME = 50;
export const KICK_DV = 0.075;
export const SHADOW_DELTA = 1e-7;
/** World units shown from the centre to the nearest canvas edge (scale is 1/4 of the short side). */
export const VISIBLE_RADIUS = 2;
/**
 * A body past this radius is about to leave the screen; the preset is reloaded. Chaotic runs
 * (and the equal-mass Lagrange triangle, which is unstable) eventually break up this way.
 */
export const ESCAPE_RADIUS = 1.9;
const TRAIL_LENGTH = 80;
const TELEMETRY_EVERY = 6;

export type LabMessage =
  | { type: 'resize'; width: number; height: number }
  | { type: 'preset'; index?: number }
  | { type: 'kick' }
  | { type: 'shadow'; on: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reduced'; reduced: boolean };

export type LabOutput =
  { type: 'ready'; presets: PresetSummary[] } | { type: 'telemetry'; telemetry: Telemetry };

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelRaf: (id: number) => void =
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;

export const presetSummaries = (): PresetSummary[] =>
  PRESETS.map((p, index) => ({ index, name: p.name, short: p.short }));

export class Lab {
  private state!: BodyState;
  private shadow: BodyState | null = null;
  private presetIndex = 0;
  private e0 = 0;
  private trails: Float64Array[] = [];
  private trailHead = 0;
  private trailCount = 0;
  private accumulator = 0;
  /** Simulated time since the last preset load; read by tests. */
  simTime = 0;
  private frame = 0;
  private rafId = 0;
  private last = 0;
  private paused = false;
  private reduced: boolean;

  /** `ctx` belongs to either a DOM canvas or a worker's OffscreenCanvas. */
  constructor(
    private ctx: Ctx,
    private palette: Palette,
    reduced: boolean,
    private post: (msg: LabOutput) => void,
  ) {
    ctx.imageSmoothingEnabled = false;
    this.reduced = reduced;
    this.load(0);
    this.post({ type: 'ready', presets: presetSummaries() });
    this.restart();
  }

  handle(msg: LabMessage): void {
    switch (msg.type) {
      case 'resize':
        this.ctx.canvas.width = msg.width;
        this.ctx.canvas.height = msg.height;
        this.ctx.imageSmoothingEnabled = false;
        if (this.reduced) this.renderStatic();
        break;
      case 'preset':
        this.load(msg.index ?? (this.presetIndex + 1) % PRESETS.length);
        if (this.reduced) this.renderStatic();
        break;
      case 'kick':
        kick(this.state, KICK_DV);
        this.e0 = energies(this.state).total;
        if (this.shadow) this.spawnShadow();
        if (this.reduced) this.renderStatic();
        break;
      case 'shadow':
        if (msg.on) this.spawnShadow();
        else this.shadow = null;
        if (this.reduced) this.renderStatic();
        break;
      case 'pause':
        this.paused = true;
        this.stopLoop();
        break;
      case 'resume':
        this.paused = false;
        this.restart();
        break;
      case 'reduced':
        this.reduced = msg.reduced;
        this.restart();
        break;
    }
  }

  private load(index: number, perturb = 0): void {
    const preset = PRESETS[index] ?? PRESETS[0]!;
    this.presetIndex = PRESETS.indexOf(preset);
    this.state = createState(preset);
    if (perturb) kick(this.state, perturb);
    this.e0 = energies(this.state).total;
    this.trails = Array.from({ length: this.state.n }, () => new Float64Array(TRAIL_LENGTH * 2));
    this.trailHead = 0;
    this.trailCount = 0;
    this.accumulator = 0;
    this.simTime = 0;
    if (this.shadow) this.spawnShadow();
  }

  /** Largest body distance from the barycentre; read by tests. */
  radius(): number {
    return maxRadius(this.state);
  }

  private spawnShadow(): void {
    this.shadow = cloneState(this.state);
    this.shadow.x[0] = this.shadow.x[0]! + SHADOW_DELTA;
    computeAccelerations(this.shadow);
  }

  private restart(): void {
    this.stopLoop();
    if (this.reduced) {
      this.renderStatic();
      return;
    }
    if (this.paused) return;
    this.last = 0;
    this.rafId = raf(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId) cancelRaf(this.rafId);
    this.rafId = 0;
  }

  private tick = (now: number): void => {
    const elapsed = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.advance(elapsed);
    this.draw();
    if (++this.frame % TELEMETRY_EVERY === 0) this.sendTelemetry();
    this.rafId = raf(this.tick);
  };

  /** Fixed-timestep accumulator on real elapsed time, so speed is independent of refresh rate. */
  advance(elapsedSeconds: number): void {
    this.accumulator += elapsedSeconds * SIM_SPEED;
    const dt = this.state.dt;
    // Fine-step presets need more steps per frame; the cap still bounds a long stall.
    const cap = Math.max(MAX_STEPS_PER_FRAME, Math.ceil((SIM_SPEED * 0.1) / dt));
    let steps = 0;
    while (this.accumulator >= dt && steps < cap) {
      step(this.state);
      if (this.shadow) step(this.shadow);
      this.accumulator -= dt;
      this.simTime += dt;
      steps++;
    }
    // Drop time we could not simulate rather than spiralling.
    if (steps === cap) this.accumulator = 0;
    this.guardEscape();
    this.recordTrail();
  }

  private guardEscape(): void {
    if (maxRadius(this.state) < ESCAPE_RADIUS) return;
    const preset = PRESETS[this.presetIndex]!;
    // Chaotic systems get a fresh, slightly different run; others reset to their clean state.
    this.load(this.presetIndex, preset.chaotic ? 0.02 : 0);
  }

  private recordTrail(): void {
    for (let i = 0; i < this.state.n; i++) {
      const t = this.trails[i]!;
      t[this.trailHead * 2] = this.state.x[2 * i]!;
      t[this.trailHead * 2 + 1] = this.state.x[2 * i + 1]!;
    }
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
    this.trailCount = Math.min(TRAIL_LENGTH, this.trailCount + 1);
  }

  private renderStatic(): void {
    // Reduced motion: integrate a short stretch so the trails show the orbit, then draw once.
    for (let f = 0; f < TRAIL_LENGTH; f++) this.advance(1 / 30);
    this.draw();
    this.sendTelemetry();
  }

  private sendTelemetry(): void {
    const e = energies(this.state);
    const preset = PRESETS[this.presetIndex]!;
    this.post({
      type: 'telemetry',
      telemetry: {
        kinetic: e.kinetic,
        potential: e.potential,
        total: e.total,
        drift: Math.abs((e.total - this.e0) / this.e0),
        divergence: this.shadow ? divergence(this.state, this.shadow) : null,
        preset: { index: this.presetIndex, name: preset.name, short: preset.short },
      },
    });
  }

  private draw(): void {
    const { ctx, palette } = this;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const scale = Math.min(w, h) / (2 * VISIBLE_RADIUS);
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const colors = [palette.cyan, palette.gold, palette.red];

    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.void;
    ctx.fillRect(0, 0, w, h);

    // Trails: one pixel per step along each segment, fading per segment from tail to head.
    for (let i = 0; i < this.state.n; i++) {
      const t = this.trails[i]!;
      ctx.fillStyle = colors[i % 3]!;
      let px = NaN;
      let py = NaN;
      for (let k = 0; k < this.trailCount; k++) {
        const idx = (this.trailHead - this.trailCount + k + TRAIL_LENGTH) % TRAIL_LENGTH;
        const x = Math.floor(cx + t[idx * 2]! * scale);
        const y = Math.floor(cy + t[idx * 2 + 1]! * scale);
        if (k > 0) {
          ctx.globalAlpha = (k / this.trailCount) * 0.5;
          plotLine(ctx, px, py, x, y);
        }
        px = x;
        py = y;
      }
    }
    ctx.globalAlpha = 1;

    if (this.shadow) {
      ctx.strokeStyle = palette.violetInk;
      ctx.lineWidth = 1;
      for (let i = 0; i < this.shadow.n; i++) {
        const x = Math.floor(cx + this.shadow.x[2 * i]! * scale);
        const y = Math.floor(cy + this.shadow.x[2 * i + 1]! * scale);
        ctx.strokeRect(x - 5.5, y - 5.5, 11, 11);
      }
    }

    // Bodies: 8×8 pixel squares with a 4×4 core.
    for (let i = 0; i < this.state.n; i++) {
      const x = Math.floor(cx + this.state.x[2 * i]! * scale);
      const y = Math.floor(cy + this.state.x[2 * i + 1]! * scale);
      ctx.fillStyle = colors[i % 3]!;
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = palette.ink;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

/** Integer line rasterisation (Bresenham), so trails stay on the pixel grid. */
function plotLine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2048; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
