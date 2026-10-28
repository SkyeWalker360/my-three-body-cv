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
the manifest that don't exist yet. Its Phase 6 box stays unticked. (Superseded by D10.)

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

NDT inspection mode followed later (D10), so every Phase 6 box is now ticked.

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

## D10. NDT inspection mode, built from the existing manifest (28 Oct 2026)

Luke asked for the brief to be finished, and still wants the NDT content left as it is, so the
mode was built without adding or changing any CV text.

- **Write-ups are the card's own manifest text.** There are no separate inspection write-ups in
  the manifest yet, so each indication opens a slice of its card's entry, verbatim: the summary
  and role highlights (GEN318, each role kept under its title), the highlights (Lead Life, the
  homelab), the levels (NDT certificate) and the qualifications or subjects (education). A
  card's text is split, in order, into at most three indications. A unit test checks every
  line exists in the manifest. When Luke writes real inspection or engineering case studies,
  `sectionsFor()` in `src/features/inspection/writeups.ts` is the one place to point at them.
- **Defects live in the 4 px `pixel-border` band**, outside the card, so they can't cover text.
  The crack is cut into the border (`void-0`) with a `gold-3` core and `gold-1` glow cells, so
  it reads on cyan, gold and violet cards alike. A card turns its cracks `green` once every
  indication on it has been opened ("passed"). Shapes are seeded by card id, so they're stable.
- **Hit targets** are 24 px thick (WCAG 2.2 target size), centred on the band: at most 10 px
  reach inside the card, inside its 24 px padding. An e2e test checks no target overlaps text.
- **Particles** start outside the card and drift onto the crack in one `animationLoop` that
  stops once they land. With reduced motion there are no particles, only dashed static outlines.
- **Probe.** While the mode is on, the ship cursor draws a small magnetic yoke instead of the
  ship. On touch devices there's no cursor, so this is desktop-only like the ship.
- **Switching it on.** M anywhere (not while typing or with a dialog open), or the new footer
  button "INSPECT THE WELDS (M)" (Easter egg #4), which also makes it reachable on phones. M
  or Escape switches it off; the shooter switches it off when it starts. When it comes on, the
  first indication on screen takes focus so Tab walks through them.
- **Cost.** The feature is its own lazy chunk (about 7 KB gzipped, including the manifest copy),
  loaded on the first toggle. Cards gained `relative` so the overlay can anchor to them.
- **Visibility (follow-up).** The first version was too subtle to notice: cracks are now two
  rows thick with a dithered `gold-1` bloom up to 3 px outside the band (away from the text),
  and a toast ("INSPECTING · N FOUND · M TO EXIT") shows for 3 s when the mode comes on, then
  hides so it never sits over CV text.

## D11. Observation Deck, Phase 1 (28 Oct 2026)

Built from `docs/Observation Deck — Viewing Platform Brief.md`. Luke took every recommendation
in §9: calm default above the plane, large window with a thin frame, K.A.R.L. narrates only when
asked, compact labelled scale.

- **Where it lives.** A full-screen modal dialog opened from the lab panel ("ENTER THE
  OBSERVATION DECK"), lazily loaded like the other eggs. The live background stays behind the CV
  (Design Brief layer 1). The deck's code sits inside the three-body feature
  (`src/features/three-body/deck/`) because it replaces the Lab, which lets it reuse the engine
  loader without one feature importing another.
- **Its own engine.** The deck instantiates `engine.wasm` a second time, so pausing or warping
  the deck never touches the background. The engine gained a bodies buffer (position, velocity,
  mass, kind, luminosity per body; `bodiesPtr()`, `StateBodies`), mirrored and tested in
  `engine-layout.ts` like the other offsets. The WASM build stays 24 KB gzipped.
- **Platform physics in TypeScript, not Go.** The engine is planar; the platform needs height
  above the plane. It's a massless test particle (so energy telemetry stays exact) integrated
  with leapfrog against the stars' positions each frame, with a capped station-keeping thrust.
  Tests cover free-fall energy, holding a station, and failing to hover where gravity beats the
  cap.
- **Compact scale = the lab's sizes.** Bodies are drawn at the radius the engine draws them
  (engine pixels ÷ 67.5 px/AU), so the deck agrees with the lab's collisions and engulfments.
  Distances are true AU. The console says so, and shows each body's true angular size and the
  magnification ("drawn ×1218" for the planet). True radii: red dwarf 0.3, Sun 1, blue-white
  giant 7 solar radii; giants grow to ~100 solar radii via a power of the engine's pixel growth;
  white dwarf 0.012 solar radii; black hole at its Schwarzschild radius.
- **Brightness and exposure.** Radiance = (L / d²) over the disc's solid angle (or one pixel for
  a point). Exposure targets the brightest thing in view, adapting faster to glare (0.12 s) than
  to dark (0.6 s); reduced motion adapts instantly. A logarithmic tone curve spans 3.5 decades,
  so a red dwarf beside the blue giant still shows, dimly. Exposure is capped so that an empty
  sky's brightest star (mag −1.5) is white; consequence: with any of the system's stars in view
  the Milky Way and background stars drop out, as they do in real photos. They reappear when you
  look away.
- **Rendering.** Canvas 2D, 320 px wide buffer, integer upscale, the engine's palette and colour
  table. Stars use a TypeScript mirror of the engine's `StellarTones` (unit-tested against
  `palette.go`) with linear limb darkening; overexposed cores go to the white step. Planets are
  lit per pixel by every star (Lambert, weighted by flux), which already gives multi-star phases.
  The black hole is drawn as its shadow and a cyan/red photon ring; lensing is Phase 2.
