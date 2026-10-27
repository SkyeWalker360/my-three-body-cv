/** A fixed-size ring buffer of particles, so the cursor never allocates while animating. */
export const POOL_SIZE = 200;
export const DRAG = 0.98;

export class ParticlePool {
  readonly x = new Float32Array(POOL_SIZE);
  readonly y = new Float32Array(POOL_SIZE);
  readonly vx = new Float32Array(POOL_SIZE);
  readonly vy = new Float32Array(POOL_SIZE);
  /** Remaining life in seconds; ≤ 0 means the slot is free. */
  readonly life = new Float32Array(POOL_SIZE);
  readonly maxLife = new Float32Array(POOL_SIZE);
  private head = 0;

  spawn(x: number, y: number, vx: number, vy: number, life: number): void {
    const i = this.head;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.head = (this.head + 1) % POOL_SIZE;
  }

  /** Advance every live particle; `dt` in seconds, velocities in pixels per 1/60 s. */
  update(dt: number): void {
    const frames = dt * 60;
    const drag = Math.pow(DRAG, frames);
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.life[i]! <= 0) continue;
      this.x[i] = this.x[i]! + this.vx[i]! * frames;
      this.y[i] = this.y[i]! + this.vy[i]! * frames;
      this.vx[i] = this.vx[i]! * drag;
      this.vy[i] = this.vy[i]! * drag;
      this.life[i] = this.life[i]! - dt;
    }
  }

  /** 1 at birth, 0 at death. */
  fraction(i: number): number {
    return Math.max(0, this.life[i]! / this.maxLife[i]!);
  }

  alive(): number {
    let n = 0;
    for (let i = 0; i < POOL_SIZE; i++) if (this.life[i]! > 0) n++;
    return n;
  }

  clear(): void {
    this.life.fill(0);
  }
}

/** Size shrinks from 4 px at birth to 1 px at death. */
export function particleSize(fraction: number): number {
  return 1 + Math.round(3 * fraction);
}

/** Index into the colour ramp (white → cyan → gold → red → violet) for a life fraction. */
export function rampIndex(fraction: number, steps: number): number {
  return Math.min(steps - 1, Math.floor((1 - fraction) * steps));
}
