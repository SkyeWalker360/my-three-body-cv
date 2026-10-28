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
its PR based on that branch. GitHub only retargets a stacked PR to `main` when its base branch
is deleted on merge, which this repo doesn't do, so #3–#6 merged into each other rather than
`main`. PR #7 brings the whole stack into `main` in one merge. Next time: turn on "Automatically
delete head branches", or merge the top PR straight into `main`.

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

## D8. Putting the engine on the site

- **When the WASM loads.** The background is the lab, so "loads only when a visitor opens the
  lab" became: the worker fetches `engine.wasm` after the page goes idle, together with the rest
  of the background. It's off the main thread and outside the pre-interaction JS budget either
  way. If WebAssembly or the file is missing, the TypeScript solver runs instead, and the lab
  panel says which one is running.
- **"Age a star"** is a new button in the lab panel (disabled on the TypeScript fallback, which
  has no lifecycles). Engine events appear in a polite live region under the readouts, and a
  second readout row shows each star's kind, phase and temperature, plus the planet's era,
  civilisation time and city lights.
- **Scanner.** Any star going critical (giant branch or supernova) turns K.A.R.L.'s scanner
  amber and speeds its sweep from 1 s to 0.45 s. It listens to `core:critical` for an instant
  switch and to telemetry so a terminal opened mid-event shows the right colour. The `/karr`
  toggle still works.
- **Core gauge.** It keeps the polytrope core, now with a white centre inside two hexagonal
  containment rings. The pulse speeds up and deepens as the blue giant (K.A.R.L.'s host star)
  climbs the giant branch, and the rings glow gold while critical.
- **Shareable runs.** `?seed=N` in the URL replays a run; the default seed is 318.
- **Lab panel copy** now describes the Go engine and Yoshida integrator. It's site copy, not a
  CV fact, and the engine stays out of the manifest and CV until Luke adds it in his own words.

## Phase 6 status

Done: TinyGo build under budget with the CI check, go test (drift, momentum, byte-identical
frames), Go/TypeScript parity, the worker with fallback (about 0.1 ms per frame in Node,
against a 4 ms budget), stellar ramp and dithered sprites with no off-palette pixels, the black
hole baked by `cmd/bake`, and the supernova turning the scanner amber.

Not done: NDT inspection mode (D3).

## D9. Field scanner for phones (Phase 7, from 28 Oct 2026)

Luke found that the site loses its charm on mobile and asked for a handheld-encyclopedia style
CV. Decisions, for review:

- **A dialog, not a mobile layout.** The HTML CV stays the page at every width, so goal 1 (one
  screen to contact and PDF) and the no-JS rule hold. The scanner opens from a hero button and
  never by itself. Undo: delete `src/features/field-scanner/` and the hero button.
- **Our own device.** It borrows the interaction pattern only. Nintendo's Pokédex name, shell,
  lens and sprites stay out, because a hiring manager reads borrowed IP badly.
- **Specimens are manifest entries.** Certifications split into one specimen per level so MT 1 →
  MT 2 reads as an evolution chain. Skills are one specimen per category, since the manifest has
  no per-skill text. No stat bars: there are no proficiency figures to show.
- **The prototype artifact is not the source.** The claude.ai prototype invented per-skill
  copy and had Hollowbrand entries; neither carried over. Hollowbrand waits for Luke's lines.
- **Leaderboard and LLM fallback move to phase 8.**
- **`larsonLevels` moved to `src/lib/larson.ts`** so K.A.R.L. and the scanner share it without
  importing each other. `features/karl/scanner.ts` re-exports it, so its tests are unchanged.
- **A header SCAN button on phones.** On a phone the hero button sits below the long summary,
  so `md:hidden` SCAN sits beside K.A.R.L. in the header. Below 24 rem the header name becomes
  screen-reader-only so both fit at 360 px. Checked: no overflow at 360 and 390 px, axe clean.
- **Checked locally:** lint, typecheck, unit tests, a static build (scanner chunk 12.3 KB
  gzipped), and Playwright on desktop and mobile. The Go engine e2e test needs `engine.wasm`
  from TinyGo, which CI builds; it was the only failure.
