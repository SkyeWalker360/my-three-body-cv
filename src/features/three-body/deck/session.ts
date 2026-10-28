import type { LabEventKind } from '@/lib/events';
import { describeEvent, type EngineExports } from '../engine';
import {
  BODY,
  EFFECT,
  ENGINE_PALETTE,
  EVENT,
  EVENT_SLOTS,
  EVENT_STRIDE,
  STAR_KINDS,
  STATE,
} from '../engine-layout';
import { type DeckBody, readBodies } from './bodies';
import {
  add,
  aimAt,
  angularRadius,
  basis,
  type Camera,
  clampPitch,
  clampZoom,
  dot,
  length,
  normalize,
  scale,
  sub,
  type Vec3,
  wrapYaw,
} from './camera';
import { visibleFraction } from './eclipse';
import { drawEffects, type Effect, flashRadiance, readEffects } from './effects';
import { adapt, flux, targetExposure } from './exposure';
import { drawGlass, drawInterior, interiorLevel } from './interior';
import { drawOverlays, NO_OVERLAYS, type Overlays, Trails } from './overlays';
import { type Obstacle, type Platform, stepPlatform } from './platform';
import {
  type Frame,
  type Lens,
  makeSky,
  makeSkyMap,
  pixelSolidAngle,
  renderDeck,
  type SkyMap,
  type SkyStar,
} from './render';
import { formatDuration, schwarzschildAu, simToSeconds } from './units';
import { DEFAULT_VANTAGE, hole, VANTAGES, type VantageId } from './vantages';

/** Engine frame size the deck asks for, so the engine's pixel radii stay at reference scale. */
const ENGINE_W = 480;
const ENGINE_H = 270;
/** Transits use a gentler drive than station-keeping, so the trip arcs under gravity. */
export const TRANSIT_THRUST = 6;
/** Transits run the clock at least this fast (brief: "trips are shown at time-warp"). */
export const TRANSIT_WARP = 4;
/** Arrival: within this distance (AU) of the station and slower than this speed. */
const ARRIVE_DISTANCE = 0.05;
const ARRIVE_SPEED = 0.6;
/** Jump wipe length in seconds; the platform moves at its midpoint. */
export const WIPE_SECONDS = 0.4;
/** A supernova shock front passing the platform kicks it outward by this much × strength. */
export const SHOCK_KICK = 0.6;
const WIPE = ENGINE_PALETTE.indexOf('void-0');

export type DeckEvent = { kind: LabEventKind | 'critical'; message: string; critical?: boolean };

/**
 * One observation session: its own engine instance (so the deck's time controls never touch
 * the background lab), the platform, the camera and exposure. `frame()` advances and draws.
 */
export class DeckSession {
  readonly sky: SkyStar[] = makeSky();
  pixels: Uint8Array;
  bodies: DeckBody[] = [];
  effects: Effect[] = [];
  platform: Platform;
  camera: Camera;
  vantage: VantageId = DEFAULT_VANTAGE;
  preset: number;
  exposure = 0;
  /** Simulation time units elapsed since the session started. */
  elapsed = 0;
  lastFrame: Frame | null = null;
  light = { level: 0, colourClass: 3 };
  /** Stars partly hidden from the deck right now: name and fraction covered. */
  eclipses: { name: string; covered: number }[] = [];
  /** The soonest predicted eclipse, from how fast discs are closing on each other. */
  nextEclipse: { star: string; by: string; seconds: number } | null = null;
  overlays: Overlays = { ...NO_OVERLAYS };
  readonly trails = new Trails();
  /** The body the view follows, by id, until the visitor looks away. */
  tracking: string | null = null;
  /** Show the engine's own orthographic pixel lab instead of the deck view (K.A.R.L.'s /lab). */
  labView = false;
  ghostOn = false;
  /** A guided trip in progress: where to, and the sim time it started. */
  transit: { to: VantageId; started: number } | null = null;
  /** The last few event messages, for K.A.R.L.'s narration. */
  readonly recent: string[] = [];
  private skyMap: SkyMap | null = null;
  private wipe: { t: number; to: VantageId; moved: boolean } | null = null;
  private lastEvent = 0;
  private events: Int32Array;
  private effectBuffer: Float64Array;
  /** Free look holds wherever it was chosen. */
  private hold: Vec3 | null = null;
  private time = 0;
  private parallax = { x: 0, y: 0 };
  private state: Float64Array;
  private bodyBuffer: Float64Array;
  private lastStation: Vec3 | null = null;
  private nudged = new Set<string>();
  private gaps = new Map<string, { gap: number; t: number }>();

