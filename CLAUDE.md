# My Three Body CV — rules for Claude Code

Read `docs/My Three Body CV — Design Brief.md` before changing anything; it's the spec.
`docs/My Three Body CV — Project Report.md` reviews the prototype. `reference/prototype.html`
is the visual reference only: never import from it.

## Hard rules

- **Content:** every career fact comes from `content/cv-manifest.json`. Never invent or reword
  CV facts in components, K.A.R.L. replies, ink scripts or game code. If a fact is missing, ask
  Luke. No phone number or street address anywhere (the schema rejects them).
- **The CV reads without JavaScript.** Nothing about the CV lives only on a canvas.
- **Colours** come from the `@theme` tokens in `src/app/globals.css` (canvases read them via
  `src/lib/palette.ts`). No other hex values, except `opengraph-image.tsx` and `icon.svg`,
  which can't read CSS and mirror the tokens.
- **Type:** Press Start 2P ≥ 12 px for headings, buttons and badges only; VT323 ≥ 18 px for
  terminal and HUD; Space Mono for body copy.
- **Motion:** honour `prefers-reduced-motion`. Animation loops use `animationLoop` from
  `src/lib/motion.ts` (pauses on `visibilitychange`). No `setInterval` animations.
- **Features don't import each other.** They talk through the typed event bus in
  `src/lib/events.ts`. Shared code goes in `src/lib/`. (K.A.R.L. lazily imports the Noctus
  runner because the RPG runs inside its log.)
- **Pure cores:** physics, intents, dice, scanner timing and shooter rules take no DOM inputs
  and have unit tests in `tests/unit/`.
- **Easter eggs load lazily** through `src/components/EasterEggs.tsx` (`next/dynamic`,
  `ssr: false`) on idle or first use.
- Noctus Umbra `.ink` files are drafts: Luke writes or approves the prose. Claude only does
  structure and DC mechanics.

## Commands

```sh
pnpm install
pnpm dev          # validates the manifest, compiles ink, builds public/cv.pdf, starts Next
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # static export to out/
pnpm test:e2e     # Playwright + axe against out/ (run pnpm build first)
```

Commits use Conventional Commits (`feat(three-body): …`); one phase or feature per PR.
