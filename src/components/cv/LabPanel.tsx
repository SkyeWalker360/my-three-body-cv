import { PRESETS } from '@/features/three-body/presets';
import { G, SOFTENING } from '@/features/three-body/solver';
import { DeckButton, LabControls } from './controls';

export function LabPanel() {
  return (
    <section
      aria-labelledby="lab-title"
      className="glass scroll-mt-24 space-y-4 border border-violet/60 p-6"
    >
      <header className="space-y-2">
        <p className="font-terminal text-lg text-ink-muted">EASTER EGG #1</p>
        <h2
          id="lab-title"
          className="font-pixel text-sm leading-relaxed text-violet-ink sm:text-base"
        >
          THREE-BODY LABORATORY
        </h2>
      </header>
      <p className="max-w-3xl text-sm leading-relaxed">
        The background is a live simulation of three stars under Newtonian gravity (G = {G},
        softening ε = {SOFTENING}). A small engine written in Go and compiled to WebAssembly
        integrates it with a 4th-order Yoshida symplectic step and draws every frame in palette
        colours at about 480×270. Symplectic means energy wobbles inside a tight band instead of
        drifting away, so periodic orbits like the figure-8 hold their shape. If WebAssembly
        isn&apos;t available, a TypeScript velocity Verlet solver takes over.
      </p>
      <p className="max-w-3xl text-sm leading-relaxed">
        Each star&apos;s colour comes from its temperature. Turn on Shadow to run a copy nudged by
        10⁻⁷ and watch chaos pull the two apart. Age a star to send it up the giant branch: the
        blue-white giant ends in a supernova and a black hole, and the planet&apos;s climate follows
        the light it receives.
      </p>
      <p className="max-w-3xl text-sm leading-relaxed">
        Or step inside: the observation deck puts you on a platform in the system and shows each
        star at its true distance, brightness and colour, with your eyes adjusting to the glare.
      </p>
      <DeckButton />
      <LabControls presets={PRESETS.map((p) => ({ name: p.name, short: p.short }))} />
    </section>
  );
}
