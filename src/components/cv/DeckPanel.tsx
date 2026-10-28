import { DeckButton } from './controls';

/**
 * Easter egg #1: the observation deck. It replaced the Three-Body Lab section; every Lab
 * control now lives on the deck's console, and K.A.R.L.'s /lab opens its plain lab view.
 */
export function DeckPanel() {
  return (
    <section
      aria-labelledby="deck-panel-title"
      className="glass scroll-mt-24 space-y-4 border border-violet/60 p-6"
    >
      <header className="space-y-2">
        <p className="font-terminal text-lg text-ink-muted">EASTER EGG #1</p>
        <h2
          id="deck-panel-title"
          className="font-pixel text-sm leading-relaxed text-violet-ink sm:text-base"
        >
          OBSERVATION DECK
        </h2>
      </header>
      <p className="max-w-3xl text-sm leading-relaxed">
        The background is a live simulation of three stars under Newtonian gravity. A small engine
        written in Go and compiled to WebAssembly integrates it with a 4th-order Yoshida symplectic
        step, so energy wobbles inside a tight band instead of drifting away and periodic orbits
        like the figure-8 hold their shape.
      </p>
      <p className="max-w-3xl text-sm leading-relaxed">
        Step inside and watch from a platform in the system. Each star appears at its true distance,
        brightness and colour, with your eyes adjusting to the glare; planets show phases lit by
        more than one sun; and if you age the blue-white giant into a black hole you can ride beside
        it and see the sky bend around its shadow. The console has body cards, a spectrograph,
        overlays, time controls and the old lab&apos;s telemetry.
      </p>
      <DeckButton />
    </section>
  );
}
