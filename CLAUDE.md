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

## Pixel art

- **Shading ramps:** sprites, planets and dithered canvases shade with the six-step ramps in
  `globals.css` (`--color-{void,cyan,gold,red,violet}-{0..5}`), read on canvases with
  `readRamp()` from `src/lib/palette.ts`. Don't lighten or darken a colour by mixing in white or
  black, and don't interpolate between steps: pick a step, and dither between neighbouring
  steps with `bayer8()` from `src/lib/dither.ts`. Ramp steps are for art; text uses the
  contrast-checked base tokens. Stars take their colour from the stellar ramp
  (`--color-star-{0..5}`, cool → hot), snapped from their temperature.
- **Changing a ramp** means editing `globals.css`, then `pnpm palette` to regenerate
  `design/three-body-cv.gpl` (Luke's Aseprite palette). A unit test fails if they drift.
- **Sprites** are drawn by Luke in Aseprite with that palette, exported as PNG to
  `public/sprites/` at their native size, and scaled only by whole numbers with the
  `pixelated` utility. Never redraw, upscale or recolour a sprite in code.
- **Planets and other procedural art** render on Canvas 2D at their native pixel size (for
  example 64 × 64) and are scaled up with `pixelated`, like `CoreGauge`. WebGL and Three.js
  are out of scope (Design Brief). The pixel maths (UV snapping, sphere mapping, noise,
  lighting, dithering) is a pure function with unit tests, per the pure-cores rule.
- **No smooth gradients** on art or panels. Borders use the `pixel-border` utility.

## Checking visual changes

`.mcp.json` gives you a Playwright MCP server (headless Firefox, 1280 × 720). For any change
that affects what the page looks like:

1. Start the dev server (`pnpm dev`) if it isn't running.
2. Open `http://localhost:3000`, take a screenshot, and look at the area you changed.
3. Check for overlapping or clipped text, off-palette colours, blurred pixel art, and layout
   breaks. Resize to 390 × 844 and check again: the site has a mobile layout.
4. Fix what you find and repeat, then say in your summary what you checked.

The screenshot is a check, not a proof: `pnpm test:e2e` (Playwright + axe) stays the gate
for accessibility and contrast. PRs that change visuals include screenshots (Design Brief).

## Commands

```sh
pnpm install
pnpm dev          # validates the manifest, compiles ink, builds public/cv.pdf, starts Next
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # static export to out/
pnpm test:e2e     # Playwright + axe against out/ (run pnpm build first)
pnpm palette      # regenerate design/three-body-cv.gpl after editing a ramp
```

Commits use Conventional Commits (`feat(three-body): …`); one phase or feature per PR.
