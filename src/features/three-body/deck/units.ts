/**
 * The one mapping between the engine's G = 1 units and SI (Observation Deck brief §1).
 * Length 1 = 1 AU, mass 1 = 1 solar mass, so time 1 = √(AU³ / (G·M☉)) ≈ 58.1 days.
 * Every distance, duration and brightness the deck shows goes through here.
 */

export const G = 6.6743e-11; // m³ kg⁻¹ s⁻²
export const C = 299_792_458; // m/s
export const AU = 1.495978707e11; // m
export const M_SUN = 1.98847e30; // kg
export const R_SUN = 6.957e8; // m
export const L_SUN = 3.828e26; // W
export const R_EARTH = 6.371e6; // m
export const DAY = 86_400; // s
export const YEAR = 365.25 * DAY; // s

/** Seconds per engine time unit (≈ 5.02 × 10⁶ s). */
export const TIME_UNIT = Math.sqrt(AU ** 3 / (G * M_SUN));

export const simToSeconds = (t: number) => t * TIME_UNIT;
export const auToMetres = (d: number) => d * AU;
export const rSunToAu = (r: number) => (r * R_SUN) / AU;

/** Seconds for light to cross `d` AU. */
export const lightTravelSeconds = (d: number) => auToMetres(d) / C;

/** Schwarzschild radius, in AU, of `mass` solar masses. */
export const schwarzschildAu = (mass: number) => (2 * G * mass * M_SUN) / (C * C) / AU;

/** Planck's law, spectral radiance (W sr⁻¹ m⁻³) at wavelength `lambda` metres. */
export function planck(lambda: number, temperature: number): number {
  const h = 6.62607015e-34;
  const k = 1.380649e-23;
  return (2 * h * C * C) / lambda ** 5 / (Math.exp((h * C) / (lambda * k * temperature)) - 1);
}

/** Wien's displacement law: peak wavelength in metres. */
export const wienPeak = (temperature: number) => 2.897771955e-3 / temperature;

/** A duration in seconds, in the largest sensible unit ("3.2 years", "14 days", "5.0 h"). */
export function formatDuration(seconds: number): string {
  const s = Math.abs(seconds);
  if (s >= YEAR) return `${(seconds / YEAR).toFixed(1)} years`;
  if (s >= DAY) return `${(seconds / DAY).toFixed(s >= 10 * DAY ? 0 : 1)} days`;
  if (s >= 3600) return `${(seconds / 3600).toFixed(1)} h`;
  if (s >= 60) return `${(seconds / 60).toFixed(1)} min`;
  return `${seconds.toFixed(1)} s`;
}

/** Scientific notation with a real superscript exponent: 5.02 × 10⁶. */
export function sci(value: number, digits = 2): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) return value.toFixed(Math.max(0, digits - Math.max(exp, 0)));
  const sup = String(exp).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]!);
  return `${(value / 10 ** exp).toFixed(digits)} × 10${sup}`;
}