  constructor(
    private engine: EngineExports,
    width: number,
    height: number,
    preset: number,
    seed: number,
    private instant: boolean,
  ) {
    this.preset = preset;
    engine.init(seed, preset);
    engine.resize(ENGINE_W, ENGINE_H);
    this.state = new Float64Array(engine.memory.buffer, engine.statePtr(), STATE.length);
    this.bodyBuffer = new Float64Array(
      engine.memory.buffer,
      engine.bodiesPtr(),
      BODY.rows * BODY.width,
    );
    this.events = new Int32Array(
      engine.memory.buffer,
      engine.eventsPtr(),
      1 + EVENT_SLOTS * EVENT_STRIDE,
    );
    this.effectBuffer = new Float64Array(
      engine.memory.buffer,
      engine.effectsPtr(),
      1 + EFFECT.rows * EFFECT.width,
    );
    engine.advance(0);
    this.bodies = readBodies(this.state, this.bodyBuffer);
    this.lastEvent = this.events[0]!;
    const v = VANTAGES[this.vantage];
    const start = v.station(this.bodies) ?? [0, 0, 2.6];
    this.platform = { position: start, velocity: [0, 0, 0] };
    this.camera = {
      position: start,
      baseForward: v.forward,
      baseUp: v.up,
      yaw: 0,
      pitch: 0,
      zoom: 1,
      width,
      height,
    };
    this.pixels = new Uint8Array(width * height);
  }

  resize(width: number, height: number) {
    this.camera = { ...this.camera, width, height };
    this.pixels = new Uint8Array(width * height);
  }

  get simTime(): number {
    return this.state[STATE.simTime]!;
  }

  get critical(): boolean {
    return this.state[STATE.critical]! > 0;
  }

  setPreset(preset: number, seed: number) {
    this.preset = preset;
    this.engine.init(seed, preset);
    this.engine.resize(ENGINE_W, ENGINE_H);
    this.engine.ghost(this.ghostOn ? 1 : 0);
    this.engine.advance(0);
    this.bodies = readBodies(this.state, this.bodyBuffer);
    this.lastEvent = this.events[0]!;
    this.trails.clear();
    this.tracking = null;
    this.transit = null;
    this.nudged.clear();
    this.elapsed = 0;
    const v = VANTAGES[this.vantage];
    this.setVantage(v.available && !v.available(this.bodies, preset) ? 'above' : this.vantage);
  }

  /** Whether a vantage is offered right now (some need a planet, a hole or a preset). */
  offers(id: VantageId): boolean {
    const v = VANTAGES[id];
    return !v.available || v.available(this.bodies, this.preset);
  }

  /** Moves to a vantage at once (no wipe): used on start, preset changes and arrivals. */
  setVantage(id: VantageId) {
    const v = VANTAGES[id];
    this.vantage = id;
    this.transit = null;
    this.hold = id === 'free' ? this.platform.position : null;
    const station = v.station(this.bodies) ?? this.platform.position;
    this.platform = { position: station, velocity: [0, 0, 0] };
    this.lastStation = null;
    this.camera = {
      ...this.camera,
      position: this.platform.position,
      baseForward: id === 'free' ? this.viewDirection() : v.forward,
      baseUp: id === 'free' ? basis(this.camera).up : v.up,
      yaw: 0,
      pitch: 0,
    };
    this.applyFrame();
  }

  /** "Jump": a scanline wipe, then straight there. Reduced motion skips the wipe. */
  jump(id: VantageId) {
    if (!this.offers(id)) return;
    if (this.instant) this.setVantage(id);
    else this.wipe = { t: 0, to: id, moved: false };
  }

