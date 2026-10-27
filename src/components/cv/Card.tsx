import type { Sector } from '@/lib/schema';

const ACCENT: Record<Sector, string> = {
  dev: 'border-cyan/40 [--pixel-border:var(--color-cyan)]',
  ndt: 'border-gold/40 [--pixel-border:var(--color-gold)]',
  edu: 'border-violet/60 [--pixel-border:var(--color-violet)]',
  other: 'border-ink-muted/40 [--pixel-border:var(--color-ink-muted)]',
};

/**
 * A CV card. `data-destructible` marks it for the shooter, `data-sector` drives the filters,
 * `data-id` links it to its manifest entry (HP and fragment labels).
 */
export function Card({
  id,
  label,
  sector,
  className = '',
  children,
}: {
  id: string;
  label: string;
  sector: Sector;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      data-destructible
      data-id={id}
      data-label={label}
      data-sector={sector}
      className={`glass pixel-border border p-6 ${ACCENT[sector]} ${className}`}
    >
      {children}
    </article>
  );
}

export function Badge({
  children,
  tone = 'cyan',
}: {
  children: React.ReactNode;
  tone?: 'cyan' | 'gold' | 'violet' | 'green';
}) {
  const tones = {
    cyan: 'border-cyan/50 text-cyan',
    gold: 'border-gold/50 text-gold',
    violet: 'border-violet text-violet-ink',
    green: 'border-green/50 text-green',
  };
  return (
    <span
      className={`inline-block border px-2 py-1 font-pixel text-xs leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  id,
  kicker,
  children,
}: {
  id: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <header className="mb-6 space-y-2">
      <p className="font-terminal text-lg text-ink-muted">{kicker}</p>
      <h2 id={id} className="font-pixel text-base text-gold sm:text-lg">
        {children}
      </h2>
    </header>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-6 text-sm leading-relaxed marker:text-cyan">
      {items.map((h) => (
        <li key={h}>{h}</li>
      ))}
    </ul>
  );
}
