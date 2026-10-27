import type { CvManifest } from '@/lib/schema';
import { ContactLinks } from './Contact';
import { ShooterLauncher } from './controls';

export function Footer({ person }: { person: CvManifest['person'] }) {
  return (
    <footer className="relative z-10 mt-24 border-t border-cyan/30 bg-void/90 px-4 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <h2 className="font-pixel text-xs text-cyan">GET IN TOUCH</h2>
          <ContactLinks person={person} compact />
        </div>
        <div className="space-y-4">
          <p className="font-terminal text-lg text-ink-muted">EASTER EGG #3: FOOTER ARCADE</p>
          <ShooterLauncher />
          <p className="max-w-md text-sm text-ink-muted">
            Turns the CV on screen into asteroids. Clear them to meet The Architect.
            <br />
            <kbd>W A S D</kbd> or arrow keys to fly · <kbd>Space</kbd> to fire · <kbd>Esc</kbd> to
            quit. Keyboard required.
          </p>
        </div>
        <p className="font-terminal text-lg text-ink-muted">
          © {new Date().getFullYear()} {person.name}
        </p>
      </div>
    </footer>
  );
}