- **Interior** is placeholder art built from palette steps in code (frame, scanner bar using the
  shared `larsonLevels`, console LEDs, two seat backs), lit by the starlight reaching the deck and
  rim-tinted by the strongest star's class. It's meant to be replaced by Luke's Aseprite frame.
- **Cost.** About 0.9 ms per frame at 320×180 and 1.7 ms for a tall phone buffer (Node), inside
  the 4 ms budget.
- **Vantages in Phase 1:** above the plane (2.6 AU, so the ±1.9 AU escape circle fits the 100°
  window), barycentre (0.35 AU above it) and free look (holds where it was chosen). Switching is
  a jump for now; guided transits and the other vantages are Phase 4.

## D12. Observation Deck, Phase 2: the realism layer (28 Oct 2026)

- **Planet phases** were already physical in Phase 1 (each pixel's normal against every star,
  weighted by flux). Phase 2 adds shadowing: a star's light on the planet is scaled by how much
  of that star the planet itself can see, so another body crossing a star eclipses it.
- **Eclipses and deck light.** Angular disc overlap (exact circle-intersection area) gives the
  fraction of each star visible past nearer bodies, using the drawn sizes so light matches the
  picture. The deck's interior is lit by the sum of visible flux, so it dims during an eclipse;
  the console names the eclipse and the deck light level. The glass gains dust specks that only
  show in strong light, with half the frame's parallax.
- **Black-hole vantage.** Offered only once a star has collapsed. The platform rides 12 r_s from
  the hole, outside the photon sphere (1.5 r_s). No capped thrust could hover there and the real
  orbit would take milliseconds, so this is an explicit exception to the test-particle rule:
  the platform is carried with the hole and its orbit is ignored.
- **Lensing** is physical, not a stand-in: rays with impact parameter below b_c = 3√3/2 r_s are
  captured (the shadow, about 12° across from 12 r_s); others are bent by 2r_s/b plus the
  second-order term, or near the photon sphere by the strong-field log term (Bozza 2002). The
  starfield is a cubemap of fluxes sampled where each ray really comes from, so stars behind the
  hole appear as arcs. The photon ring is drawn cyan on the approaching side and red on the
  receding side. Bodies aren't lensed (they're far from the line of sight in practice), and the
  pass switches off beyond 5,000 r_s, where the bend is far below a pixel. The lab-scale hole
  is drawn as before from further away.
- **Blueshift** of 1/√(1 − r_s/r) (+4.4% at 12 r_s) moves star and sky colours up the stellar
  ramp (about one step per 4%) and brightens starlight by the fourth power. The console shows it.
- **Cost.** Steady state next to the hole is about 1 ms per frame: the per-pixel lensing result
  is cached while the view geometry is unchanged and recomputed (about 3.5 ms, rays traced on a
  half-resolution grid and interpolated where the bend is smooth) only when the visitor looks
  around or zooms. Rewriting the frame's interior pass to touch only the frame took the normal
  vantages from 0.9 to 0.25 ms per frame (plain Node, 320×180).
- **Age a star** moved into the deck's console, as the brief moves every Lab control there.
