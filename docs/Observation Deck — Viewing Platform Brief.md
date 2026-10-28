# Observation Deck — Viewing Platform Brief (v3)

**Project:** My Three Body CV (`SkyeWalker360/my-three-body-cv`)
**For:** Claude Code
**Replaces:** the "Three-Body Lab" section (and v1/v2 of this brief)

**Goal in one line:** A viewing platform from which visitors look out at the solar bodies of the three-body complex, seen as they would really appear from where the platform is, with everything else in the engine affecting what they see.

**What this is not:** a flight game. The vessel exists so the viewpoint can be anywhere in the system and move there honestly. Piloting, autopilot scripting and combat are out of scope (see §10, "Later, maybe").

> **Status (28 Oct 2026):** Phases 1–5 built. Luke's answers to §9 are recorded there.
> Implementation choices are in `docs/decisions.md` (D11–D15).

---

## 0. Ground rules

1. **Original vessel.** The platform is the observation dome of K.A.R.L.'s own spacer from the site's lore. No franchise ship names, markings or silhouettes.
2. **No 3D model needed.** The vessel is a physics point with a heading. The platform interior is hand-authored 2D pixel art.
3. **Inspect the repo first.** Find the current Three-Body Lab section, the integrator, the presets, the telemetry HUD, the celestial renderer (planets, stars, dying stars, black hole), lensing, stellar evolution and civilization-era state. Wire into what exists; stub anything not built yet behind an interface.
4. **Realism rule.** Compute what the viewer would see from real physical quantities (SI via one shared units module), then display it. Where something is exaggerated for readability (e.g. a tiny planet magnified), the HUD says so.

---

## 1. Unit system (prerequisite)

Presets likely run in G = 1 N-body units. Define one mapping in a shared `units` module:

| Quantity | Sim unit | SI |
|---|---|---|
| Length | 1 | 1 AU = 1.496×10¹¹ m (configurable per preset) |
| Mass | 1 | 1 M☉ = 1.989×10³⁰ kg |
| Time | 1 | √(AU³ / (G·M☉)) ≈ 5.02×10⁶ s (≈58.1 days) |

Every visual quantity below (angular size, brightness, colour shift) is derived through this table.

---

## 2. The platform

| Property | Description |
|---|---|
| Position / velocity | A massless test particle in the sim, so it feels gravity but never perturbs the bodies (energy telemetry stays exact) |
| Orientation | Where the dome is looking; controlled by the visitor |
| Interior | Pixel-art dome frame: window struts, a console, two seats, K.A.R.L.'s 12-cell scanner bar along the top |
| Window | ~100° horizontal field of view by default (wide, like standing at a large window) |

### 2.1 Vantage points
The visitor chooses *where* to watch from. Each preset gets a set of curated vantages:

| Vantage | What you see |
|---|---|
| Above the orbital plane | The full dance of the three bodies from "above" (best for FIGURE-8, MOTH-I) |
| Barycentre | Bodies wheeling around you |
| Lagrange point (L4/L5 in triangle/CR3BP presets) | Bodies appear nearly fixed; calm view |
| Planet orbit | Sunrises and sunsets from multiple stars; eclipses |
| Near the black hole (safe distance, outside the photon sphere) | Lensed sky, Einstein ring, accretion disk |
| Free look | Current position, any direction |

### 2.2 Moving between vantages
- The platform travels under real gravity plus a capped, simple thrust, so the trip arcs and slingshots naturally rather than teleporting.
- Trips are shown at time-warp; the HUD shows real elapsed time ("Transit: 3.2 years").
- A "Jump" option skips straight there with a scanline wipe for visitors who don't want to wait.
- **Safety:** the platform never enters a body, a stellar envelope, or the black hole's danger zone; transits route around them.

---

## 3. What the visitor sees — physically driven

This is the core of the feature.

