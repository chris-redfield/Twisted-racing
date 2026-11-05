# HANDOFF — session index

Newest first. Each entry is **date — title**; the index is the table of contents, so a new session
reads the top entry (and anything it links to) instead of the whole history. Depth varies by
entry: a plan gets the full brief, a finished change gets what you need to work on it again.
`PROJECT.md` keeps the long-form session log and the reasoning; this file is the jump table.

| Date | Title | Kind |
|---|---|---|
| 2026-11-05 | [NEXT: the definitive game (`index.html`)](#2026-11-05--next-the-definitive-game-indexhtml) | plan, start here |
| 2026-11-05 | [STREET city: state of the build](#2026-11-05--street-city-state-of-the-build) | reference |
| 2026-11-05 | [Raycaster + ASCII performance](#2026-11-05--raycaster--ascii-performance) | reference |
| 2026-11-04 | [STREET: walk, then a BSP city](#2026-11-04--street-walk-then-a-bsp-city) | summary |

---

## 2026-11-05 — NEXT: the definitive game (`index.html`)

**Goal:** a new file, `index.html`, the start of the real game (not another experiment). One
continuous run in three parts, plus a menu. Everything it needs already exists in
`scrapheap-madmax-city.html` — this is assembly and one genuinely new piece (the corner).

### How it plays (as he described it)

1. **Menu.** A single menu with **START GAME**, copied from *the party*
   (`C:\proj\the-party`) but in **cyberpunk colours** (the party's is blood red on black).
   - Source: `MENU` / `MENU_POP` in `src/config.js:267-282`, `drawMenu()` in `src/hud.js:992`
     (constants `MENU_TOP/SIZE/PITCH/DIM` at ~970, the pop-in easing `easeOutBack`), the title
     card around `src/hud.js:871`, the intro in `src/intro.js` (126 lines), font
     `assets/deathly/Font1.otf`. The party is ES modules over many files; our games are single
     self-contained HTML files - **port the drawing code, not the module structure.** Read it
     first; don't copy the Halloween art/intro frames.
2. **Part 1 — horizontal survival.** Left to right, like CONVOY (forward +x). Car only: **no
   getting out, no BSP city** here (the old roadside buildings are fine as scenery). A *short*
   survival: "not too hard nor too easy".
3. **The corner.** Not a junction - **one 90° curve**: the road turns from left→right to
   south→north (ASCENT's axis, forward −y). It is also a **checkpoint** for the demo.
4. **Part 2 — vertical survival.** Like ASCENT, for N more km.
5. **Part 3 — the city.** The road enters STREET's BSP city: no forced scroll, turn off into the
   streets, park, **E** to get out and walk (first person, ASCII). This is where the car enemies
   by density (the old "task 2") will live - confirm with him whether part 3 has enemies in v1.

### Where the pieces are (all in `scrapheap-madmax-city.html`)

| Need | Already there as |
|---|---|
| horizontal survival | stage `convoy`: forced scroll `camV` along +x, soft front/back walls, `updateSpawner`, `ENEMY_TYPE` (batedor/soldado/tanque), boost, overheat |
| vertical survival | stage `ascent`: same with `vertical = true`, forward −y, `VCY_BIAS` 0.66 |
| city + walking | stage `street`: BSP strip (`makeCityChunk`…), `cityCollide`, barrier gaps, `onFoot`/`walker`, `drawWalkView`, look up/down, `VIEW_D` |
| first-person / ASCII | `drawWalkView`, `asciiBlit` (CPU), `RC_DIRECT` + `RC_OCCLUDE` |
| tools | `tools/headless.js` (logic, bots), `tools/shot.js` (screenshots), real-Chrome benchmark (see below) |

**Fork `scrapheap-madmax-city.html` → `index.html`** and cut down from there (it has every
stage). Per the standing rule, the experiment files stay untouched.

### The hard part: the corner (he expects trouble here, and he is right)

The engine branches on **one global axis flag** — `vertical` — chosen per stage in
`applyStage()`, and dozens of functions read it: the forced scroll, `trackProject/trackPoint`,
the soft frame walls in `step()`, `spawnEnemy`/`updateSpawner` culling, `aiCharge/aiFlank/
aiPursue` (they steer on the axis and `ROAD_HW`), `drawTrack`, barrier paths and posts,
`buildConvoyRings`, `survivalTier` buildings, `inView`, `rescale()`'s `FRONT_MAX/BACK_EDGE/
VIEW_HH`, the layout (`LAYOUT`, `ZOOM2D`, `VCY_BIAS`). Flipping it mid-run flips all of them at
once - at the corner, cars and walls on the *old* leg would suddenly be computed on the new axis.

`PROJECT.md` already holds design notes for exactly this (the deferred **"L-route"**, search for
it): a one-way L wants an **open waypoint polyline** (straight, corner, straight) rather than a
parametric curve; convoy's `trackProject/trackPoint` are the straight-x special case of it; the
axonometric view is fixed-angle, so **the corner changes which screen axis the action runs
along** - check the corner *reads* on screen before building the rest; verify the path maths
against a hand-computable case in `tools/headless.js` first.

Suggested approach (decide with him, it is the big design call of the session):
- Make the road a **path**: forward distance `s` along a polyline (x-leg, a quarter-circle
  corner, −y-leg), lateral offset `lat`. `trackProject(x,y) → {s, lat}` and
  `trackPoint(s, lat) → {x, y, angle}` replace the axis branches; the scroll, spawner, AI and
  culling work in (s, lat) and never ask which way is up.
- The camera scrolls along `s`. The axonometric view stays fixed, so the frame's "forward" turns
  from screen-right to screen-up through the corner - the frame's soft walls, `VCY_BIAS` and the
  look-ahead must ease from convoy's values to ascent's across the corner.
- Keep it **shippable early**: a cheap first version can clear the field at the corner (no
  enemies spawn within the corner's span, the checkpoint banner shows) so nothing has to
  survive the axis change while the path maths is proven.
- Part 2 → part 3: the vertical leg simply becomes STREET's highway; switch off the forced scroll
  and spawner when the player crosses into the city (a gate/sign), turn on the BSP chunks and
  walking. `street` already assumes the −y highway at x≈0 - keep part 2 on that line.

### Open questions to ask him (don't guess)

- **Lengths:** how many km for part 1 and part 2? (HUD "m" are world units; the scroll tops out
  at `CAM_VMAX` 214 u/s, so 1000 m ≈ 5-6 s at full pace - a "km" needs a conversion or a
  re-scale.) Tune with headless bots, as convoy was tuned.
- **Checkpoint rules:** dying in part 2 restarts at the corner? With full health? Lives?
- **Players:** solo only (the city is solo), or keep 2P co-op for parts 1-2?
- **Part 3 enemies** in this first version, or a calm arrival?
- **Win/end:** what ends the demo - reaching the city, or something in it?
- **Cyberpunk palette:** a hint? (neon magenta/cyan on near-black fits the ASCII city.)

### Prompt to start the next session

> Read `HANDOFF.md` (top entry) and `PROJECT.md`'s "NEXT SESSION STARTS HERE". We're starting
> the definitive game in a new file `index.html`, forked from `scrapheap-madmax-city.html`:
> a START GAME menu ported from the-party in cyberpunk colours, then one continuous run —
> horizontal survival → a 90° curve that is also a checkpoint → vertical survival → the BSP city
> where you can drive the streets and walk. Ask me the open questions in the handoff first, then
> plan the corner (the `vertical` flag problem) before writing code.

---

## 2026-11-05 — STREET city: state of the build

File: `scrapheap-madmax-city.html`, title option **4 STREET**, solo. Played and validated by him.
Uncommitted at handoff (check `git status`; it was staged partway through the day).

- **Driving:** free drive up an endless −y highway (`ROAD_HW` 180), no scroll, no enemies
  (`STREET_ENEMIES` false). Camera follows the car anywhere in the strip.
- **City:** BSP chunks per side (`CITY_CH` 1400 long, out to `CITY_W` 1400), party-style cut,
  `CITY_ROAD_MIN` 70, ~15 blocks / ~200 buildings per chunk-side, seeded by (k, side). Streets
  reaching the highway open the barrier (`barrierSpans`). Cars collide with cores, barrier
  pieces, the city wall (`cityCollide`); shots stop on buildings.
- **On foot:** E to get out (under `EXIT_SPEED` 25) / back in (within `ENTER_R` 34). WASD, SHIFT
  run, mouse-look (pointer lock) or arrows, **look up/down** (ascii-city's "shift" projection,
  +0.78/−0.51). `WALK_EYE` 16 (`[` `]`), barrier drawn knee-high on foot (render only).
- **View:** `VIEW_D` default 3600, **9/0 on foot** step 1150…7000; readout top-right (and with F)
  shows the real ms per walk frame. Past `VIEW_LOD` 900 only buildings ≥ 2.5 px tall are drawn.
- **Switches for later:** `STREET_ENEMIES`, `WALK_ARMED` (sidearm: Space/click → `walkFire()`
  hook, empty), `WALK_HP`.
- **Known rough:** highway rumble strip runs across the barrier gaps; no traffic/pedestrians/
  props; enemy AI knows only the highway corridor; car billboard is chunky up close.

## 2026-11-05 — Raycaster + ASCII performance

Why the walk view is fast, and how to measure it again. Full tables in `PROJECT.md`.

- **ASCII** (`asciiBlit`): was ~9,300 per-cell `drawImage` + two full-screen blend passes =
  29-58 ms/frame. Now built on the CPU into one ImageData (`ascMask`, `ascOut32`) + one
  `putImageData`: ~7 ms. Pixel diff vs old ≤ 2/255.
- **Walls:** `RC_DIRECT` writes walls/windows into `rcPix32` (was ~4,000 `fillRect` + colour
  strings). `RC_OCCLUDE` (`rcOcclude`) culls whole hidden buildings before ray tests (65-72%).
  Both on = **21-43% off a frame**; all variants byte-identical. He ruled out WebGL ("people will
  need a GPU").
- **Correctness checks** to rerun after raycaster changes: rcZ vs brute force over 200 random
  spots (0 bad of 64,000 columns); frame hashes across switch combinations.
- **Benchmark method:** inject a sync `<script>` into a temp copy, flush with
  `ctx.getImageData(0,0,1,1)` per iteration, write results into a `<pre>`, run Windows Chrome
  `--headless=new --dump-dom` (no virtual time), with and without `--disable-gpu`. Compare **ms
  saved**, not totals - headless baselines are bimodal (~6 vs ~15 ms for the same view).
- Gotcha: screenshots at run start can catch the car's invulnerability blink - set
  `cars[0].invuln = 0` in the shot setup.

## 2026-11-04 — STREET: walk, then a BSP city

- `scrapheap-madmax-walk.html` (committed by him): STREET stage 4, park + walk in full-screen
  first person among ASCENT's roadside buildings.
- `scrapheap-madmax-city.html` (fork of it): buildings got backsides (closed four-wall rings);
  the roadside tiers were replaced by the endless BSP city strip from
  `C:\proj\the-party\src\city.js`; the raycaster learned per-column segment buckets (city scale).
- Details and reasoning: `PROJECT.md` session log, entries dated 2026-11-04 and 2026-11-05.
