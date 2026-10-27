import type { CvManifest } from '@/lib/schema';
import { PRESETS } from '@/features/three-body/presets';
import { KarlButton, PresetControls } from './controls';

export function Header({ person }: { person: CvManifest['person'] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-cyan/30 bg-void/80 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a href="#top" className="flex min-w-0 items-center gap-3 text-ink no-underline">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center bg-cyan font-pixel text-xs text-void shadow-[4px_4px_0_0_var(--color-gold)]"
          >
            LG
          </span>
          <span className="min-w-0">
            <span className="block font-pixel text-xs text-cyan">{person.name.toUpperCase()}</span>
            <span className="hidden truncate font-terminal text-lg text-ink-muted lg:block">
              {person.title}
            </span>
          </span>
        </a>
        <nav aria-label="Ship controls" className="flex items-center gap-2">
          <KarlButton className="btn btn-red">
            <span aria-hidden="true" className="size-2 animate-pulse bg-red" />
            K.A.R.L.
          </KarlButton>
          <div className="hidden md:block">
            <PresetControls firstPreset={PRESETS[0]!.name} />
          </div>
        </nav>
      </div>
    </header>
  );
}