| Effect | Rule | Why it matters |
|---|---|---|
| **True positions** | Perspective projection from the platform | Bodies move across the window as the system evolves |
| **Angular size** | θ = 2·asin(R/d); below 1 px, draw as a small star point | A star nearby fills the window; far away it's a dot |
| **Brightness** | Apparent brightness ∝ L/d² | Stars dominate; planets are faint |
| **Auto-exposure** | Exposure adapts to the brightest thing in view, like eyes and cameras do | Without it, a close star whites out the screen |
| **Planet phases** | Illuminated fraction from the angle between star → planet → platform, summed over all stars | Crescent, gibbous and "two-sided" phases lit by two suns at once |
| **Star colours** | Existing blackbody colours | Hot stars blue-white, cool stars orange-red |
| **Limb darkening / granulation** | Existing star renderer, now shown at true size | Visible when close to a star |
| **Eclipses and transits** | Ray tests from platform to each body against nearer bodies | Planets cross star discs; stars occult each other |
| **Shadows on the deck** | Interior lighting = sum of visible stars, coloured by their temperature | Interior goes dim during eclipses and changes colour as different suns rise |
| **Gravitational lensing** | Existing Schwarzschild pass, re-centred on the deck camera | Near the black hole the starfield warps into rings |
| **Gravitational redshift** | Near the black hole, incoming starlight blue-shifts by 1/√(1 − r_s/r) | Sky subtly bluer the deeper you are in the well |
| **Doppler / aberration** | Only when platform speed is significant; otherwise off | Avoids fake "warp streaks" at realistic speeds |
| **Background sky** | Milky Way / starfield cubemap, no parallax | Distant stars stay fixed as you look around |

### 3.1 Living-system events seen from the deck
| Engine event | What you see |
|---|---|
| Red giant phase | A star swells across the window over time |
| Planetary nebula | Glowing shell expands outward; may wash over the platform as a haze |
| Supernova | Sudden flash (auto-exposure clamps), then an expanding shell; platform is nudged if the front reaches it |
| Black hole formation | Star collapses; lensing switches on |
| Planet climate eras | Planet colour/biome changes (existing palette swaps) |
| Civilization eras | City lights appear on a planet's night side |
| Nebula rebirth (Epoch N+1) | New stars ignite in view |

---

## 4. Observatory tools on the console

The deck is a viewing platform, so it gets observing instruments rather than flight controls.

