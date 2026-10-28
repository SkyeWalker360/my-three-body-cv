/**
 * The deck camera: a perspective view from the platform. World coordinates are the engine's
 * (x, y in the orbital plane, z up, AU). The camera has a base frame set by the vantage
 * (forward and up) and the visitor's look offsets on top: yaw ±180°, pitch ±60°.
 */

export type Vec3 = [number, number, number];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));

export const DEG = Math.PI / 180;
export const BASE_FOV = 100 * DEG;
export const MAX_PITCH = 60 * DEG;
export const MAX_ZOOM = 50;

export type Camera = {
  position: Vec3;
  /** The vantage's resting direction and up vector. */
  baseForward: Vec3;
  baseUp: Vec3;
  yaw: number;
  pitch: number;
  zoom: number;
  width: number;
  height: number;
};

export type Basis = { forward: Vec3; right: Vec3; up: Vec3; focal: number };

/** Rotates `v` about unit axis `k` by `angle` (Rodrigues). */
function rotate(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

export const clampPitch = (p: number) => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p));
export const clampZoom = (z: number) => Math.max(1, Math.min(MAX_ZOOM, z));
export const wrapYaw = (y: number) => Math.atan2(Math.sin(y), Math.cos(y));

/** Horizontal field of view after the telescope's zoom. */
export const fov = (cam: Camera) => BASE_FOV / cam.zoom;

export function basis(cam: Camera): Basis {
  const f0 = normalize(cam.baseForward);
  const u0 = normalize(sub(cam.baseUp, scale(f0, dot(cam.baseUp, f0))));
  const r0 = cross(f0, u0);
  const fYaw = rotate(f0, u0, -cam.yaw);
  const rYaw = rotate(r0, u0, -cam.yaw);
  const forward = rotate(fYaw, rYaw, cam.pitch);
  const up = cross(rYaw, forward);
  const focal = cam.width / 2 / Math.tan(fov(cam) / 2);
  return { forward, right: rYaw, up, focal };
}

export type Projected = { x: number; y: number; depth: number };

/** Screen position of a direction (camera-relative vector), or null behind the viewer. */
export function projectDirection(b: Basis, cam: Camera, d: Vec3): Projected | null {
  const z = dot(d, b.forward);
  if (z <= 1e-9) return null;
  return {
    x: cam.width / 2 + (b.focal * dot(d, b.right)) / z,
    y: cam.height / 2 - (b.focal * dot(d, b.up)) / z,
    depth: z,
  };
}

export const project = (b: Basis, cam: Camera, p: Vec3) =>
  projectDirection(b, cam, sub(p, cam.position));

/** Unit view direction through pixel (x, y). */
export function pixelDirection(b: Basis, cam: Camera, x: number, y: number): Vec3 {
  const dx = x - cam.width / 2;
  const dy = cam.height / 2 - y;
  return normalize(add(add(scale(b.forward, b.focal), scale(b.right, dx)), scale(b.up, dy)));
}

/** True angular radius of a sphere of radius r at distance d: asin(r / d). */
export const angularRadius = (r: number, d: number) => (d <= r ? Math.PI / 2 : Math.asin(r / d));

/** Angular radius on screen, in pixels. */
export const pixelRadius = (b: Basis, theta: number) => b.focal * Math.tan(Math.min(theta, 1.5));

/** Yaw and pitch that point the view at `target`, relative to the vantage's base frame. */
export function aimAt(cam: Camera, target: Vec3): { yaw: number; pitch: number } {
  const f0 = normalize(cam.baseForward);
  const u0 = normalize(sub(cam.baseUp, scale(f0, dot(cam.baseUp, f0))));
  const r0 = cross(f0, u0);
  const d = normalize(sub(target, cam.position));
  return {
    yaw: wrapYaw(Math.atan2(dot(d, r0), dot(d, f0))),
    pitch: clampPitch(Math.asin(Math.max(-1, Math.min(1, dot(d, u0))))),
  };
}
