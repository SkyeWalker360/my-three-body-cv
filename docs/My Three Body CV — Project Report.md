# My Three Body CV — Project Report

Oct 27, 2026 · @Luke

## Executive summary

The Space Pixel Art CV exists as a working single-file prototype built with vanilla JavaScript, Tailwind CSS (CDN) and three HTML5 canvases, plus a research blueprint that specifies a much larger, modular production build. The GitHub repo (SkyeWalker360/my-three-body-cv) is empty, so the production build has not started yet.

| Artefact | What it is | Size |
| --- | --- | --- |
| space\_pixel\_art\_cv\_website.html | Runnable prototype: CV bento grid, three-body background, ship cursor, K.A.R.L. terminal, Noctus Umbra RPG, footer shooter | 1,151 lines, one file, no build step |
| Space\_Pixel\_Art\_CV\_Website.docx | "Architectural Blueprint and Computational Research": target architecture, physics, bot, RPG and shooter specs | about 81,000 characters, 77 cited sources |
| github.com/SkyeWalker360/my-three-body-cv | Target repository | Empty (no commits) as of today |

Both artefacts appear to be Gemini output. The HTML header comments ("Chosen Palette", "Application Structure Plan", "Visualization & Content Choices", "NO SVG / NO Mermaid" confirmation) match Gemini Canvas's report-to-web-page format. The docx reads as a Gemini Deep Research report that drew on your Google Drive CVs and Noctus Umbra campaign notes.

The prototype proves the concept: every planned feature is present and clickable. It is not production-ready. It has several functional bugs (the shooter can soft-lock, the RPG never finishes), weak accessibility, and CV data duplicated in three places. Section 6 lists the details and section 7 gives the path to a production build.

## Architecture

The prototype stacks two fixed full-screen canvases and a modal around an ordinary HTML CV, so the CV stays readable while the effects run behind and above it.

&#91;embedded content: prototype layer stack · 4 layers by z-index\]

The numbering follows the blueprint, not the stacking: in the prototype the K.A.R.L. modal (z-40) sits above the cursor overlay (z-30). The ship is drawn under the modal's blurred backdrop while the native cursor stays hidden, so pointing inside the terminal is awkward. All three animation loops and the scanner timer run on the main thread at all times.

## Technology stack

The prototype uses no framework, no bundler and no dependencies beyond two CDNs. The blueprint targets a typed, modular stack with workers and lazy-loaded modules.

| Concern | Prototype (what was actually used) | Blueprint target |
| --- | --- | --- |
| Markup and layout | Single HTML5 file, semantic `header` / `main` / `section` / `article` / `footer` | Next.js or Vite shell, React 19, statically rendered CV layer |
| Styling | Tailwind CSS Play CDN (`cdn.tailwindcss.com`) with an inline `tailwind.config` for colour and font tokens, plus a small `<style>` block | Tailwind CSS, built at compile time |
| Fonts | Google Fonts: Press Start 2P, VT323, Space Mono | Same, plus a pixel-font fallback |
| Rendering | Canvas 2D on three canvases (`threeBodyCanvas`, `overlayCanvas`, `coreCanvas`), each driven by its own `requestAnimationFrame` loop | Canvas 2D in a Web Worker via `OffscreenCanvas`, 480×270 internal buffer upscaled with nearest-neighbour |
| Physics | Hand-written Velocity Verlet integrator in plain JS numbers (float64), on the main thread | Float64Array Verlet with optional RK4, barycentric zero-momentum frame, in `threeBody.worker.ts` |
| Chatbot | DOM log plus form; an `if / else` command router with keyword matching | @xterm/xterm + ink-web + @inkjs/ui for the UI, XState v5 for state, @nlpjs/basic for intents, optional local-LLM fallback |
| RPG | JS object graph (`rpgCampaign`) with `Math.random()` d20 | Inkle's ink scripts on the inkjs runtime, with external dice functions and save/load |
| Shooter | Custom loop; `getBoundingClientRect()` harvest and `visibility: hidden` | Custom 2D engine with spatial hash (or Kaplay) |
| Animation effects | CSS box-shadow pixel borders, CRT scanline gradients, `backdrop-filter` glass, Larson scanner on an 80 ms `setInterval` | Same visual language, 64×64 Bayer-dithered core gauge |
| Data | Hardcoded in HTML and repeated in JS strings | A single schema-validated `cv-manifest.json` |
| Backend | None | Go (Gin) or Python service on the home lab for the leaderboard and LLM fallback |
| Hosting / CI | None yet | Not specified |