  /**
   * A guided trip under real gravity and a capped drive, routed around bodies. Riding
   * vantages and free look have nothing to fly to, so they jump; reduced motion always jumps.
   */
  travel(id: VantageId) {
    const v = VANTAGES[id];
    if (!this.offers(id)) return;
    if (this.instant || v.rides || id === 'free') return this.jump(id);
    this.transit = { to: id, started: this.elapsed };
    this.hold = null;
    this.tracking = null;
    const station = v.station(this.bodies);
    if (station) {
      // Face the destination for the trip.
      this.camera = {
        ...this.camera,
        baseForward: sub(station, this.platform.position),
        baseUp: [0, 0, 1],
        yaw: 0,
        pitch: 0,
      };
    }
  }

  /** Real time a transit has taken so far, formatted. */
  transitElapsed(): string | null {
    return this.transit ? formatDuration(simToSeconds(this.elapsed - this.transit.started)) : null;
  }

  viewDirection(): Vec3 {
    return basis(this.camera).forward;
  }

  look(dYaw: number, dPitch: number) {
    this.tracking = null;
    this.camera.yaw = wrapYaw(this.camera.yaw + dYaw);
    this.camera.pitch = clampPitch(this.camera.pitch + dPitch);
    // The frame lags the turn a little: interior moves most, the sky not at all.
    this.parallax.x = Math.max(-3, Math.min(3, this.parallax.x + dYaw * 40));
    this.parallax.y = Math.max(-2, Math.min(2, this.parallax.y - dPitch * 40));
  }

  zoomBy(factor: number) {
    this.camera.zoom = clampZoom(this.camera.zoom * factor);
  }

  setZoom(zoom: number) {
    this.camera.zoom = clampZoom(zoom);
  }

  /** Slews the view onto a body and keeps it centred until the visitor looks away. */
  focus(body: DeckBody) {
    this.tracking = body.id;
    if (this.instant) this.aim(body, 1);
  }

