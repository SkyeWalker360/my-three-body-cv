import { STATE } from '../engine-layout';
import { type EngineExports } from '../engine';
import { BODY } from '../engine-layout';
import { type DeckBody, readBodies } from './bodies';
import {
  aimAt,
  basis,
  type Camera,
  clampPitch,
  clampZoom,
  normalize,
  sub,
  type Vec3,
  wrapYaw,
} from './camera';
import { adapt, flux, targetExposure } from './exposure';
import { visibleFraction } from './eclipse';
import { drawGlass, drawInterior, interiorLevel } from './interior';
import { type Platform, stepPlatform } from './platform';
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
import { schwarzschildAu } from './units';
import { DEFAULT_VANTAGE, hole, VANTAGES, type VantageId } from './vantages';

/** Engine frame size the deck asks for, so the engine's pixel radii stay at reference scale. */
const ENGINE_W = 480;
const ENGINE_H = 270;

/**
 * One observation session: its own engine instance (so the deck's time controls never touch
 * the background lab), the platform, the camera and exposure. `frame()` advances and draws.
 */
export class DeckSession {
  readonly sky: SkyStar[] = makeSky();
  pixels: Uint8Array;
  bodies: DeckBody[] = [];
  platform: Platform;
  camera: Camera;
  vantage: VantageId = DEFAULT_VANTAGE;
  exposure = 0;
  /** Simulation time units elapsed since the session started. */
  elapsed = 0;
  lastFrame: Frame | null = null;
  light = { level: 0, colourClass: 3 };
  /** Stars partly hidden from the deck right now: name and fraction covered. */
  eclipses: { name: string; covered: number }[] = [];
  private skyMap: SkyMap | null = null;
  /** Free look holds wherever it was chosen. */
  private hold: Vec3 | null = null;
  private time = 0;
  private parallax = { x: 0, y: 0 };
  private state: Float64Array;
  private bodyBuffer: Float64Array;

  constructor(
    private engine: EngineExports,
    width: number,
    height: number,
    preset: number,
    seed: number,
    private instant: boolean,
  ) {
    engine.init(seed, preset);
    engine.resize(ENGINE_W, ENGINE_H);
    this.state = new Float64Array(engine.memory.buffer, engine.statePtr(), STATE.length);
    this.bodyBuffer = new Float64Array(
      engine.memory.buffer,
      engine.bodiesPtr(),
      BODY.rows * BODY.width,
    );
    engine.advance(0);
    this.bodies = readBodies(this.state, this.bodyBuffer);
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
    this.engine.init(seed, preset);
    this.engine.resize(ENGINE_W, ENGINE_H);
    this.engine.advance(0);
    this.bodies = readBodies(this.state, this.bodyBuffer);
    this.elapsed = 0;
    this.setVantage(this.vantage, true);
  }

  /** Moves to a vantage. Phase 1 jumps; guided transits arrive in Phase 4. */
  setVantage(id: VantageId, jump = true) {
    const v = VANTAGES[id];
    this.vantage = id;
    this.hold = id === 'free' ? this.platform.position : null;
    const station = v.station(this.bodies) ?? this.platform.position;
    if (jump || v.rides) this.platform = { position: station, velocity: [0, 0, 0] };
    this.camera = {
      ...this.camera,
      position: this.platform.position,
      baseForward: id === 'free' ? this.viewDirection() : v.forward,
      baseUp: id === 'free' ? basis(this.camera).up : v.up,
      yaw: 0,
      pitch: 0,
    };
  }

  viewDirection(): Vec3 {
    return basis(this.camera).forward;
  }

  look(dYaw: number, dPitch: number) {
    this.camera.yaw = wrapYaw(this.camera.yaw + dYaw);
    this.camera.pitch = clampPitch(this.camera.pitch + dPitch);
    // The frame lags the turn a little: interior moves most, the sky not at all.
    this.parallax.x = Math.max(-3, Math.min(3, this.parallax.x + dYaw * 40));
    this.parallax.y = Math.max(-2, Math.min(2, this.parallax.y - dPitch * 40));
  }

  zoomBy(factor: number) {
    this.camera.zoom = clampZoom(this.camera.zoom * factor);
  }

  /** Centres the view on a body (snaps; slewing animation is for the console in Phase 3). */
  focus(body: DeckBody) {
    const { yaw, pitch } = aimAt(this.camera, body.position);
    this.camera.yaw = yaw;
    this.camera.pitch = pitch;
  }

  /** The body nearest the centre of the view, by angle. */
  nearestToCentre(): DeckBody | null {
    const f = this.viewDirection();
    let best: DeckBody | null = null;
    let bestCos = -2;
    for (const b of this.bodies) {
      if (b.kind === 'fragment') continue;
      const d = normalize(sub(b.position, this.camera.position));
      const c = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
      if (c > bestCos) {
        bestCos = c;
        best = b;
      }
    }
    return best;
  }

  /** Advances `dt` real seconds (× warp) and draws the view. */
  frame(dt: number, warp: number): Frame {
    this.time += dt;
    const before = this.simTime;
    if (warp > 0) this.engine.advance(dt * 1000 * warp);
    const after = this.simTime;
    // The engine resets its clock when it reloads a preset after an escape.
    const dSim = after >= before ? after - before : after;
    this.elapsed += dSim;
    this.bodies = readBodies(this.state, this.bodyBuffer);

    const vantage = VANTAGES[this.vantage];
    if (vantage.available && !vantage.available(this.bodies)) this.setVantage('above');
    const station = this.hold ?? VANTAGES[this.vantage].station(this.bodies);
    if (VANTAGES[this.vantage].rides && station) {
      this.platform = { position: station, velocity: hole(this.bodies)?.velocity ?? [0, 0, 0] };
    } else if (dSim > 0) {
      this.platform = stepPlatform(
        this.platform,
        this.bodies
          .filter((b) => b.kind === 'star')
          .map((b) => ({ position: b.position, mass: b.mass })),
        dSim,
        station,
      );
    }
    this.camera.position = this.platform.position;

    const frame = renderDeck(
      this.pixels,
      this.camera,
      this.bodies,
      this.sky,
      this.exposure || 1e-9,
      this.time,
      this.lens(),
    );
    const omega = pixelSolidAngle(basis(this.camera));
    this.exposure = adapt(
      this.exposure,
      targetExposure(frame.peak, omega),
      dt,
      this.instant || this.exposure === 0,
    );

    // Starlight reaching the deck lights the frame, less whatever is eclipsed.
    let total = 0;
    let strongest = 0;
    this.eclipses = [];
    for (const b of this.bodies) {
      if (b.luminosity <= 0) continue;
      const seen = visibleFraction(this.camera.position, b, this.bodies);
      if (seen < 0.99) this.eclipses.push({ name: b.name, covered: 1 - seen });
      const f =
        flux(b.luminosity, Math.max(1e-3, Math.hypot(...sub(b.position, this.camera.position)))) *
        seen;
      total += f;
      if (f > strongest) {
        strongest = f;
        this.light.colourClass = b.colourClass;
      }
    }
    this.light.level = interiorLevel(total);
    const k = Math.exp(-dt * 6);
    this.parallax.x *= k;
    this.parallax.y *= k;
    const { width, height } = this.camera;
    drawGlass(this.pixels, width, height, this.light, this.parallax);
    drawInterior(this.pixels, width, height, this.light, this.parallax, this.time, this.critical);
    this.lastFrame = frame;
    return frame;
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
