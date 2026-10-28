/**
 * Typed CustomEvent bus. Features talk to each other only through these events,
 * so no feature imports another.
 */
export type PresetSummary = { index: number; name: string; short: string };

export type StarSummary = { kind: string; phase: string; temperature: number };

/** Extra readouts only the Go/WASM engine provides. */
export type EngineTelemetry = {
  stars: StarSummary[];
  era: string;
  civilisation: number;
  lights: boolean;
  critical: boolean;
  /** Index of K.A.R.L.'s host star (the blue-white giant) in `stars`. */
  host: number;
  hostProgress: number;
};

export type Telemetry = {
  kinetic: number;
  potential: number;
  total: number;
  drift: number;
  divergence: number | null;
  preset: PresetSummary;
  /** Present when the WASM engine is running; absent on the TypeScript fallback. */
  engine?: EngineTelemetry;
};

export type LabEventKind =
  'collision' | 'supernova' | 'engulfment' | 'ejection' | 'giant' | 'remnant' | 'electrical';

export type EventMap = {
  'karl:open': { command?: string };
  'karl:opened': undefined;
  'karl:closed': undefined;
  'scanner:open': undefined;
  'scanner:opened': undefined;
  'scanner:closed': undefined;
  /** A request from the footer button; the shooter answers with shooter:start once running. */
  'shooter:launch': undefined;
  'shooter:start': undefined;
  'shooter:end': { score: number; outcome: 'victory' | 'defeat' | 'quit' };
  'motion:reduced': { reduced: boolean };
  'threebody:preset': { index?: number };
  'threebody:kick': undefined;
  'threebody:shadow': { on: boolean };
  'threebody:telemetry': Telemetry;
  'threebody:ready': { presets: PresetSummary[]; engine: 'wasm' | 'typescript' };
  'threebody:age': undefined;
  'threebody:event': { kind: LabEventKind; message: string };
  /** M or the footer button; the first one mounts inspection mode, which then listens itself. */
  'inspection:toggle': undefined;
  'inspection:mode': { on: boolean };
  /** K.A.R.L.'s host star is critical (giant branch or supernova): the scanner turns amber. */
  'core:critical': { critical: boolean };
};

export type EventName = keyof EventMap;

const PREFIX = 'mtbcv:';

export function emit<K extends EventName>(
  name: K,
  ...detail: EventMap[K] extends undefined ? [] : [EventMap[K]]
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PREFIX + name, { detail: detail[0] }));
}

export function on<K extends EventName>(
  name: K,
  handler: (detail: EventMap[K]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail);
  window.addEventListener(PREFIX + name, listener);
  return () => window.removeEventListener(PREFIX + name, listener);
}
