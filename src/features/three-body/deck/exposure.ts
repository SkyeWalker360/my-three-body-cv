/**
 * Brightness and auto-exposure (brief §3). Radiance is in Suns per AU² per steradian, so a
 * body's apparent flux is L / d² and a disc's surface radiance is that flux over its solid
 * angle. Exposure adapts to the brightest thing in view, and a logarithmic tone curve maps
 * radiance onto palette steps, the way eyes and cameras compress a scene's range.
 */

/** Decades of radiance between black and white on screen. */
export const DYNAMIC_RANGE = 3.5;
/** Seconds for exposure to settle when the scene gets brighter / darker (eyes adapt to glare faster). */
export const ADAPT_BRIGHTER = 0.12;
export const ADAPT_DARKER = 0.6;

/** Flux at Earth from a star of apparent magnitude m, in Suns at 1 AU (Sun: m = −26.74). */
export const magnitudeFlux = (m: number) => 10 ** (-0.4 * (m + 26.74));

/** Apparent flux of luminosity L (Suns) at distance d (AU). */
export const flux = (luminosity: number, d: number) => luminosity / (d * d);

/** Surface radiance of a disc of angular radius θ, or of a point spread over one pixel. */
export function radiance(f: number, theta: number, pixelSolidAngle: number): number {
  const omega = Math.max(Math.PI * theta * theta, pixelSolidAngle);
  return f / omega;
}

/**
 * Tone in [0, ∞): 1 is white at the current exposure, values above 1 are overexposed.
 * Below DYNAMIC_RANGE decades under white the result is 0 (black).
 */
export function tone(r: number, exposure: number): number {
  const x = r * exposure;
  if (x <= 0) return 0;
  if (x >= 1) return x;
  return Math.max(0, 1 + Math.log10(x) / DYNAMIC_RANGE);
}

/** The brightest exposure the deck allows: a magnitude −1.5 star (Sirius-like) is white. */
export function maxExposure(pixelSolidAngle: number): number {
  return pixelSolidAngle / magnitudeFlux(-1.5);
}

/** Exposure that makes radiance `peak` exactly white, capped at the deck's maximum. */
export function targetExposure(peak: number, pixelSolidAngle: number): number {
  const cap = maxExposure(pixelSolidAngle);
  return peak > 0 ? Math.min(cap, 1 / peak) : cap;
}

/** Moves exposure toward the target in log space; `instant` skips adaptation (reduced motion). */
export function adapt(exposure: number, target: number, dt: number, instant = false): number {
  if (instant || !(exposure > 0)) return target;
  const tau = target < exposure ? ADAPT_BRIGHTER : ADAPT_DARKER;
  const k = 1 - Math.exp(-dt / tau);
  return Math.exp(Math.log(exposure) + (Math.log(target) - Math.log(exposure)) * k);
}

/** Exposure value relative to the Sun at 1 AU seen as a 1-pixel point (for the HUD). */
export const exposureValue = (exposure: number, pixelSolidAngle: number) =>
  Math.log2((exposure * 1) / pixelSolidAngle);
