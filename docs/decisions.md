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
