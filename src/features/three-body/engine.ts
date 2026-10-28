/**
 * Loads the Go pixel engine (public/engine.wasm, built with TinyGo) and drives it with the
 * same messages as the TypeScript Lab. The engine does the physics, star lifecycles and
 * drawing into a framebuffer of palette indices; this file only maps each index to its theme
 * colour and puts the frame on the canvas. Runs in the worker or, as a fallback, the main thread.
 */
import type { EngineTelemetry, LabEventKind } from '@/lib/events';
import { hexToRgb } from '@/lib/palette';
import {
  ERAS,
  EVENT,
  EVENT_SLOTS,
  EVENT_STRIDE,
  PLANET_BODY,
  STAR_KINDS,
  STAR_PHASES,
  STATE,
} from './engine-layout';
import type { Ctx, LabMessage, LabOutput } from './lab';
import { presetSummaries } from './lab';
import { PRESETS } from './presets';

type Exports = {
  memory: WebAssembly.Memory;
  _initialize(): void;
  init(seed: number, preset: number): void;
  resize(width: number, height: number): number;
  advance(ms: number): void;
  render(): void;
  kick(body: number, dvx: number, dvy: number): void;
  age(): number;
  ghost(on: number): void;
  statePtr(): number;
  framePtr(): number;
  eventsPtr(): number;
  bodiesPtr(): number;
  frameWidth(): number;
  frameHeight(): number;
};

const TELEMETRY_EVERY = 6;
const STATIC_FRAMES = 80;

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelRaf: (id: number) => void =
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;

export type EngineExports = Exports;

/** Instantiate the engine from its bytes. It imports nothing. */
export async function instantiateEngine(bytes: BufferSource): Promise<Exports> {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const e = instance.exports as unknown as Exports;
  e._initialize();
  return e;
}

/** Fetch and instantiate the engine. Rejects if WebAssembly or the file is unavailable. */
export async function loadEngine(url: string): Promise<Exports> {
  if (typeof WebAssembly === 'undefined') throw new Error('no WebAssembly');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`engine: HTTP ${response.status}`);
  return instantiateEngine(await response.arrayBuffer());
}

/** Little-endian RGBA words for each palette index, read from the theme token colours. */
export function colourTable(colors: string[]): Uint32Array {
  const lut = new Uint32Array(colors.length);
  colors.forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex);
    lut[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  });
  return lut;
}

