import { PRESETS } from '@/features/three-body/presets';
import { DT, G, SOFTENING } from '@/features/three-body/solver';
import { LabControls } from './controls';

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
        softening ε = {SOFTENING}), integrated with velocity Verlet at a fixed step of dt = {DT}.
        Verlet is symplectic: energy wobbles inside a tight band instead of drifting away, so
        periodic orbits like the figure-8 hold their shape. Turn on Shadow to run a copy nudged by
        10⁻⁷ and watch chaos pull the two apart.
      </p>
      <LabControls presets={PRESETS.map((p) => ({ name: p.name, short: p.short }))} />
    </section>
  );
}