| Tool | Function |
|---|---|
| **Focus** | Click a body (or pick from a list) → view slews to centre it |
| **Telescope** | Zoom 1× to e.g. 50×; HUD shows true angular size and magnification so it's honest |
| **Body card** | Name, mass, radius, temperature, luminosity, evolutionary phase, climate era; distance and light-travel time from platform |
| **Spectrograph** | For a selected star, draw its blackbody spectrum as a pixel chart with peak wavelength (Wien's law) |
| **Time control** | Pause / 1× / warp; reverse is optional and only if the integrator supports it |
| **Overlays** | Orbit trails, Jacobi zero-velocity contours, Lagrange points, labels — all toggleable, off by default for a clean view |
| **Nav chart** | Switch preset (FIGURE-8, LAGRANGE TRIANGLE, MOTH-I, TRISOLARAN CHAOS) → short transition into that system |
| **Telemetry** | The old Lab HUD (energy drift, Lyapunov/chaos index) moved to a small console readout |

Every old Three-Body Lab control lives here. A K.A.R.L. command `/lab` still opens the plain orthographic view.

---

## 5. Look-around and interaction

- Drag / mouse movement turns the view (yaw ±180°, pitch ±60°). The spaceship cursor becomes a crosshair while inside the deck.
- Layered parallax: interior frame shifts most, glass next, sky not at all → depth without 3D.
- Keyboard: arrows to look, `+`/`−` to zoom, `F` to focus nearest body, `Esc` to leave.
- [M] keeps the NDT easter egg: magnetic-particle inspection of the dome frame and console.

### 5.1 K.A.R.L. integration
- K.A.R.L. narrates: "Eclipse in 40 seconds," "Star B is leaving the main sequence."
- Commands: `/deck`, `/vantage <name>`, `/focus <body>`, `/zoom <n>`, `/lab`, `/exit`.

---

## 6. Rendering stack (back → front)

1. **Sky** — starfield/Milky Way cubemap.
2. **Bodies** — existing celestial renderer, sized and lit per §3.
3. **Lensing** — existing pass.
4. **Exposure** — auto-exposure + tone mapping into the pixel palette.
5. **Glass** — faint reflections, dust specks, vignetting; tinted by dominant star colour.
6. **Interior** — 2D pixel-art frame, lit by the sum of visible stars.
7. **Console/HUD** — real DOM elements (accessible, crawlable).

Pixel consistency: render bodies into a low-res target at the site's pixel scale, palette-quantize with the existing 4×4 Bayer dither, integer upscale. Snap positions to whole low-res pixels (carry the fraction as a sub-pixel offset) to avoid shimmer while the view turns.

**Stretch goal:** Texel Splatting (Dylan Ebert, 2026) renders from a fixed probe origin into a cubemap and keeps pixel art stable as the camera turns. A seated observer is a fixed origin, so it fits the deck's look-around closely. Baseline pipeline first.

---

## 7. Architecture fit

| Package | Additions |
|---|---|
| `physics-wasm` | Platform state (test particle) in the shared `Float64Array`; simple guided transit between vantages; eclipse ray tests |
| `render-engine` | `DeckCamera` (perspective, look-around, zoom), angular sizing, phases, auto-exposure, glass/interior layers |
| `portfolio-web` | Section replacement, DOM console and body cards, K.A.R.L. commands |

If the repo is still a single file, implement the same boundaries as JS modules.

**Budgets:** deck ≤ 4 ms/frame on a mid-range laptop; interior art ≤ 40 KB.
**Accessibility/ATS:** CV DOM untouched; canvas `aria-hidden`; body cards and instruments readable by screen readers; `prefers-reduced-motion` disables auto-slewing and transit animations (jump only).
**Mobile:** fixed view with tap-to-focus; optional gyroscope look-around with permission; candidate entry for the planned Pokédex-style mobile view (each body card is a "dex entry").

---

## 8. Implementation phases

### Phase 1 — Platform + camera
- [x] `units` module; platform as test particle.
- [x] Deck camera with perspective projection, look-around and zoom.
- [x] Bodies at true angular size and brightness; auto-exposure.
- **Done when:** from each vantage, bodies move correctly across the window and nothing whites out the screen.

### Phase 2 — Realism layer
- [x] Multi-star planet phases.
- [x] Eclipses/transits; interior lighting from visible stars.
- [x] Lensing and redshift near the black hole.
- **Done when:** an eclipse visibly dims the deck interior, and planet phases match star geometry.

### Phase 3 — Observatory console
- [x] Focus, telescope, body cards, spectrograph, overlays, time control, nav chart.
- [x] Remove the Three-Body Lab section; add `/lab`.
- **Done when:** every old Lab feature is reachable from the console.

### Phase 4 — Vantages + events
- [x] Curated vantages per preset; guided transit + jump.
- [x] Stellar-evolution and civilization events visible from the deck.
- [x] K.A.R.L. narration and commands.

### Phase 5 — Polish
- [x] Pixel stability pass; mobile view; reduced-motion; optional texel-splatting experiment (not attempted; see D15).

---

## 9. Open questions for Luke

Answered 28 Oct 2026 (Luke took every recommendation):

1. Should the default view be a fixed vantage (calm), or start at the barycentre with bodies wheeling around? **Fixed calm vantage: above the orbital plane.**
2. How much interior should be visible — a large window with a thin frame, or a cosy cockpit with more console? **Large window, thin frame.**
3. Do you want K.A.R.L. narrating events automatically, or only when asked? **Only when asked.**
4. AU-scale distances (realistic, bodies often small) or a compact system scale (bodies bigger, labelled as compressed)? **Compact, labelled.**

---

## 10. Later, maybe (out of scope for now)
Manual piloting, autopilot scripting from the MicroPython REPL, hull damage and tidal stress, using the vessel in the footer asteroid game. The platform's physics design leaves room for these without rework.

---

## Sources
- Dylan Ebert, "Texel Splatting: Perspective-Stable 3D Pixel Art" — https://arxiv.org/abs/2603.14587
- "Rendering Pixel Art in Real Time" (palette-quantized lighting pipeline) — https://thecodecofficial.github.io/Blog/PixelArt/
- Unity forum: low-res render target, point filtering, sub-pixel offset — https://discussions.unity.com/t/low-resolution-rendering-3d-pixel-art-with-integer-upscaling/848462
- Luke's Drive doc (portal-style separate interior scene; ray-triangle picking)
- Standard physics used without lookup: angular diameter, inverse-square flux, Wien's displacement law, Schwarzschild gravitational redshift
