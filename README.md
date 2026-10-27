# My Three Body CV

Luke Gorry's CV as a 16-bit space site: a plain, recruiter-first CV in static HTML, with
three Easter eggs layered around it.

- **Three-body laboratory:** the background is a live velocity Verlet simulation of three
  stars, with five presets, KICK, and a "shadow" copy that shows chaos in action. It runs in a
  Web Worker on an OffscreenCanvas.
- **Spaceship cursor:** a 16-direction pixel ship with a pooled particle exhaust (only with a
  mouse and without reduced motion).
- **K.A.R.L.:** a terminal co-pilot in a native `<dialog>` that answers from the CV manifest,
  with a Larson scanner and a dithered Lane–Emden core gauge. `/noctus` starts the Noctus
  Umbra RPG (inkjs, real DC checks, save and continue).
- **Footer shooter:** ENGAGE WEAPONS turns the CV blocks on screen into asteroids. Clear them
  to fight The Architect, a three-phase boss.

## Stack

Next.js (App Router, static export), React 19, TypeScript strict, Tailwind CSS v4, XState,
inkjs, Zod, Vitest, Playwright + axe, pnpm. See `CLAUDE.md` for the rules and
`docs/` for the design brief and prototype review.

## Develop

Needs Node 20.9+ and pnpm.

```sh
pnpm install
pnpm dev
```

`pnpm dev` and `pnpm build` first run `pnpm content`, which:

1. validates `content/cv-manifest.json` against the Zod schema (the build fails on bad data),
2. compiles `content/noctus/act-*.ink` to `public/noctus/*.json`,
3. generates `public/cv.pdf` from the manifest (web version: no phone or street address).

## Content

All CV facts live in `content/cv-manifest.json`, transcribed from `Luke_Gorry_CV_2026`.
Change the CV there (and in the Word CV) and the page, K.A.R.L., the shooter and the PDF all
follow.

## Deploy

CI (`.github/workflows/ci.yml`) runs lint, format, typecheck, unit tests, build and the
Playwright smoke tests, then deploys `out/` to GitHub Pages from `main`
(skyewalker360.github.io/my-three-body-cv). In the repo settings, set Pages to deploy from
GitHub Actions. For a custom domain later, change `NEXT_PUBLIC_BASE_PATH` and
`NEXT_PUBLIC_SITE_URL` in the workflow.

On NixOS, run everything through
`nix shell nixpkgs#nodejs_22 nixpkgs#pnpm nixpkgs#chromium` and set
`PLAYWRIGHT_CHROMIUM_PATH=$(command -v chromium)` for the e2e tests.

## Budgets (measured 27 Oct 2026, Lighthouse 12, local static build)

| Check                                 | Mobile          | Desktop         | Brief target |
| ------------------------------------- | --------------- | --------------- | ------------ |
| Performance                           | 98              | 100             | —            |
| Accessibility / Best Practices / SEO  | 100 / 100 / 100 | 100 / 100 / 100 | ≥ 95         |
| LCP                                   | 2.0–2.1 s       | 0.6 s           | < 2.5 s      |
| CLS                                   | 0               | 0               | < 0.1        |
| Initial JS (gzipped, modern browsers) | ~140 KB         | ~140 KB         | ~100 KB      |

The JS budget isn't met: React DOM and the Next.js runtime alone are ~114 KB gzipped, and
the site's own initial code is ~25 KB (every Easter egg loads later). Meeting ~100 KB would
mean leaving Next.js/React, which needs Luke's sign-off.

## Open content

The Noctus Umbra acts in `content/noctus/` ship as playable drafts. Luke rewrites the prose,
and the dice modifiers and mine-table bands in `src/features/noctus/dice.ts`, from the
campaign notes (marked `TODO(luke)`).