  /** Finds a body by a typed name (K.A.R.L.'s /focus): "star 2", "2", "planet". */
  findBody(query: string): DeckBody | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (
      this.bodies.find((b) => b.kind !== 'fragment' && b.name.toLowerCase() === q) ??
      this.bodies.find((b) => b.kind === 'star' && String(b.star + 1) === q.replace(/\D/g, '')) ??
      this.bodies.find((b) => b.kind !== 'fragment' && b.name.toLowerCase().includes(q)) ??
      null
    );
  }

  private aim(body: DeckBody, k: number) {
    const { yaw, pitch } = aimAt(this.camera, body.position);
    this.camera.yaw = wrapYaw(this.camera.yaw + wrapYaw(yaw - this.camera.yaw) * k);
    this.camera.pitch = clampPitch(this.camera.pitch + (pitch - this.camera.pitch) * k);
  }

  /** The body drawn under buffer pixel (x, y), allowing a few pixels' slack for small ones. */
  pick(x: number, y: number): DeckBody | null {
    let best: DeckBody | null = null;
    let bestD = Infinity;
    for (const s of this.lastFrame?.onScreen ?? []) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= Math.max(s.r + 2, 6) && d < bestD) {
        bestD = d;
        best = s.body;
      }
    }
    return best;
  }

  /** The old Lab's telemetry: energies, drift and the chaos ghost's divergence. */
  telemetry() {
    this.ensureViews();
    const s = this.state;
    return {
      kinetic: s[STATE.kinetic]!,
      potential: s[STATE.potential]!,
      total: s[STATE.total]!,
      drift: s[STATE.drift]!,
      ghostGap: s[STATE.ghostGap]!,
    };
  }

  setGhost(on: boolean) {
    this.ghostOn = on;
    this.engine.ghost(on ? 1 : 0);
  }

  kick() {
    this.engine.kick(-1, 0, 0);
  }

  /** New engine events since the last call, described as in the lab. */
  drainEvents(): DeckEvent[] {
    this.ensureViews();
    const ev = this.events;
    const count = ev[0]!;
    if (count < this.lastEvent) this.lastEvent = 0;
    const out: DeckEvent[] = [];
    if (count === this.lastEvent) return out;
    const kinds = [0, 1, 2].map(
      (i) => STAR_KINDS[this.state[STATE.stars + i * STATE.starWidth]!] ?? 'Star',
    );
    for (let seq = Math.max(this.lastEvent + 1, count - EVENT_SLOTS + 1); seq <= count; seq++) {
      const o = 1 + ((seq - 1) % EVENT_SLOTS) * EVENT_STRIDE;
      const kind = ev[o + 1]!;
      if (kind === EVENT.criticalOn || kind === EVENT.criticalOff) {
        out.push({ kind: 'critical', message: '', critical: kind === EVENT.criticalOn });
        continue;
      }
      const d = describeEvent(kind, ev[o + 2]!, ev[o + 3]!, kinds);
      if (d) {
        out.push(d);
        this.recent.unshift(d.message);
        this.recent.length = Math.min(this.recent.length, 4);
      }
    }
    this.lastEvent = count;
    return out;
  }

  /**
   * K.A.R.L.'s narration, on request (Luke, 28 Oct: only when asked): what's happening now,
   * what's coming (the next eclipse) and what just happened.
   */
  narrate(): string[] {
    const lines: string[] = [];
    for (const b of this.bodies) {
      if (b.kind === 'star' && b.phase === 'Giant')
        lines.push(`${b.name} is leaving the main sequence: it's swelling into a giant.`);
    }
    if (this.nextEclipse && this.nextEclipse.seconds < 120)
      lines.push(
        `Eclipse in about ${Math.max(1, Math.round(this.nextEclipse.seconds))} seconds: ${this.nextEclipse.by} will cross ${this.nextEclipse.star}.`,
      );
    for (const e of this.eclipses)
      lines.push(`${e.name} is ${Math.round(e.covered * 100)}% eclipsed right now.`);
    if (this.transit) lines.push(`In transit to ${VANTAGES[this.transit.to].name}.`);
    if (this.recent.length) lines.push(`Last event: ${this.recent[0]}`);
    if (!lines.length) lines.push('All quiet out there. Age a star if you want fireworks.');
    return lines;
  }

  /** The engine's own orthographic frame (480 × 270 palette indices) for the lab view. */
  labFrame(): { pixels: Uint8Array; width: number; height: number } {
    this.engine.render();
    const width = this.engine.frameWidth();
    const height = this.engine.frameHeight();
    return {
      pixels: new Uint8Array(this.engine.memory.buffer, this.engine.framePtr(), width * height),
      width,
      height,
    };
  }

  /** The body nearest the centre of the view, by angle. */
  nearestToCentre(): DeckBody | null {
    const f = this.viewDirection();
    let best: DeckBody | null = null;
    let bestCos = -2;
    for (const b of this.bodies) {
      if (b.kind === 'fragment') continue;
      const c = dot(normalize(sub(b.position, this.camera.position)), f);
      if (c > bestCos) {
        bestCos = c;
        best = b;
      }
    }
    return best;
  }

  /** Views onto engine memory go stale (zero length) if WebAssembly memory ever grows. */
  private ensureViews() {
    if (
      this.state.length &&
      this.bodyBuffer.length &&
      this.events.length &&
      this.effectBuffer.length
    )
      return;
    const e = this.engine;
    this.state = new Float64Array(e.memory.buffer, e.statePtr(), STATE.length);
    this.bodyBuffer = new Float64Array(e.memory.buffer, e.bodiesPtr(), BODY.rows * BODY.width);
    this.events = new Int32Array(e.memory.buffer, e.eventsPtr(), 1 + EVENT_SLOTS * EVENT_STRIDE);
    this.effectBuffer = new Float64Array(
      e.memory.buffer,
      e.effectsPtr(),
      1 + EFFECT.rows * EFFECT.width,
    );
  }

  /** Vantages that follow the system re-aim their resting frame every frame. */
  private applyFrame() {
    const v = VANTAGES[this.vantage];
    const f = !this.transit && v.frame?.(this.bodies, this.platform.position);
    if (f) {
      this.camera.baseForward = f.forward;
      this.camera.baseUp = f.up;
    }
  }

  private obstacles(): Obstacle[] {
    return this.bodies
      .filter((b) => b.kind !== 'fragment')
      .map((b) => ({ position: b.position, radius: b.radius }));
  }

  /** Advances `dt` real seconds (× warp) and draws the view. */
  frame(dt: number, warp: number): Frame {
    this.ensureViews();
    this.time += dt;
    const rate = this.transit ? Math.max(warp, TRANSIT_WARP) : warp;
    const before = this.simTime;
    if (rate > 0) this.engine.advance(dt * 1000 * rate);
    const after = this.simTime;
    // The engine resets its clock when it reloads a preset after an escape.
    const dSim = after >= before ? after - before : after;
    this.elapsed += dSim;
    this.bodies = readBodies(this.state, this.bodyBuffer);
    this.effects = readEffects(this.effectBuffer);
    this.trails.record(this.bodies, after);

    // A jump's wipe moves the platform at its midpoint.
    if (this.wipe) {
      this.wipe.t += dt;
      if (!this.wipe.moved && this.wipe.t >= WIPE_SECONDS / 2) {
        this.wipe.moved = true;
        this.setVantage(this.wipe.to);
      }
    }

    if (!this.offers(this.vantage)) this.setVantage('above');
    const target = this.transit ? this.transit.to : this.vantage;
    const v = VANTAGES[target];
    const station = this.transit ? v.station(this.bodies) : (this.hold ?? v.station(this.bodies));
    let stationVelocity: Vec3 = [0, 0, 0];
    if (!this.transit && v.rides && station) {
      this.platform = {
        position: station,
        velocity: (v.id === 'blackhole'
          ? hole(this.bodies)
          : this.bodies.find((b) => b.kind === 'planet')
        )?.velocity ?? [0, 0, 0],
      };
    } else if (dSim > 0) {
      // Stations that move (L4, the barycentre) are tracked with their velocity too.
      stationVelocity =
        station && this.lastStation ? scale(sub(station, this.lastStation), 1 / dSim) : [0, 0, 0];
      this.platform = stepPlatform(
        this.platform,
        this.bodies
          .filter((b) => b.kind === 'star')
          .map((b) => ({ position: b.position, mass: b.mass })),
        dSim,
        station,
        stationVelocity,
        this.transit ? TRANSIT_THRUST : undefined,
        this.obstacles(),
      );
    }
    this.lastStation = station;
    this.shockNudge();
    if (this.transit && station) {
      const close = length(sub(this.platform.position, station)) < ARRIVE_DISTANCE;
      // Arrival is judged against the station's own motion (L4 swings round with its pair).
      if (close && length(sub(this.platform.velocity, stationVelocity)) < ARRIVE_SPEED) {
        const to = this.transit.to;
        this.transit = null;
        const keep = this.platform;
        this.setVantage(to);
        this.platform = keep;
      }
    }
    this.camera.position = this.platform.position;
    this.applyFrame();
    const tracked = this.tracking ? this.bodies.find((b) => b.id === this.tracking) : undefined;
    if (this.tracking && !tracked) this.tracking = null;
    if (tracked) this.aim(tracked, this.instant ? 1 : 1 - Math.exp(-dt * 5));

    const frame = renderDeck(
      this.pixels,
      this.camera,
      this.bodies,
      this.sky,
      this.exposure || 1e-9,
      this.time,
      this.lens(),
    );
    drawEffects(this.pixels, this.camera, this.effects, this.bodies);
    drawOverlays(this.pixels, this.camera, this.bodies, this.trails, this.overlays);
    const omega = pixelSolidAngle(basis(this.camera));
    // A supernova flash in view clamps the exposure like glare.
    let peak = frame.peak;
    for (const e of this.effects) peak = Math.max(peak, flashRadiance(e, this.camera, omega));
    this.exposure = adapt(
      this.exposure,
      targetExposure(peak, omega),
      dt,
      this.instant || this.exposure === 0,
    );

    this.lightDeck();
    this.predictEclipse();
    const k = Math.exp(-dt * 6);
    this.parallax.x *= k;
    this.parallax.y *= k;
    const { width, height } = this.camera;
    drawGlass(this.pixels, width, height, this.light, this.parallax);
    drawInterior(this.pixels, width, height, this.light, this.parallax, this.time, this.critical);
    this.drawWipe();
    this.lastFrame = frame;
    return frame;
  }

  /** Starlight reaching the deck lights the frame, less whatever is eclipsed. */
  private lightDeck() {
    let total = 0;
    let strongest = 0;
    this.eclipses = [];
    for (const b of this.bodies) {
      if (b.luminosity <= 0) continue;
      const seen = visibleFraction(this.camera.position, b, this.bodies);
      if (seen < 0.99) this.eclipses.push({ name: b.name, covered: 1 - seen });
      const f =
        flux(b.luminosity, Math.max(1e-3, length(sub(b.position, this.camera.position)))) * seen;
      total += f;
      if (f > strongest) {
        strongest = f;
        this.light.colourClass = b.colourClass;
      }
    }
    this.light.level = interiorLevel(total);
  }

  /**
   * Predicts the next eclipse from how fast each star's disc and each nearer body's disc are
   * closing in angle, in real seconds at the current clock rate.
   */
  private predictEclipse() {
    const at = this.camera.position;
    let best: DeckSession['nextEclipse'] = null;
    for (const s of this.bodies) {
      if (s.luminosity <= 0) continue;
      const ds = length(sub(s.position, at));
      for (const o of this.bodies) {
        if (o === s || o.kind === 'fragment') continue;
        const d = length(sub(o.position, at));
        if (d >= ds) continue;
        const gamma = Math.acos(
          Math.max(
            -1,
            Math.min(1, dot(normalize(sub(s.position, at)), normalize(sub(o.position, at)))),
          ),
        );
        const gap = gamma - angularRadius(s.radius, ds) - angularRadius(o.radius, d);
        const key = `${o.id}>${s.id}`;
        const prev = this.gaps.get(key);
        this.gaps.set(key, { gap, t: this.time });
        if (!prev || gap <= 0 || this.time - prev.t <= 0) continue;
        const closing = (prev.gap - gap) / (this.time - prev.t);
        if (closing <= 0) continue;
        const seconds = gap / closing;
        if (!best || seconds < best.seconds) best = { star: s.name, by: o.name, seconds };
      }
    }
    this.nextEclipse = best;
  }

  /** A supernova shock front sweeping past the platform nudges it outward, once per shock. */
  private shockNudge() {
    for (const e of this.effects) {
      if (e.kind !== 'shock') continue;
      const key = `${e.position[0].toFixed(4)},${e.position[1].toFixed(4)}`;
      if (this.nudged.has(key)) continue;
      const away = sub(this.platform.position, e.position);
      if (length(away) > e.radius) continue;
      this.nudged.add(key);
      if (VANTAGES[this.vantage].rides) continue;
      this.platform = {
        position: this.platform.position,
        velocity: add(this.platform.velocity, scale(normalize(away), SHOCK_KICK * e.strength)),
      };
    }
  }

  /** The jump's scanline wipe: dark lines sweep down, then back up after the move. */
  private drawWipe() {
    if (!this.wipe) return;
    const { width: W, height: H } = this.camera;
    const half = WIPE_SECONDS / 2;
    const p = this.wipe.t < half ? this.wipe.t / half : 1 - (this.wipe.t - half) / half;
    const rows = Math.round(Math.max(0, Math.min(1, p)) * H);
    for (let y = 0; y < rows; y++) {
      // Every other line goes dark first, then the rest: a scanline look, not a fade.
      if (y % 2 === 1 && p < 0.85) continue;
      this.pixels.fill(WIPE, y * W, (y + 1) * W);
    }
    if (this.wipe.t >= WIPE_SECONDS) this.wipe = null;
  }

  /** The lensing pass, when a black hole exists (it switches itself off when far away). */
  private lens(): Lens | null {
    const h = hole(this.bodies);
    if (!h) return null;
    this.skyMap ??= makeSkyMap(this.sky);
    return { position: h.position, rs: schwarzschildAu(h.mass), map: this.skyMap };
  }

  age(): number {
    return this.engine.age();
  }
}