## Feature modules

All six modules work at prototype depth. Each one is a simplified version of its blueprint spec.

| Module | Built in the prototype | Key parameters | Blueprint spec not yet built |
| --- | --- | --- | --- |
| Three-body laboratory (Easter egg 1) | Background simulation with 4 presets: Figure-8, Lagrange, Moth-I, Trisolaran. A KICK button adds random velocity, a header button cycles presets, and a HUD shows kinetic, potential and total energy | G = 1, softening ε = 0.001, dt = 0.0008, 15 sub-steps per frame, 80-point trails | Barycentric correction, unequal-mass preset, shadow-copy chaos divergence, test planet and civilisation eras, Shift-drag velocity editing, collisions, low-res pixel buffer, worker thread |
| Spaceship cursor | Canvas ship that lerps toward the pointer, heading snapped to 16 directions, red exhaust particles, 20-particle burst on click, square reticle at the true pointer | Lerp α = 0.18, 22.5° steps, particle life decays 0.03 per frame | Aseprite sprite frames, 200-particle ring buffer, colour ramp, touch-device and reduced-motion handling |
| K.A.R.L. terminal | Glass modal with a 12-cell KITT Larson scanner, a pulsing 36 px core canvas, and commands `/help`, `/cv`, `/ndt`, `/core`, `/noctus`, `/clear` with keyword fallbacks | Scanner tick 80 ms; core status "1.43 M☉ sub-Chandrasekhar" | xterm.js and ink-web UI, XState machine, NLP intents, 64×64 dithered hydrostatic gauge, KARR amber mode, voice modulator, draggable window |
| Noctus Umbra RPG (Easter egg 2) | Text RPG inside K.A.R.L.: 4 acts, 2 choices per act, each roll shown as d20 + 5 | Outcome does not depend on the roll | inkjs scripts, real DC checks, 6-stage soul tug-of-war, 1-round teleporter challenge, d100 mine table, save/load |
| Footer shooter and boss (Easter egg 3) | ENGAGE WEAPONS turns every `[data-destructible]` block into an asteroid. Space fires along the ship heading. Asteroids split once, then "The Architect" boss spawns | Asteroid HP 4, fragments HP 2, boss HP 50, 50 points per hit | 3-phase boss attacks, magnetic NDT fragments, real player controls, restore-timeline button, PDF drop, leaderboard |
| CV bento grid and filters | 4 cards (GEN318, NDT, Lead Life, Education) plus a skills matrix, with All / Software / NDT / Education filters | Hides cards with `display: none` | Rendered from `cv-manifest.json`, PDF download |

## Design system

The visual language is "cosmic retro cyberpunk": a near-black void, a cyan primary, and gold, red, violet and green as semantic accents, all set in pixel and terminal type.

| Token | Hex | Role in the prototype |
| --- | --- | --- |
| `space.bg` (Deep Space Void) | #0A0E1A | Page and canvas background |
| `space.panel` | rgba(15, 23, 42, 0.85) | Glass card fill, with `backdrop-blur` |
| `space.border` (Neon Cyan) | #12B5CB | Primary borders, ship cursor, body 1, software sector |
| `space.gold` (Stellar Gold) | #FFD93D | Headlines, NDT sector, body 2, cockpit highlight |
| `space.red` (Core Red) | #FF1E1E | K.A.R.L., Larson scanner, lasers, body 3, boss |
| `space.violet` (Nebula Violet) | #7C3AED | Three-body lab, education, RPG |
| `space.green` (Phosphor Green) | #10B981 | Online status, boss HP bar |
| Body text | #E2E8F0 | Default copy |

| Typeface | Use |
| --- | --- |
| Press Start 2P | Headings, buttons, badges, canvas labels |
| VT323 | Terminal log, HUD telemetry, subtitles |
| Space Mono | Body copy and lists |

Signature effects:

