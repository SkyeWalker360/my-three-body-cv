'use client';

import { useState } from 'react';

const FILTERS = [
  { value: 'all', label: 'ALL' },
  { value: 'dev', label: 'SOFTWARE' },
  { value: 'ndt', label: 'NDT' },
  { value: 'edu', label: 'EDUCATION' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

/**
 * Wraps the CV sections. Filtering only sets an attribute; CSS hides the other sectors,
 * so every card stays in the HTML for crawlers and no-JS readers.
 */
export function Filters({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<Filter>('all');
  return (
    <div data-filter={filter}>
      <div
        className="mb-8 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter CV by sector"
      >
        <span className="font-terminal text-lg text-ink-muted">FILTER:</span>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="btn btn-ghost"
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-16">{children}</div>
    </div>
  );
}
