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

export function DeckButton() {
  return (
    <button
      type="button"
      className="btn btn-violet"
      aria-haspopup="dialog"
      onClick={() => emit('deck:open', {})}
    >
      ENTER THE OBSERVATION DECK
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