- **Pixel borders:** a 4 px stepped `box-shadow` on all four sides, in cyan, red and gold variants.
- **CRT overlay:** 3 px horizontal scanlines plus a 6 px RGB sub-pixel gradient on the K.A.R.L. window.
- **Glassmorphism:** translucent panels blurred over the moving three-body background.
- **Crisp pixels:** `image-rendering: pixelated` set globally.

The defined tokens are only partly used. Much of the markup uses Tailwind's default `cyan-400`, `yellow-400` and `purple-300` instead of the `space.*` tokens, so the effective palette is about twice as large as the defined one.

## Code review

The two worst problems are a soft-lock in the shooter and a CV with no contact details. I read the prototype line by line. Line numbers refer to space\_pixel\_art\_cv\_website.html.

| Severity | Issue | Where | Effect | Fix |
| --- | --- | --- | --- | --- |
| High | No contact details or links (email, LinkedIn, GitHub) anywhere on the page | Hero, footer | A recruiter who likes the CV has no way to reach you | Add a contact block and links to the manifest; show them in the hero and footer |
| High | Off-screen asteroids get stuck | `shooterLoop`, lines 1056–1058 | Cards above the viewport spawn at y < 0. The edge check flips `vy` every frame, so they oscillate off-screen, can't be shot, and the boss never spawns | Spawn inside the viewport, or clamp the position and flip only when moving outward |
| High | `user-select: none` on `body` | Line 53 | Visitors and recruiters can't copy any CV text | Remove it; scope it to game controls only |
| High | RPG never finishes | `rpgCampaign.act4`, lines 896–899 | Both Act IV choices point to `"end"`, which doesn't exist. The engine stays in RPG mode and silently swallows all non-slash input | Add an `end` node, or move the run to inkjs |
| Medium | Dice rolls are cosmetic | `handleRpgChoice`, lines 942–947 | The d20 + 5 is printed but never compared to a DC, so every choice succeeds | Resolve the roll against the DC and branch on pass or fail |
| Medium | Shooter controls don't match the label | Line 970 vs `handleShooterKeys` | The button promises WASD and arrows, but only Space is handled; the ship still follows the mouse | Add keyboard thrust, or change the label |
| Medium | The boss is static and replay is broken | Lines 1072–1113 | The boss never moves or attacks. Victory uses `alert()`. `boss` and the button text are never reset | Build the phased boss, an in-canvas victory screen and a full state reset |
| Medium | Trisolaran preset drifts off-screen | Presets, lines 494–499 | Net momentum is not zero (Px = −0.02, Py = 0.16), so the whole system slides out of view | Apply the barycentric zero-momentum correction on every preset load and kick |
| Medium | Simulation speed depends on refresh rate | `drawThreeBody`, line 569 | A fixed 15 sub-steps per frame means 120 Hz screens run twice as fast as 60 Hz | Use a fixed-timestep accumulator driven by real elapsed time |
| Medium | No reduced-motion or touch handling | Global | Animations always run; on touch devices the ship sits idle on screen | Honour `prefers-reduced-motion`; disable the cursor overlay without a fine pointer |
| Medium | Modal accessibility | K.A.R.L. modal | No Escape to close, no focus trap, no ARIA dialog role | Use a `dialog` element or add these behaviours |
| Low | Trail fade doesn't work | Lines 592–601 | `globalAlpha` is set while the path is being built, but only the last value applies at `stroke()`, so trails draw at one opacity | Stroke each segment separately, or use the pixel buffer |
| Low | Center Drift telemetry is never updated | `telemetryDrift` | The HUD shows 0.0000 forever | Compute the centre-of-mass offset, or remove the field |
| Low | LaTeX shown as raw text | Line 218 | `$G=1$` and `$\epsilon=0.001$` render literally | Use plain text (G = 1, ε = 0.001) |
| Low | User input is inserted as HTML | `appendLog`, lines 793 and 845 | Typed text goes into `innerHTML` (self-XSS only, but bad practice) | Use `textContent` for user strings |
| Low | Tailwind Play CDN in production | Line 8 | Runtime JIT compile, larger payload and a flash of unstyled content | Build Tailwind at compile time |
| Low | Leftover generator comments | Lines 14–17 | "CONFIRMATION: NO SVG" notes ship to visitors | Strip them |

