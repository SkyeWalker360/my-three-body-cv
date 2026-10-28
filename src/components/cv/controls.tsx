'use client';

/**
 * Small client islands that only send events. Each renders as a plain button in the static
 * HTML and does nothing until JavaScript loads.
 */
import { useEffect, useState } from 'react';
import { emit, on, type Telemetry } from '@/lib/events';

export function KarlButton({
  command,
  className,
  children,
}: {
  command?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => emit('karl:open', { command })}
    >
      {children}
    </button>
  );
}

/** Opens the field scanner (Design Brief, Field Scanner). Inert until JavaScript loads. */
export function ScannerButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => emit('scanner:open')}
    >
      {children}
    </button>
  );
}

export function InspectionToggle() {
  const [active, setActive] = useState(false);
  useEffect(() => on('inspection:mode', ({ on: value }) => setActive(value)), []);
  return (
    <button
      type="button"
      className="btn btn-gold"
      aria-pressed={active}
      onClick={() => emit('inspection:toggle')}
    >
      {active ? 'END INSPECTION (M)' : 'INSPECT THE WELDS (M)'}
    </button>
  );
}

export function ShooterLauncher() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const offs = [
      on('shooter:start', () => setActive(true)),
      on('shooter:end', () => setActive(false)),
    ];
    return () => offs.forEach((o) => o());
  }, []);
  return (
    <button
      id="shooter-launch"
      type="button"
      className="btn btn-red pixel-border [--pixel-border:var(--color-red)]"
      disabled={active}
      onClick={() => emit('shooter:launch')}
    >
      {active ? 'WEAPONS ENGAGED' : '⚡ ENGAGE WEAPONS: DESTROY THIS CV'}
    </button>
  );
}

export function useTelemetry(): Telemetry | null {
  const [t, setT] = useState<Telemetry | null>(null);
  useEffect(() => on('threebody:telemetry', setT), []);
  return t;
}

/** Header controls: cycle presets and KICK. */
export function PresetControls({ firstPreset }: { firstPreset: string }) {
  const t = useTelemetry();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => emit('threebody:preset', {})}
        title={`Next three-body preset (current: ${t?.preset.name ?? firstPreset})`}
      >
        3-BODY: <span className="text-gold">{t?.preset.short ?? 'FIG-8'}</span>
      </button>
      <button type="button" className="btn btn-violet" onClick={() => emit('threebody:kick')}>
        KICK
      </button>
    </div>
  );
}

const fmt = (v: number | undefined, digits = 4) => (v === undefined ? '—' : v.toFixed(digits));
const sci = (v: number | null | undefined) =>
  v === undefined || v === null ? '—' : v === 0 ? '0' : v.toExponential(2);

/** Which lab is running, once the background has loaded. */
function useEngine(): 'wasm' | 'typescript' | null {
  const [engine, setEngine] = useState<'wasm' | 'typescript' | null>(null);
  useEffect(() => on('threebody:ready', (d) => setEngine(d.engine)), []);
  return engine;
}

/** The latest engine event, for a polite live region. */
function useLabEvent(): string {
  const [message, setMessage] = useState('');
  useEffect(() => on('threebody:event', (d) => setMessage(d.message)), []);
  return message;
}

const kelvin = (k: number) => (k > 0 ? `${Math.round(k / 100) * 100} K` : '—');

/** Lab panel: preset buttons, KICK, Shadow toggle, Age a star and live telemetry. */
export function LabControls({ presets }: { presets: { name: string; short: string }[] }) {
  const t = useTelemetry();
  const engine = useEngine();
  const event = useLabEvent();
  const [shadow, setShadow] = useState(false);
  const extras = t?.engine;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Three-body presets">
        {presets.map((p, index) => (
          <button
            key={p.short}
            type="button"
            className="btn btn-ghost"
            aria-pressed={(t?.preset.index ?? 0) === index}
            onClick={() => emit('threebody:preset', { index })}
          >
            {p.name.toUpperCase()}
          </button>
        ))}
        <button type="button" className="btn btn-violet" onClick={() => emit('threebody:kick')}>
          KICK Δv
        </button>
        <button
          type="button"
          className="btn btn-violet"
          aria-pressed={shadow}
          onClick={() => {
            emit('threebody:shadow', { on: !shadow });
            setShadow(!shadow);
          }}
        >
          SHADOW {shadow ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          className="btn btn-red"
          disabled={engine !== 'wasm'}
          title={
            engine === 'wasm'
              ? 'Send the shortest-lived star up the giant branch'
              : 'Star lifecycles need the WebAssembly engine'
          }
          onClick={() => emit('threebody:age')}
        >
          AGE A STAR
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border border-violet/40 bg-void p-4 font-terminal text-lg sm:grid-cols-5">
        <div>
          <dt className="text-ink-muted">Kinetic K</dt>
          <dd className="text-gold">{fmt(t?.kinetic)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Potential U</dt>
          <dd className="text-gold">{fmt(t?.potential)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Total E</dt>
          <dd className="text-green">{fmt(t?.total)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">|ΔE / E₀|</dt>
          <dd className="text-cyan">{sci(t?.drift)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Shadow δ(t)</dt>
          <dd className="text-violet-ink">{shadow ? sci(t?.divergence) : 'off'}</dd>
        </div>
      </dl>
      {extras && (
        <dl className="grid gap-x-4 gap-y-1 border border-violet/40 bg-void p-4 font-terminal text-lg sm:grid-cols-2">
          {extras.stars.map((s, i) => (
            <div key={i} className="flex flex-wrap gap-x-2">
              <dt className="text-ink-muted">Star {i + 1}</dt>
              <dd>
                {s.kind} · <span className="text-gold">{s.phase}</span> · {kelvin(s.temperature)}
              </dd>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-muted">Planet</dt>
            <dd>
              <span className={extras.era === 'Stable' ? 'text-green' : 'text-red'}>
                {extras.era}
              </span>{' '}
              · civilisation {Math.floor(extras.civilisation)} s
              {extras.lights ? ' · city lights' : ''}
            </dd>
          </div>
        </dl>
      )}
      <p className="min-h-7 font-terminal text-lg text-cyan" aria-live="polite">
        {event}
      </p>
      <p className="text-xs text-ink-muted">
        {engine === 'wasm'
          ? 'Running the Go engine (TinyGo → WebAssembly) in a worker.'
          : engine === 'typescript'
            ? 'Running the TypeScript solver (the WebAssembly engine did not load).'
            : 'The simulation starts once the page is idle.'}
      </p>
    </div>
  );
}