const star = (i: number) => `star ${i + 1}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A short sentence for each engine event, for the lab's live log. */
export function describeEvent(
  kind: number,
  a: number,
  b: number,
  kinds: string[],
): { kind: LabEventKind; message: string } | null {
  const described = describe(kind, a, b, kinds);
  return described && { ...described, message: capitalise(described.message) };
}

function describe(
  kind: number,
  a: number,
  b: number,
  kinds: string[],
): { kind: LabEventKind; message: string } | null {
  const name = (i: number) => `${star(i)} (${(kinds[i] ?? 'star').toLowerCase()})`;
  switch (kind) {
    case EVENT.collision:
      return { kind: 'collision', message: `Close pass: ${star(a)} grazed ${star(b)}.` };
    case EVENT.supernova:
      return { kind: 'supernova', message: `Supernova! ${name(a)} exploded.` };
    case EVENT.engulfment:
      return {
        kind: 'engulfment',
        message:
          b === PLANET_BODY
            ? `The planet was swallowed by ${name(a)}.`
            : `${name(a)} engulfed ${star(b)}.`,
      };
    case EVENT.ejection:
      return {
        kind: 'ejection',
        message:
          a === PLANET_BODY
            ? 'The planet was flung out of the system. A new one will form.'
            : `${name(a)} escaped; the system restarts.`,
      };
    case EVENT.giant:
      return { kind: 'giant', message: `${name(a)} left the main sequence and is swelling.` };
    case EVENT.remnant:
      return {
        kind: 'remnant',
        message: `${star(a)} is now a ${(STAR_PHASES[b] ?? 'remnant').toLowerCase()}.`,
      };
    case EVENT.electrical:
      return {
        kind: 'electrical',
        message: "The planet's civilisation reached the electrical era: city lights.",
      };
  }
  return null;
}

export class EngineLab {
  private presetIndex = 0;
  private frame = 0;
  private rafId = 0;
  private last = 0;
  private paused = false;
  private image: ImageData | null = null;
  private lastEvent = 0;
  private lut: Uint32Array;

  constructor(
    private e: Exports,
    private ctx: Ctx,
    colors: string[],
    private reduced: boolean,
    private post: (msg: LabOutput) => void,
    private seed: number,
  ) {
    this.lut = colourTable(colors);
    ctx.imageSmoothingEnabled = false;
    e.init(seed, 0);
    this.fit();
    this.post({ type: 'ready', presets: presetSummaries(), engine: 'wasm' });
    this.restart();
  }

  handle(msg: LabMessage): void {
    const e = this.e;
    switch (msg.type) {
      case 'resize':
        this.ctx.canvas.width = msg.width;
        this.ctx.canvas.height = msg.height;
        this.ctx.imageSmoothingEnabled = false;
        this.fit();
        break;
      case 'preset':
        this.presetIndex = msg.index ?? (this.presetIndex + 1) % PRESETS.length;
        e.init(this.seed, this.presetIndex);
        this.lastEvent = 0;
        break;
      case 'kick':
        e.kick(-1, 0, 0);
        break;
      case 'shadow':
        e.ghost(msg.on ? 1 : 0);
        break;
      case 'age':
        e.age();
        break;
      case 'pause':
        this.paused = true;
        this.stopLoop();
        return;
      case 'resume':
        this.paused = false;
        this.restart();
        return;
      case 'reduced':
        this.reduced = msg.reduced;
        this.restart();
        return;
    }
    if (this.reduced) this.renderStatic();
    else this.sendTelemetry();
  }

  private fit(): void {
    const { width, height } = this.ctx.canvas;
    if (this.e.resize(width, height) === 0) {
      // Too large for the engine's buffer: keep the last good size, scaled by CSS.
      return;
    }
    this.image = null;
    if (this.reduced) this.renderStatic();
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
    const ms = this.last ? now - this.last : 0;
    this.last = now;
    this.e.advance(ms);
    this.draw();
    this.drainEvents();
    if (++this.frame % TELEMETRY_EVERY === 0) this.sendTelemetry();
    this.rafId = raf(this.tick);
  };

  /** Reduced motion: run a short stretch so the trails show the orbit, then draw once. */
  private renderStatic(): void {
    for (let f = 0; f < STATIC_FRAMES; f++) this.e.advance(1000 / 30);
    this.draw();
    this.drainEvents();
    this.sendTelemetry();
  }

  private draw(): void {
    const e = this.e;
    e.render();
    const w = e.frameWidth();
    const h = e.frameHeight();
    if (!this.image || this.image.width !== w || this.image.height !== h) {
      this.image = this.ctx.createImageData(w, h);
    }
    const out = new Uint32Array(this.image.data.buffer);
    const frame = new Uint8Array(e.memory.buffer, e.framePtr(), w * h);
    const lut = this.lut;
    for (let i = 0; i < frame.length; i++) out[i] = lut[frame[i]!]!;
    this.ctx.putImageData(this.image, 0, 0);
  }

  private state(): Float64Array {
    return new Float64Array(this.e.memory.buffer, this.e.statePtr(), STATE.length);
  }

  private starKinds(s: Float64Array): string[] {
    return [0, 1, 2].map((i) => STAR_KINDS[s[STATE.stars + i * STATE.starWidth]!] ?? 'Star');
  }

  private drainEvents(): void {
    const ev = new Int32Array(
      this.e.memory.buffer,
      this.e.eventsPtr(),
      1 + EVENT_SLOTS * EVENT_STRIDE,
    );
    const count = ev[0]!;
    if (count < this.lastEvent) this.lastEvent = 0;
    if (count === this.lastEvent) return;
    const kinds = this.starKinds(this.state());
    for (let seq = Math.max(this.lastEvent + 1, count - EVENT_SLOTS + 1); seq <= count; seq++) {
      const o = 1 + ((seq - 1) % EVENT_SLOTS) * EVENT_STRIDE;
      const kind = ev[o + 1]!;
      if (kind === EVENT.criticalOn || kind === EVENT.criticalOff) {
        this.post({ type: 'critical', critical: kind === EVENT.criticalOn });
        continue;
      }
      const described = describeEvent(kind, ev[o + 2]!, ev[o + 3]!, kinds);
      if (described) this.post({ type: 'event', ...described });
    }
    this.lastEvent = count;
  }

  private sendTelemetry(): void {
    const s = this.state();
    const preset = PRESETS[s[STATE.preset]!] ?? PRESETS[0]!;
    const kinds = this.starKinds(s);
    const stars = kinds.map((kind, i) => {
      const o = STATE.stars + i * STATE.starWidth;
      return {
        kind,
        phase: STAR_PHASES[s[o + 1]!] ?? '—',
        temperature: s[o + 2]!,
      };
    });
    const host = Math.max(0, kinds.indexOf(STAR_KINDS[2]));
    const engine: EngineTelemetry = {
      stars,
      era: ERAS[s[STATE.era]!] ?? '—',
      civilisation: s[STATE.civil]!,
      lights: s[STATE.lights] === 1,
      critical: s[STATE.critical] === 1,
      host,
      hostProgress: s[STATE.stars + host * STATE.starWidth + 4]!,
    };
    this.post({
      type: 'telemetry',
      telemetry: {
        kinetic: s[STATE.kinetic]!,
        potential: s[STATE.potential]!,
        total: s[STATE.total]!,
        drift: s[STATE.drift]!,
        divergence: s[STATE.ghostOn] === 1 ? s[STATE.ghostGap]! : null,
        preset: { index: PRESETS.indexOf(preset), name: preset.name, short: preset.short },
        engine,
      },
    });
  }
}