Content checked against Luke\_Gorry\_CV\_2026 (27 Oct). The prototype disagrees with the CV in several places:

| Prototype says | 2026 CV says | Action |
| --- | --- | --- |
| Title "Lead Full-Stack Dev & NDT MT Inspector" | "Full-Stack Software Developer & Certified NDT Technician (MT Levels 1 & 2)" | Use the CV title |
| NDT "March 2026" | March – May 2026 | Use the course period |
| Go, REST & GraphQL, AutoCAD inspection training, "GCP and AWS serverless" | Not listed; the CV says "Integrating Google and Amazon APIs" and "cloud-based functions" | Confirmed by Luke (27 Oct): added to the manifest under Coding Languages, Web Development, a new Cloud category, and NDT & Inspection. The Word CV was updated to match the same day |
| "Architected enterprise CRM platforms", "Unity and Godot visualization interfaces" at GEN318 | "Developing CRM web applications for various clients"; Unity and Godot are listed only as skills | Use the CV wording; overstated claims hurt in interviews |
| Home lab "Alpine Linux & Zorin OS" | Multi-Node Homelab: NixOS, Proxmox, Tailscale, AdGuard Home, sops-nix, restic, ZFS, Ollama (2025 – present) | Replace with the homelab project |
| Lead Life shown as experience | Listed under Volunteering | Show it as volunteering (Nov 2021 – 2022), with a note that Lead Life later became a client through GEN318 (also listed among GEN318's clients) |
| — | Node.js, WordPress, Xamarin Forms, Photoshop, Premiere Pro, Afrikaans (fluent), achievements | Add them; the manifest already has them |
| No contact details | Email, phone, street address, plus LinkedIn | Show email, LinkedIn and GitHub only; keep phone and street address off the public site and PDF |

## Recommendations and roadmap

Rebuild in the repo as a statically exported Next.js and TypeScript app driven by one CV manifest, and keep the prototype as the visual reference. Where the blueprint over-engineers, simplify:

| Decision | Blueprint said | Recommendation | Why |
| --- | --- | --- | --- |
| App shell | Next.js or Vite, React 19 | Next.js App Router with `output: 'export'`, TypeScript strict, Tailwind v4 | Matches your production stack; ships plain static HTML that ATS parsers and crawlers can read |
| Terminal UI | xterm.js + ink-web + @inkjs/ui | A DOM-based React terminal | xterm renders to a canvas that screen readers can't read and text can't be selected from; a DOM log keeps K.A.R.L.'s answers accessible and copyable |
| Bot logic | XState v5 + @nlpjs/basic, LLM fallback | XState for modes; keyword and alias intents built from the manifest; a home-lab LLM later, as an option | Gives most of the value at a fraction of the bundle; avoids training a corpus at launch |
| RPG | inkjs | Keep inkjs | Built for branching fiction; ink scripts are easy to write from your campaign notes |
| Physics | Worker + OffscreenCanvas | Keep, with a main-thread fallback | Takes the simulation off the reading thread; the fallback covers browsers without OffscreenCanvas |
| Shooter | Custom engine or Kaplay | Custom engine on the overlay canvas | Small scope; avoids a game-engine dependency |
| Backend | Go or Python home-lab service | Defer to the last phase | Nothing in the core experience needs it |

Phases:

1. **Foundation.** Repo scaffold, `cv-manifest.json` with a TypeScript schema, semantic CV page, contact block, PDF download, SEO and Open Graph metadata, CI and static deploy.
2. **Three-body lab.** Worker-based Verlet solver with a fixed-timestep accumulator, barycentric correction, 5 presets, kick and shadow-copy chaos, pixel buffer, accurate telemetry.
3. **Cursor and overlay.** Sprite-based 16-direction ship, pooled particles, reduced-motion and touch handling.
4. **K.A.R.L. and Noctus Umbra.** Accessible terminal dialog, Larson scanner, dithered core gauge, manifest-driven intents, the four acts in ink with real DC checks and save/load.
5. **Shooter and boss.** Viewport-safe asteroid harvest, manifest-driven HP and fragments, 3-phase Architect boss, restore button.
6. **Extras.** Home-lab leaderboard, LLM fallback for K.A.R.L., blog section.

The companion design brief turns these decisions into instructions Claude Code can build from.
