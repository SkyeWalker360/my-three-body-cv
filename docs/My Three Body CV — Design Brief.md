# My Three Body CV — Design Brief

Oct 27, 2026 · @Luke

## Overview, goals and audience

Build My Three Body CV as a recruiter-first, statically rendered CV site with a 16-bit space theme and three discoverable Easter eggs, in [SkyeWalker360/my-three-body-cv](https://github.com/SkyeWalker360/my-three-body-cv). The existing single-file prototype (space\_pixel\_art\_cv\_website.html) is the visual reference. It is not the codebase.

The story: Luke is the pilot of a retro spacer. His software work (full-stack, cloud, data) is the ship's avionics. His NDT magnetic-particle certification is the hull and reactor-containment inspection that keeps K.A.R.L.'s dying-star core from collapsing.

Goals, in priority order (when two goals conflict, the higher one wins):

1. A recruiter sees name, title, contact details and a PDF download within one screen, with no game interaction needed, and an ATS can parse every CV fact from plain HTML.
2. The site proves engineering depth through systems that genuinely work: a real three-body integrator, a state-driven terminal, and a game loop.
3. Both identities are presented as equals: Lead Full-Stack Developer, and NDT Magnetic Particle Testing Level 1 and 2.
4. The structure leaves room for a future games section and a blog without a rewrite.

| Audience | What they need | Where they get it |
| --- | --- | --- |
| Recruiters and ATS | Roles, dates, skills, contact, PDF | Layer 1 HTML, `/cv.pdf`, metadata |
| Engineering hiring managers | Evidence of depth and code quality | Three-body lab, K.A.R.L., public repo |
| NDT and engineering employers | Certification level, issuer, date, methods | NDT card, `/ndt` command |
| Developers and gamers | Something fun to find | Cursor, Noctus Umbra, shooter and boss |

## Visual identity

Keep the prototype's look, but enforce it through tokens: every colour in the code comes from this table, defined once as CSS variables in a Tailwind v4 `@theme` block. Contrast is measured against the void background.

| Token | Hex | Contrast on void | Use for | Never use for |
| --- | --- | --- | --- | --- |
| `--color-void` | #0A0E1A | — | Page and canvas background | — |
| `--color-panel` | rgba(15, 23, 42, 0.85) | — | Glass cards, terminal | — |
| `--color-ink` | #E2E8F0 | 15.6:1 | Body text | — |
| `--color-ink-muted` | #94A3B8 | 7.5:1 | Secondary text, dates | — |
| `--color-cyan` | #12B5CB | 7.8:1 | Primary borders, links, software sector, body 1 | — |
| `--color-gold` | #FFD93D | 14.0:1 | Headlines, NDT sector, body 2 | — |
| `--color-red` | #FF1E1E | 5.0:1 | K.A.R.L., lasers, boss, body 3 | Long text runs |
| `--color-green` | #10B981 | 7.6:1 | Status OK, HP bars | — |
| `--color-violet` | #7C3AED | 3.4:1 | Fills, borders, three-body lab, RPG accents | Text of any kind (fails AA) |

In place of violet text, use a lighter `--color-violet-ink` of at least 4.5:1, such as #A78BFA.

Type:

- **Press Start 2P:** headings, buttons and badges only. Minimum 12 px; never body copy; one line where possible.
- **VT323:** terminal, HUD and telemetry. Minimum 18 px, because it renders small.
- **Space Mono:** all body copy and lists, 14–16 px.
- Self-host all three with `next/font`; no Google Fonts request at runtime.

Pixel rules:

- **Grid:** 4 px base. Spacing, borders and sprite sizes are multiples of 4.
- **Edges:** pixel borders are the 4 px stepped `box-shadow` from the prototype. Corner radius is at most 2 px.
- **Canvases:** every canvas draws to a low-resolution buffer (480×270 by default) at integer coordinates, with `imageSmoothingEnabled = false`, and is upscaled by an integer factor with `image-rendering: pixelated`.
- **Sprites:** drawn in Aseprite at 1× and scaled only by integer factors. No rotated bitmaps; rotation means picking one of 16 pre-drawn frames.
- **Glass and CRT:** keep the backdrop blur on panels and the scanline overlay on the K.A.R.L. window only, never over CV text.

## Information architecture

One long home page carries the CV. Every CV fact comes from `content/cv-manifest.json`, and nothing about Luke's career is typed into components, bot replies or game code.

Home page sections, top to bottom:

1. **Header (sticky):** LG badge, name, title line, K.A.R.L. button, three-body preset and KICK controls.
2. **Hero:** headline, summary of 2–3 sentences, contact links (email, LinkedIn, GitHub), Download CV (PDF), and three CTAs: Explore CV, Diagnose core, Play Noctus Umbra.
3. **Experience:** bento cards for GEN318 and Lead Life, with filters for All, Software, NDT and Education.
4. **NDT certification:** issuer, MT Level 1 and 2, date, methods.
5. **Skills and projects:** nine skill categories, spoken languages, and the Multi-Node Homelab as a personal project.
6. **Education:** CTU Training Solutions (NQF 6, NQF 5 and CIW), Mondeor High School NSC, achievements.
7. **Three-body lab panel:** short explainer, preset buttons, live telemetry.
8. **Footer:** contact repeat, shooter launcher, copyright.

Routes:

| Route | Phase | Content |
| --- | --- | --- |
| `/` | 1 | The CV home page |
| `/cv.pdf` | 1 | A static PDF CV, kept in sync with the manifest |
| `/games` | Later | Video game showcase |
| `/blog` | Later | MDX posts |

Manifest shape (validate it with Zod at build time):

```ts
type Sector = 'dev' | 'ndt' | 'edu' | 'other';
type Game = { hp: number; fragments: string[] };
type CvManifest = {
  person: { name: string; title: string; location: string; summary: string;
            contact: { email: string; linkedin: string; github: string } };  // never phone or street address
  experience: Array<{ id: string; org: string; role: string; start: string; end?: string;
                      location: string; sector: Sector; kind: 'employment' | 'volunteering';
                      summary?: string; roles?: Array<{ title: string; highlights: string[] }>;
                      highlights?: string[]; later?: string; clients?: string[]; game?: Game }>;
  projects: Array<{ id: string; name: string; tagline: string; start: string; end: string | null;
                    sector: Sector; highlights: string[]; game?: Game }>;
  certifications: Array<{ id: string; name: string; issuer: string; location: string;
                          start: string; end: string; levels: string[]; sector: Sector; game?: Game }>;
  education: Array<{ id: string; institution: string; award: string; location: string; start: string;
                     end: string; sector: Sector; qualifications?: string[]; detail?: string; game?: Game }>;
  skills: Array<{ category: string; sector: Sector; items: string[] }>;
  spokenLanguages: Array<{ language: string; level: string }>;
  achievements: string[];
  karl: { aliases: Record<string, string[]> };  // manifest id mapped to trigger words
};
```

`content/cv-manifest.json` is transcribed word for word from Luke\_Gorry\_CV\_2026, updated 27 Oct to add Go, REST APIs, GraphQL, a Cloud category (Google Cloud Platform, Amazon Web Services), AutoCAD, and Lead Life as a later GEN318 client. The CV and the manifest now match. Any future change goes into both. The `game` and `karl` blocks are site configuration rather than CV text.

Dates are ISO strings (`2022-11`). The `game` block lets the shooter take its HP and fragment labels from the CV without touching game code.

## Interaction specs

Each Easter egg is optional, lazy-loaded, and must never block reading the CV.

### Three-body laboratory (background, Easter egg 1)

- **Solver:** Velocity Verlet (kick-drift-kick) on `Float64Array`. G = 1, Plummer softening ε = 1e-3, dt = 5e-4, run from a fixed-timestep accumulator on real elapsed time (cap 50 sub-steps per frame) so speed doesn't depend on refresh rate.
- **Frame:** every preset load and every KICK subtracts the centre-of-mass position and velocity (zero net momentum), so the system never drifts off-screen.
- **Thread:** a Web Worker drawing on `OffscreenCanvas`, with a main-thread fallback. Pause when the tab is hidden or the shooter is active.
- **Presets:**

| Preset | Masses | Initial state (x, y; vx, vy) | Source |
| --- | --- | --- | --- |
| Figure-8 (default) | 1 : 1 : 1 | r1 (0.97000436, −0.24308753), r2 = −r1, r3 (0, 0); v1 = v2 = (0.466203685, 0.43236573), v3 = −2v1 | Chenciner and Montgomery |
| Lagrange triangle | 1 : 1 : 1 | Equilateral, radius 1; tangential speed √(1/√3) ≈ 0.7598 | Analytic |
| Moth-I | 1 : 1 : 1 | r1 (−1, 0), r2 (1, 0), r3 (0, 0); v1 = v2 = (0.464445, 0.396060), v3 = −2v1 | Šuvakov and Dmitrašinović |
| Unequal-mass periodic | From the blueprint | Use the blueprint's values, then the barycentric correction | Verify against its source before shipping |
| Trisolaran chaos | 1.2 : 1.0 : 0.8 | The prototype's values, then the barycentric correction | Designed for chaos |

- **Controls:** a header button cycles presets and KICK adds a random Δv of ±0.075 per axis, then re-centres. Add a "Shadow" toggle that runs a copy perturbed by 1e-7 and shows the divergence δ(t) in the HUD.
- **HUD:** kinetic, potential and total energy, plus relative energy drift |ΔE / E₀|. Remove the fake "Center Drift" field.
- **Look:** 8×8 pixel bodies (cyan, gold, red) with a white 4×4 core and trails of 80 points fading per segment. Dim to 40% when K.A.R.L. is open.

### Spaceship cursor

- **Activation:** only when `(hover: hover) and (pointer: fine)` matches and `prefers-reduced-motion` does not. Otherwise keep the native cursor and draw nothing.
- **Motion:** lerp α = 0.18 toward the pointer; the heading picks one of 16 sprite frames at 22.5° steps; a 1 px reticle sits on the true pointer.
- **Particles:** a 200-particle pooled ring buffer, 2–4 exhaust particles per frame, drag 0.98, size 4 → 1 px, colour ramp white → cyan → gold → red → violet. A click fires a 20-particle burst.
- **Stacking:** the overlay must sit above every layer, including the K.A.R.L. dialog, or the native cursor must come back while the dialog is open.

### K.A.R.L. terminal

- **Shell:** a native `<dialog>` with focus trapping; Escape closes it and focus returns to the opener. The log is DOM text that can be selected and is announced through `aria-live="polite"`.
- **Header:** a 12-cell Larson scanner (2-cell core, fading trail, 1 s sweep), animated only while the dialog is open. Hidden toggle: `/karr` switches it to amber.
- **Core gauge:** a 64×64 canvas showing pulsing concentric shells with Bayer 8×8 dithering. Label: "1.43 M☉ sub-Chandrasekhar Si–Fe core".
- **State:** an XState machine with the modes `idle`, `cv`, `rpg` and `karr`.
- **Commands:** `/help`, `/cv`, `/ndt`, `/skills`, `/contact`, `/core`, `/noctus`, `/clear`, `/exit`. Free text maps to intents through the manifest's `karl.aliases`. Unknown input gets a short in-character reply that points to `/help`.
- **Safety:** user input renders as text, never as HTML.

### Noctus Umbra RPG (Easter egg 2)

- **Engine:** inkjs running compiled `.ink` stories, one per act, inside the K.A.R.L. log. Choices are numbered and keyboard-selectable.
- **Dice:** an `EXTERNAL roll(stat, dc)` function returns pass or fail; the story branches on the result and prints the roll (d20 + modifier against the DC). Also an `EXTERNAL rollD100Mine()` for the mine-shift table.
- **Acts:** I, Shadows of Heatherhaven and the Crescent Mines; II, Tug of War for Sto's Soul; III, The Mother's Mirror and the Feywild Fissure; IV, Sunflower Day and Into the Pit. Each act ends at a real `END` with a recap.
- **Persistence:** save to `localStorage` per act, wrapped in try/catch; `/noctus` offers continue or restart.
- **Content:** Luke writes or approves the ink scripts from his campaign notes; Claude scaffolds the structure and the DC mechanics only.

### Footer shooter and boss (Easter egg 3)

- **Start:** ENGAGE WEAPONS scrolls the page so the CV blocks are in view, then harvests only the `[data-destructible]` rects inside the viewport, sets their visibility to hidden, and spawns asteroids at those positions.
- **Controls:** WASD or arrow keys to thrust and turn, Space to fire (calling `preventDefault`), Escape to quit. The ship detaches from the cursor during play.
- **Asteroids:** HP and fragment labels come from each entry's `game` block. Fragments are skill pebbles with 1 HP. Asteroids wrap around the edges instead of bouncing.
- **Boss, "The Architect":** 128×128 sprite, 3 phases by HP: 100–66% syntax barrage, 66–33% magnetic flux pull, 33–0% supernova overdrive.
- **End:** an in-canvas victory or defeat screen with the score, a Restore website button that fades the DOM back in, and a full state reset so it can be replayed. No `alert()`.

## Technical constraints for Claude Code

The stack is fixed: change it only with Luke's sign-off. Everything else in this section is a hard rule that a PR must meet before merge.

| Area | Decision |
| --- | --- |
| Framework | Next.js App Router, `output: 'export'` (fully static), React, TypeScript `strict` |
| Styling | Tailwind CSS v4, tokens in `@theme`; no Tailwind CDN, no inline hex values outside the theme |
| Package manager | pnpm |
| State | XState for K.A.R.L. modes; local component state elsewhere; no global store unless needed |
| Narrative | inkjs, with `.ink` sources compiled at build time |
| Validation | Zod schema for the manifest, checked at build time; the build fails on invalid data |
| Testing | Vitest for logic (physics, intents, dice), Playwright for smoke and accessibility (axe) |
| Lint and format | ESLint + Prettier; `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass in CI |
| CI and deploy | GitHub Actions: lint, typecheck, test, build; deploy the static `out/` to GitHub Pages or Cloudflare Pages |

Budgets:

- **Speed:** LCP under 2.5 s, CLS under 0.1 and INP under 200 ms on a mid-range phone.
- **JavaScript:** the CV page loads at most about 100 KB of gzipped JS before any interaction. Each Easter egg loads with `next/dynamic` (`ssr: false`) on interaction or idle.
- **Lighthouse:** 95 or higher for Accessibility, Best Practices and SEO.

Rules for every PR:

1. **Content:** never invent or reword CV facts. Every career detail comes from the manifest, and if a fact is missing, ask Luke instead of filling it in.
2. **Readable without effects:** the CV must render and read fully with JavaScript disabled, and nothing about the CV is ever only on a canvas.
3. **Motion:** honour `prefers-reduced-motion` everywhere. The cursor, trails and scanner stop, and the three-body background shows a static frame.
4. **Accessibility:** keyboard access, a visible focus ring, and text that can be selected (no global `user-select: none`). Decorative canvases are `aria-hidden`.
5. **Physics tests:** after 100,000 steps of the Figure-8, |ΔE / E₀| < 1e-5 and |P| < 1e-9, and the barycentric function returns zero momentum for every preset.
6. **Animation loops:** each loop pauses on `visibilitychange` and when its feature is hidden. No `setInterval` animations.
7. **Scope:** one phase or feature per PR, with screenshots or a short GIF for anything visual. The prototype file stays in `reference/` and is never imported.

## Repo structure and conventions

The code is organised by feature: each Easter egg lives in its own folder and talks to the rest of the site only through a small event bus.

```text
my-three-body-cv/
├─ CLAUDE.md                  # short rules for Claude Code; points here
├─ docs/
│  ├─ design-brief.md          # this brief
│  └─ project-report.md        # prototype review
├─ reference/
│  └─ prototype.html           # visual reference only, never imported
├─ content/
│  ├─ cv-manifest.json         # single source of truth
│  └─ noctus/act-1.ink … act-4.ink
├─ public/
│  ├─ cv.pdf
│  └─ sprites/                 # Aseprite exports (ship 16 frames, boss)
├─ src/
│  ├─ app/                     # layout.tsx, page.tsx, globals.css (@theme tokens)
│  ├─ components/cv/           # Hero, ExperienceCard, Filters, Skills, Contact
│  ├─ features/
│  │  ├─ three-body/           # solver.ts, presets.ts, worker.ts, Canvas.tsx
│  │  ├─ cursor/               # ShipCursor.tsx, particles.ts
│  │  ├─ karl/                 # Terminal.tsx, machine.ts, intents.ts, CoreGauge.tsx
│  │  ├─ noctus/               # InkRunner.tsx, dice.ts
│  │  └─ shooter/              # engine.ts, harvest.ts, boss.ts, Overlay.tsx
│  └─ lib/                     # manifest.ts (Zod), events.ts (bus), motion.ts
├─ tests/                     # Vitest unit tests, Playwright e2e
└─ .github/workflows/ci.yml
```

Conventions:

- **Branches:** `feat/<phase>-<feature>`, `fix/<issue>`. `main` is always deployable.
- **Commits:** Conventional Commits (`feat(three-body): add barycentric correction`).
- **Event bus:** typed `CustomEvent`s (`karl:open`, `shooter:start`, `shooter:end`, `motion:reduced`) so features never import each other.
- **Pure core:** the physics, intent matching, dice and collision code take no DOM inputs, so they can be unit-tested.

## Acceptance criteria and out of scope

A phase is done when every box under it is ticked, and phases ship in order.

**Phase 1: Foundation**

- [ ] Repo scaffolded per the structure above; CI is green; the site deploys statically
- [ ] `cv-manifest.json` holds every fact from the current CV and passes Zod validation
- [ ] Name, title, contact links and a working PDF download are visible without scrolling at 1280×720 and 390×844
- [ ] Page title, meta description, Open Graph image and JSON-LD `Person` are present
- [ ] Lighthouse is 95 or higher for Accessibility, Best Practices and SEO; the page reads fully with JS disabled

**Phase 2: Three-body lab**

- [ ] All 5 presets run with zero net momentum and stay on screen for 10 minutes
- [ ] The energy-drift test passes; the HUD shows K, U, E and |ΔE / E₀|
- [ ] Speed is the same at 60 Hz and 120 Hz; the simulation runs in a worker when supported

**Phase 3: Cursor**

- [ ] 16 sprite frames, pooled particles, click burst
- [ ] Off on touch devices and with reduced motion, and the native cursor returns

**Phase 4: K.A.R.L. and Noctus Umbra**

- [ ] Dialog meets the focus, Escape and `aria-live` requirements; axe reports no violations
- [ ] All commands work; answers come from the manifest; user input is rendered as text
- [ ] All 4 acts reach `END`; rolls are checked against their DCs; save and continue work

**Phase 5: Shooter and boss**

- [ ] Clicking ENGAGE from the footer always produces shootable asteroids (no off-screen soft-lock)
- [ ] Keyboard controls match the on-screen label; Space doesn't scroll the page
- [ ] The boss runs 3 phases; victory restores the DOM; a replay works without reloading

Out of scope for now:

- The home-lab leaderboard API and the LLM fallback for K.A.R.L. (phase 6)
- The blog and games sections (routes reserved only)
- WebGL or Three.js rendering, multiplayer, and user accounts

Resolved from the 2026 CV (27 Oct):

- **Contact on the site:** email lukempgorry@gmail.com, [LinkedIn](https://www.linkedin.com/in/luke-gorry-951502239) and [GitHub](https://github.com/SkyeWalker360). Phone number and street address stay off the site, and `/cv.pdf` is a web version without them.
- **NDT card:** shows the course period, March – May 2026.
- **Lab card:** replaced by the Multi-Node Homelab project (NixOS, Proxmox, 2025 – present). Alpine and Zorin OS are dropped.
- **Still open:** hosting choice and custom domain.
