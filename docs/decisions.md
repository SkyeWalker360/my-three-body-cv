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
