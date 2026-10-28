# Decisions log

Decisions Claude made while building Phase 6 overnight (from 28 Oct 2026), for Luke to review.
Each one says what was decided, why, and how to undo it. Newest last.

## D1. Brief synced from the Claude Docs copy, keeping repo-only updates

The repo brief now carries the doc's new Visual upgrades, Pixel simulation engine and Phase 6
sections. It keeps the repo-only changes the doc copy lacks: the ticked Phase 1–5 boxes, the
150 KB JS budget (27 Oct sign-off), GitHub Pages hosting and the shading-ramp note. The engine
rule "doesn't count against the 100 KB budget" now reads "the pre-interaction JS budget" so it
doesn't contradict the 150 KB figure.

## D2. Leaderboard and K.A.R.L. LLM fallback moved to phase 7

The out-of-scope list called them "phase 6", which now means the pixel engine.

## D3. NDT inspection mode left out of this build

Luke asked to leave the NDT content as it is for now, and the mode needs inspection write-ups in
the manifest that don't exist yet. Its Phase 6 box stays unticked.

## D4. Stacked PRs, unmerged

Merging needs Luke's approval, so each feature is its own branch built on the previous one, with
its PR based on that branch. Merge them in order, oldest first; GitHub retargets the next PR to
`main` as each one merges.

## D5. Stellar ramp colours

`--color-star-0..5` = #e8452c, #ff8a3d, #ffd93d, #fff6e8, #bfd6ff, #7fa8ff, taken from the
Three-Body Pixel Lab preview. The yellow step is the gold token itself. It's ordered by
temperature, not brightness, so the brightness test only covers the five shading ramps; a
separate test checks the ramp gets bluer at every step. Retune by eye in Aseprite as with the
other ramps.

## D6. Engine physics: defaults and the Close pair preset

- Engine step dt = 1e-3 with Yoshida-4 (the TypeScript fallback keeps Verlet at 5e-4). Figure-8
  drift after 10⁵ steps is far under the 10⁻⁶ target. The unequal-mass orbit keeps its fine
  1e-5 step and no softening, as in TypeScript.
- The planet and supernova fragments are massless test particles: they feel the stars but never
  move them, so energy and momentum checks only cover the stars.
- The sixth preset, "Close pair", is a binary (1 and 0.8 at separation 0.3) with a 0.5 star on a
  circular orbit at 1.4. The Pixel Lab's version flung the outer star off screen within 3 time
  units, because it gave the outer star the full circular speed and the pair extra recoil; here
  the relative speed √(M/d) is split between them. It was added to the TypeScript presets too,
  so both solvers offer the same six and the parity fixture covers all of them.
- Parity: both solvers integrate every preset to t = 0.5 and must agree within 1e-4 in position
  (1e-3 in velocity). They use different integrators, so bit-for-bit equality isn't expected.

## D7. Engine look and lifecycle choices

- **Star kinds are visual.** Every preset shows a red dwarf, a yellow sun and a blue-white giant
  (Close pair: the giant and the dwarf form the binary and the distant Sun keeps the planet).
  The dynamics keep each preset's own masses, so equal-mass periodic orbits stay periodic.
- **Ageing is visitor-driven.** Nothing evolves on its own, so the background stays calm for
  recruiters. "Age a star" sends the shortest-lived star up the giant branch (the blue giant
  first, then the Sun; red dwarfs never age). The giant phase lasts 6 s, then the blue giant
  goes supernova and leaves a black hole, and the Sun puffs off shells and becomes a white
  dwarf. Remnants keep their dynamical mass, so the orbits survive.
- **Lifecycles survive an escape reload.** When a star leaves the screen the positions reset,
  as before, but a black hole stays a black hole. Picking a preset resets everything.
- **Luminosity from a table, not R²T⁴.** Pixel radii aren't physical radii, so the formula made
  the blue giant scorch the planet from across the system. The table gives the Sun 1, the blue
  giant 20, the red dwarf 0.02, giants up to 12× (Sun) or 4× (blue giant), and remnants about 0.
  The planet is scorched above 3× and frozen below 0.3× the Sun's light at its orbit.
- **Planet:** a massless test particle at 0.22 around the brightest living star (never the blue
  giant). It is lost if a star swallows it or it flies past r = 2.6, and respawns 4 s later. The
  civilisation counter runs only in the stable era; after 20 s the night side gets city lights.
- **Star shading uses only palette colours.** Each stellar class has five tones that darken
  toward cooler colours at the limb (StellarTones in engine/raster/palette.go); nothing is mixed
  with white or black, unlike the Pixel Lab preview.
- **Framebuffer size.** About 480×270 on desktops (the page's integer upscale), at most 160,000
  pixels, so tall phones get a portrait buffer instead of a cropped landscape one. Star radii are
  set for a 270 px high frame and scale with it.
- **Chaos ghost is a full copy of the system**, not a single test body, so it shows real
  sensitivity to initial conditions (a single massless body would just orbit star 1).
- **Kick** stays random by default but uses the engine's seeded PCG, so a seed reproduces a run.
- **Planet sprite** is drawn at radius 3.5 px rather than as a 32×32 sprite, which would dwarf
  the 5 px stars at this resolution.
- **Black hole sheet:** 16 frames of 34×20, baked by `cmd/bake` into
  `engine/raster/blackhole_gen.go` (and `public/sprites/blackhole-16.png` as a preview). CI
  re-runs the bake and fails if the committed output differs.
- **Build:** TinyGo `-target wasm-unknown -opt=z -gc=leaking -panic=trap`. Nothing allocates
  after start-up (tested), so the leaking GC is safe. Result: about 24 KB gzipped. CI checks the
  60 KB budget and that the WebAssembly and native builds draw byte-identical frames.
