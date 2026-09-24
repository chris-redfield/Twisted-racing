# PROJECT — status and session log

Rolling working document. **Read this first at the start of a session**, and add an entry at the
end of one. `README.md` holds the stable stuff (how it works, conventions); this file holds
*where we are right now*.

---

## Where we are

**Status:** playable alpha, two builds.

- **`scrapheap-madmax-alpha.html` — SCRAPHEAP, the canonical game.** One file, **three stages**
  picked from the title (then solo/co-op):
  - **1 CONVOY** — horizontal Mad Max survival (forward +x, gunner stacks on top).
  - **2 ASCENT** — vertical survival, bottom→top climb (forward −y, gunner to the right).
  - **3 LOOP** — a three-lap circuit **race** round the **gunner build's 780×470 loop** map (four
    cars, weapons hot, laps/positions). The gunner build was itself the split-screen race on this
    loop, so the LOOP stage is its evolved form (now with a solo option too).
  A `stage` flag (→ `vertical`/`race`) branches the axis- and mode-dependent code; each stage runs
  its already-verified path. Verified headless; the survival stages are browser-iterated, the loop
  race is headless-only so far.
- `scrapheap-circuit-alpha.html` — the original driving game. BRAWL (Scrapyard, Thunder Bowl) and
  RACE (Dust Oval), four AI cars. **Unchanged since the web sessions.** The only other .html left
  in the main dir besides SCRAPHEAP.
- `reference/` — older builds kept for reference. Three were folded into SCRAPHEAP:
  `scrapheap-convoy-alpha.html` (→ CONVOY), `scrapheap-ascent-alpha.html` (→ ASCENT),
  `scrapheap-gunner-alpha.html` (→ LOOP; its map + race are the loop stage). The fourth,
  `scrapheap-loop-alpha.html`, is the old Loop-Hero auto-racer (board/parts/economy) — a distinct
  game, **not** merged; only the gunner build's loop map was reused for the LOOP stage.
- Car sprites are baked at runtime from four low-poly meshes — no external art yet.
- Audio is fully synthesised (WebAudio); there is no music.
- **`scrapheap-madmax-ascii.html` — experimental fork** of SCRAPHEAP (2026-09-23): ASCII P2 view
  (G cycles NORMAL / ASCII / ASCII SOLID, default SOLID) + roadside buildings in both views (B
  toggles). The canonical file is untouched; fold this in only once it's played and approved.
- `tools/headless.js` runs any build in node with a stubbed canvas.
- `tools/shot.js` takes **real-browser screenshots** (Windows Chrome from WSL, `--screenshot` +
  virtual time; the game file is never modified). Shots land in `.shots/` (git-ignored).

## NEXT SESSION STARTS HERE — play-test the ASCII/buildings fork

**Built 2026-09-23:** `scrapheap-madmax-ascii.html`. Open it, pick a stage, pick **2 CO-OP** (the
ASCII view is P2's pane; solo has no raycast view). **G** cycles the P2 view, **B** toggles
buildings — both work on the menu and mid-run. Decide: keep / tune / fold into the canonical file.
Tuning knobs: `ASC_LO/ASC_HI/ASC_GAMMA` (tone curve), `ASC_CW/ASC_CH` (cell size),
`BLD_TIERS`/`BLD_TIERS_LOOP` (placement), `FLOOR_H`/`WIN_STEP` (windows).
Known soft spots: plain ASCII mode leaves dark building faces blank (SOLID fixes that, hence the
default); in CONVOY's 2D pane the near-side buildings only peek in at the bottom edge, drawn
see-through so they never hide the road.

**First-pass browser check still owed** on `scrapheap-madmax-alpha.html` (nothing has been *looked
at*; balance is simulated): does the forced scroll read as "manage your speed" not "on rails"
(`CAM_V0/CAM_VMAX/CAM_RAMP`, `CRUISE_BAND`, `FRONT_MAX`/`BACK_EDGE`); are oncoming chargers
dodgeable (`updateSpawner`/`enemyCap`); is solo drive+gun playable not overwhelming; does the road
read as moving (dash `lineDashOffset` sign in `drawTrack` is a one-line flip if it streams the wrong
way); and the **LOOP race has never been steered by a human** (AI laps fine headless).

**Deferred:** the **L-route** (left→right, then a corner, then up) — "straight for now, the L route
later". Design notes kept for whoever builds it:

> A one-way L needs an **open** path that runs 0 → 1 once without wrapping, and almost certainly a
> **waypoint polyline** (straight, corner, straight) rather than a parametric curve. The convoy
> build already proved the open-corridor case — its `trackProject`/`trackPoint` are the straight-x
> degenerate of exactly this. The axonometric view is fixed-angle, so the corner changes which
> screen axis the action runs along; check the corner reads before committing to the whole route.
> Verify any new path maths against a hand-computable case in `tools/headless.js` first.

## What's next (unordered backlog)

Nothing is committed to yet — pick from here or bring something new.

**Gunner mode, if it's worth continuing:**

- **Play it in a browser.** The raycaster is proven correct numerically, but nothing has been
  *looked at*. Most likely first-pass problems: the billboard frame offset (the `- π/2` in
  `rcSprites` assumes the bake's camera looks along −y; if cars face the wrong way it is a single
  constant), HUD crowding in a 640×180 pane, and whether a 95° FOV feels right.
- **Gun elevation** and a visible gun barrel / muzzle flash in the bottom of the gunner pane. Right
  now there is nothing on screen to say you are holding a weapon.
- **Give P2 the mines too** (`dropMine` is unused by the player) and maybe a zoom/scope.
- **Scenery beyond the fence** — grandstands, cranes, scrap piles. The horizon is bare, and
  billboards for static props would cost almost nothing.
- **Split the roles further**: P1 boost/handbrake, P2 repairs, shared resources. There is a good
  co-op economy in here if the split is worth pushing.
- **Two keyboards / gamepads.** One keyboard works but WASD + arrows is cramped for two people.

**Loop mode, if it's worth continuing:**

- **Play it in a browser first.** The balance below came from simulation, not from feel.
- **Meta-progression between runs.** Loop Hero's camp: bank scrap on death, spend it on
  permanently unlocked parts or a better starting car. This is the biggest missing piece — right
  now a run ends in a score and nothing carries.
- **A boss.** At a heat threshold, a BOSS RIG enters and hunts the driver; killing it clears the
  stage. Gives the run a destination instead of an endless grind.
- **Driver character.** Pick which of the four cars runs the loop, each with different stats.
- **More parts, and parts that interact more.** The three synergies are the best part of the
  design; there should be more of them. Parts that change what *neighbouring* parts do.
- **Cards, if we ever want them.** The palette is deliberately simpler than a hand of cards. The
  card version is still available later: draw 3, pick 1, discard limits.

**Driving game:**

- **Second race track** — `LEVELS.race[1]` is a `locked: true` placeholder. Adding a track means a
  second shape in `makeTrack()` (currently hardcoded to one superellipse via the `TRK` table).
- **Car identity** — the four meshes are cosmetic; stats (speed, grip, HP, weapon loadout) are
  identical. Rock 'n' Roll Racing leans hard on per-car character.
- **Progression / upgrades** — the other half of the Rock 'n' Roll Racing formula: earn something
  between races and spend it. Nothing persists today.
- **Car selection** — the player is always car 0 (HOGG); there is no pick screen.
- **Wire up `assets/car-sprite-sheet.png`** — `CAR_SHEETS[carIndex]` is the ready-made seam for it.
- **Music** — a driving track would carry a lot of the Rock 'n' Roll Racing feel.
- **Race polish** — no lap times shown, no position-change callouts, no rubber-banding.
- **Gamepad / touch input** — keyboard only today.

## Known rough edges

- **Convoy balance is simulated, not played** (as with loop mode). The scroll pace, spawn rate
  and enemy aggression are all first-guess numbers in the labelled tunables
  block and `updateSpawner`. Nobody has felt them yet.
- Convoy solo (1P) now **drives and guns in one view** (his follow-up: "the car should be able to
  shoot in 1 player mode… you only control the machine gun without the 2 player view"). WASD drives,
  arrows/mouse aim and fire, a reticle rides the aim line. No raycast pane in solo.
- Convoy reuses the gunner build's raycaster verbatim, so it inherits the same rough edges below
  (per-column occlusion, `EYE_Z`/`RC_FOV` being feel numbers). Its walls are straight open
  polylines rebuilt each frame rather than a baked ring.
- The convoy build is a **fork of the gunner build's engine**, which is itself a fork of the
  circuit engine. That's now three copies of the core; an engine fix has to be applied to all
  three until we decide to unify.
- The gunner's eye/gun height `EYE_Z` was lowered 38 → **26** (2026-09-23) because 38 read as the
  gun sitting too high on the car. The FPS barrier `BARRIER_H` came down with it (22 → **16**) to
  keep the wall clearly below the horizon (so it doesn't re-introduce the "tilting skyline" feel)
  while staying just taller than a car (~13). The tracer follows `EYE_Z`, so it drops too. `[` `]`
  tune `EYE_Z` live (12–70) if he wants it lower still, toward the road.
- **`EYE_Z` and `RC_FOV` are feel numbers, not derived ones.** Tune them live with `[` `]` and
  `-` `=` (both shown in the `F` overlay) rather than reasoning about them. The projection stays
  exactly correct at any value — verified at eye 24/38/52 and FOV 70/95/115.
- Sprite occlusion in the gunner view is per-column nearest-wall only, so a car is either fully
  drawn or fully hidden. Fine while the barrier (16) is taller than a car (~13); it would need
  per-pixel depth if anything shorter ever needs to partly hide something.
- The FPS barrier (16) is a cheat: the 2D half draws the same barrier at `TRK.WALL = 11`.
- **Loop mode has never been run in a real browser.** It is verified headless (loads, steps,
  renders, survives zoom/resolution churn, full run and restart) but nothing has been *looked at*.
  The HUD layout at 480×270 and mouse hit-testing are the likely suspects for a first pass.
- **Board zoom is capped by the loop's aspect ratio, not by the zoom number.** After the KY squash
  the board viewport is ~1.10:1, so an elongated loop wastes the vertical half of the screen and
  crops horizontally the moment you zoom in. Raised 0.22 → 0.25 → 0.275 across two rounds of
  feedback; the last step only worked because the loop was reshaped from 780×470 to 700×540 to
  match the frame (same lap length, 17.6s). It now uses 100% of the width and 91% of the height,
  so **0.275 is genuinely the ceiling** — going further needs the loop rounder still, or a
  pannable board camera.
- Loop mode's balance is simulated, not played. See the numbers in the session log.
- An airborne car keeps the shadow baked into its sprite, so during a ramp jump the shadow flies
  with it. Jump height is kept low to hide this. Proper fix: bake sprites without the shadow and
  draw it separately.
- The loop build is a **fork** of the circuit build's engine. Any engine fix has to be applied
  twice until we decide to unify.
- `assets/car-sprite-sheet.png` is committed but unused at runtime.
- Race ends as soon as the player finishes or three cars finish — the last car never gets a result.
- No persistence beyond loop mode's best score in `localStorage`.
- `makeTrack()` builds exactly one circuit shape; level 2 of RACE is a dead menu entry.

---

## Session log

Newest first. Keep entries short: what changed, why, and anything the next session needs to know.

### 2026-09-24 — ASCII fork polish: tracer, lights, skyline giants
All in `scrapheap-madmax-ascii.html` (on top of `f065286`).
- **Tracer** (committed in f065286): P2's cannon tracer drawn at half size (3 -> 1.5); 8 units
  out it was 55px of a 90px pane. Render-only; P1 and hitboxes untouched.
- **Tried and rejected:** smaller ASCII font (11px: no visible change; 5px: glyphs become dots)
  and smaller cells (6x9: reads like a picture; its GPU downsample also made far windows uglier).
  The original 8x12 cell / 12px bold font / exact 2x3 averaging stays.
- **Window lights from any distance/angle.** Were cut off beyond ~880 units, point-sampled (missed
  on angled faces), and averaged away in ASCII. Now: near/far LOD (near = real windows with
  footprint overlap test; far = lit windows only, min 1px), lights resist fog, and in ASCII a warm
  lit pixel wins its cell. Full strength was "too much noise", so it's all on **`LIGHTS_MIX`**
  (0 = original, 1 = full; set **0.5**). Measured lit ASCII cells down the road: 49 -> 163 (345 at 1).
- **Occlusion skip in `rcWalls`:** a farther wall whose top is below a nearer wall's top is fully
  hidden and skipped. Paid for the lights (6.7 -> 2.9 ms); identical light counts with/without.
- **Skyline giants** (`SKY_TIER`, `BLD_SKY`/`BLD_SKY_LOOP`): towers 380–850 tall, 900–1600 out,
  generated +/-`SKY_REACH`=3500 along the road, `SKY_LIT`=0.45 of the usual lit share. **P2 only** —
  skipped in the driving pane on purpose. rcWalls ~2.7 -> ~4.3 ms (node).

### 2026-09-23 — ASCII gunner view + roadside buildings (fork)
New file `scrapheap-madmax-ascii.html`, forked from the canonical game; the original is
byte-identical.

**ASCII.** Studied ascii-city first and corrected last session's notes: it is ASCII *always* (a char
grid); `glyphsEnabled` is only its solid-background option; the reusable trick is `fn264`, which
blits glyphs from a pre-rendered atlas instead of `fillText` per cell. Implemented as a post-process
on our raycaster: read back the RC buffer, average 2x3 px cells, luminance picks a glyph from
` .:-=+*%#@`, and colour comes from compositing — glyphs drawn white on black, then a cols x rows
tint image scaled over them with `multiply`. So per cell it's one atlas `drawImage`, no per-cell
colour state. **Tone curve fitted to a measured frame**: median luminance 37, p90 55, p99 83, lit
windows ~150 — the first guess (14..150) put 80% of cells on the two faintest glyphs.

**Buildings.** ascii-city is itself a 2D-ray-fan raycaster, so buildings are simply more wall
segments: each is a quad (road face + two ends as an open 3-segment ring; the back face can't be
hit from the road). Hash-generated per slot along the road, so nothing is stored. Two tiers: near
street frontage (between barrier and fence, 32–76 tall) and far skyline (beyond the fence, 130–300,
rising over it); fog turns the far tier into silhouettes. Lit windows per storey. In the 2D pane
they're extruded boxes with windowed faces; camera-side ones draw after the cars, see-through.
Cost (node, V8): `rcWalls` 0.8 → 2.6 ms convoy, 1.2 → 2.1 ms loop.

**Tooling.** `tools/shot.js` — real screenshots. The Playwright headless shell here lacks system
libs (`libnspr4`) and Windows Chrome's debug port isn't reachable from WSL, so it uses Chrome's
one-shot `--screenshot`/`--dump-dom` with `--virtual-time-budget` on a temp copy with setup JS
injected. Gotcha: under virtual time ~3 s budget ≈ 0.5 s of game (rAF is throttled), so fast-forward
with `for(...) step(DT)` in the setup; and `performance.now()` is frozen during JS, so time code in
node instead.

### 2026-09-23 — lowered the gunner's gun; queued the ASCII/buildings challenge
Two small things to close the session. **Gun height:** he felt the 2P gun sat too high on the car;
lowered `EYE_Z` 38 → 26 (and `BARRIER_H` 22 → 16 with it, so the wall stays below the horizon and
doesn't re-introduce the tilt, while staying taller than a car for the occlusion cheat). Global
raycaster params → applies to all three stages' 2P view; the tracer follows `EYE_Z` down. Verified
headless, no errors. `[` `]` still tune it live toward the road if he wants lower.

**Next challenge queued (not built):** an **ASCII render mode for the P2 view** (reuse the technique
from `C:\proj\ascii-city`, toggle on the menu) and **roadside buildings with near/far depth**. See
the NEXT SESSION block at the top and memory `next-ascii-p2-and-roadside-buildings`. He explicitly
wanted this only summarized for a clean handover.

### 2026-09-23 — added the LOOP race as a third stage; shelved the singles
His ask: fold a loop race in as a third stage, **reuse its map, not its code** ("this is old code,
use our new code"), and move the merged stage singles into `reference/`. (He first named
`scrapheap-loop-alpha.html`, then corrected it to the **gunner** build — both have a loop map, easy
mix-up. The map was swapped to the gunner's 780×470 and `scrapheap-loop-alpha.html` stayed in the
main dir, untouched.)

**What the loop stage is.** A three-lap circuit race — the engine's own ancestor race mode (the
gunner build) brought back on its reused **780×470** superellipse. Four cars (player + 3 `aiRace`
bots), laps counted by progress-wrap, positions, weapons-hot, first-to-finish. Only the **map**
(`makeTrack`, `LOOP` A/B/HW) was reused.

**How it slotted in.** Added `stage` ('convoy'|'ascent'|'loop') → derives `vertical`/`race` in
`applyStage`. `race` branches were added where the race genuinely differs from survival:
trackProject/trackPoint (superellipse vs straight), blockHitPoint, startMatch (build loop + grid of
4, no spawner), updateCar player control (real throttle, not cruise) + the lap/finish block (which
had survived the fork), step (camera **chases** the player, no forced scroll, `updatePlaces`),
drawTrack (loop road + `drawStartLine`), render walls (`buildWallPaths` far/near split), the
raycaster (static loop `rings` via `buildRingsLoop`/`outwardSign`, `trackMask`/`buildTrackMask` for
the floor, post-darkening skipped), pads (fixed round-the-loop, any car grabs them), and the HUD +
over screen (place/lap/standings). `TRK.HW` is now per-stage (120 loop / 180 highway) and the loop
paths re-bake in `rescale`. Menu got a third column and `Digit3`.

**Verified headless:** all three stages × solo/co-op, the menu flow, resolution churn (loop re-bakes
its paths), rapid 3-stage switching — clean. AI cars lap the circuit and the race finishes (winner +
standings resolve); a real steering pass in a browser is still owed. `circuit` stays in the main dir;
`reference/` holds the merged singles (convoy, ascent, gunner) plus the untouched Loop-Hero
`scrapheap-loop-alpha.html` (he moved that one there too — it was never merged).

### 2026-09-23 — merged the two stages into one file (SCRAPHEAP)
His ask: put convoy + ascent into a single html file, two stages in one mini-game. Forked convoy →
`scrapheap-madmax-alpha.html` (kept the two singles as references, per the don't-break-a-working-build
rule; told him it's now the canonical game and offered to retire the singles).

**How.** A single `let vertical` flag. The two stages are the same engine with the forward/lateral
axes swapped (convoy: forward +x, lateral y, stack layout; ascent: forward -y, lateral x, side
layout). Rather than a vector rewrite, each of the ~18 axis-dependent functions **branches on
`vertical`** and runs the exact code already verified in the standalone — lowest-risk merge. The
per-stage tunables (`ZOOM2D`, `LAYOUT`, `VCY_BIAS`, `CRUISE_BAND`, fixed-vs-dynamic `FRONT_MAX`/
`BACK_EDGE`) are set in `applyStage()`, called from `startMatch` before `rescale()`; `rcInit()` is
re-run there too so the raycaster resizes to the stage's gunner pane (stack 320×90 vs side 160×180).

**Menu.** New two-step flow: `title` picks the stage (1/2), `setup` picks solo/co-op (1/2), ESC
backs up. `over` adds T = switch stage. Branch points, for the next editor: trackProject/trackPoint,
blockHitPoint, startMatch (facing + pads), spawnEnemy, updateSpawner cull, aiCharge/aiPursue,
step (scroll + clamps + lateral follow), inView, updatePads/recycleAhead, drawTrack, convoyWallPath,
drawWallPosts, render (wall order), buildConvoyRings, onAsphalt, drawGunnerView, and the menus.

Verified headless: all four stage×player combos, the menu flow, resolution churn, rapid
stage-switching — clean. Both singles still pass untouched. Balance still simulated, not played.

### 2026-09-23 — SCRAPHEAP ASCENT: the vertical variant
Sixth build, its own file, forked from convoy. His ask: a stage that goes **bottom→top** (vertical
road) instead of left→right, zoomed out ~10% to fit more.

**The approach that mattered.** The axonometric camera is fixed-angle, so rather than rotate the
*projection* (which would fight the baked sprites and lighting), I rotated the **world logic** 90°:
forward is now -y (up), lateral is x, walls sit at x=±ROAD_HW. The projection, sprites and raycaster
are untouched — every car facing is already baked, so a car pointing "up" just works. `ZOOM2D`
0.8→0.72. Only the game logic swapped axes (corridor, camera scroll, spawner, AI headings, the road
drawer, the raycaster's ring builder + `onAsphalt` + post phase, pad recycling).

**Two things he caught in the browser, both fixed:**
- *Only the bottom half of the road drew.* Root cause was a **latent bug** (present in convoy too):
  `startMatch` called `layoutPanes()` but never recomputed the projection globals `VCX/VCY/VHW/VHH`,
  so picking 1P kept the boot-time 2P half-height extent. The vertical road exposed it. Fix:
  `startMatch` now calls `rescale()`. He said explicitly *not* to fix convoy (its road sits low-left,
  so the stale extent doesn't show) — left it alone.
- *Not enough vertical room, and no space for the P2 pane.* His idea (the convoy philosophy — "use
  the space we have"): put the road on a **tall left pane** and the gunner **on the right**. Set
  `LAYOUT='side'`. Because the left pane is full-height, the driver now gets the *same* vertical
  space in 2P as in 1P. And `FRONT_MAX/BACK_EDGE` are now computed from the visible height each
  `rescale` (≈706 world units of travel), so the player roams the whole rendered road in either mode.

*Third catch — car vanished at the very top of the screen.* `inView` (the draw cull) is symmetric
around the camera, but the `VCY=0.66` bias lets you see further UP than down, so a player pushed to
`FRONT_MAX` crossed the cull threshold and disappeared (braking brought it back). Fix: `VIEW_HH` (a
new cull half-extent) is sized in `rescale` to the *further* of the ahead/behind visible distances,
and the player is exempt from culling anyway.

Verified headless: both modes, side layout (RC pane 160×180), dynamic clamps, player never culled at
the front edge, churn/mode-switch, 30s runs — all clean. Balance still simulated, not played. Camera
bias `VCY=0.66` (player low, sees up the road); `CRUISE_BAND` 74→100 so W/S move you across the range.

### 2026-09-22 — SCRAPHEAP CONVOY: the Mad Max survival mode
Fifth mode, its own file, forked from the **gunner** build (not the circuit build PROJECT.md had
guessed): the two-player mode needs the gunner pane, so the build that already has both panes was
the right base. The other three builds are untouched and still pass headless.

**What we settled first** (two questions, in his words): road shape — *"let's do straight for now,
then in the future we experiment with the L route"* → endless straight survival, no corner, no
finish; the L-route is deferred (notes kept at the top of this file). Pace — *forced scroll*: the
camera advances on its own and you steer/trim speed within a band.

**The design.** The superellipse loop is gone. The road is an infinite straight band `|y| < ROAD_HW`
along +x; you travel left→right (which the existing axonometric projection already maps to
screen-right, so no camera rework). The camera force-scrolls at an escalating `camV`; the player
auto-cruises to hold station and W/S trim ±`CRUISE_BAND` — your position in the frame *is* the
speed you chose. Soft walls front (`FRONT_MAX`) and back (`BACK_EDGE`) keep you in frame, with no
damage on either (an earlier dust-wall hazard was tried and cut — see the log). Distance survived
is the score. A rolling spawner (`updateSpawner`/`enemyCap`)
injects **chargers** (oncoming, hold their lane, pass through and exit behind) and **pursuers**
(spawn behind, chase and ram), scaling with `wave`, and culls anything off-frame so the car list
stays bounded (headless: capped at 5 cars over a 60s run).

**1P vs 2P** off the title card (`1` / `2`). Solo is one full-screen view where the same player
drives *and* works the gun (WASD drive, arrows/mouse aim+fire, a reticle on the aim line); no
raycast pane. Convoy brings the split-screen gunner pane back verbatim, driver and gunner split.
Both modes grab ammo/repair pads that drift down the road.

*Follow-up same day (his feedback on first look):* the road looked frozen because the lane dashes
had a fixed dash phase and the walls were smooth bars — no motion cue even though the world moves.
Fixed by scrolling `lineDashOffset` with `cam.x` (lane lines + rumble strips) and adding
world-anchored **barrier posts** on both the 2D walls (`drawWallPosts`, via `toScreen` at world-x
intervals) and the raycast walls (a world-x-phased darkening in `rcWalls`), so posts stream past.
Also promoted the solo player from ramming-only to a full gun, per his ask.

*Second follow-up (aim felt wrong):* the mouse was a **joystick** — cursor position set a turret
*velocity*, so holding it off-centre spun the gun forever (2P "drift", 1P "turning around the
vehicle"). Replaced with one model per mode, since the two views are different: **2P is
first-person → Counter-Strike aim** (pointer lock + `movementX` turns the gun, holds when the
mouse stops; click to grab the pointer, `Esc` releases it), **1P is top-down → twin-stick** (the
gun points at the cursor's world position, `updateTurret` inverts `toScreen` for the ground point).
Keyboard arrows stay as the rate-based fallback for both. Verified headless: twin-stick aims at the
cursor, FPS holds-when-still (no drift), pointer-lock calls are guarded so the harness still runs.

*Third follow-up — the dust wall is gone.* First tried it as a flat bar, then as a churning
sandstorm; he disliked both, so it was **removed entirely** — visual and damage. The back of the
frame is now just a harmless **soft wall** (`BACK_EDGE`) that stops you sliding off-screen; there
is no back-edge damage and no `dustHit`/`drawDustWall`/`DUST_DPS` anymore. The "keep moving"
pressure now comes only from the enemies (pursuers ram you from behind if you hang back). If that
ever feels too soft, the spawner is the knob, not a wall.

**Three engine fixes the fork forced, worth remembering:**
- The race code indexed `cars[c.lastHitBy]` assuming `id === array index`. With a spawner the
  array is dynamic and that's false — kills would credit the wrong car or throw. Now every enemy
  gets a fresh `nextId` and lookups go through `carById(id)`.
- 2D sprite sheets were effectively re-baked per car; keyed them by **model+colour** in a `Map`
  (cleared on rescale) so the many spawned enemies share bitmaps instead of baking 32 frames each.
- The segment raycaster wrapped `(i+1)%n`, which on a straight open wall lays a spurious segment
  back down its whole length. Added an `open` flag so `rcWalls` stops at `n-1`; the corridor walls
  and fences are rebuilt each frame as short open polylines around the camera (`buildConvoyRings`),
  and `onAsphalt` is now just `|y| < ROAD_HW` (no mask table needed).

**Verified headless only.** No runtime errors in either mode; distance/waves accumulate, deaths
end the run, resolution churn + mode-switching + restarts are clean. **Balance is simulated, not
played** — same caveat as loop mode. Hands-off you last ~15s (you're meant to dodge); a real wheel
is needed to judge the scroll feel, whether oncoming traffic is fair, and whether solo needs a gun.

**Next time:** open it in a browser (see the block at the top of this file).

### 2026-09-22 — handoff
Gunner mode's camera and gun feel signed off after two rounds of browser feedback (see the
2026-09-21 entry, which was extended with both). Docs and memory written; next build agreed — see
**NEXT SESSION STARTS HERE** at the top of this file. All three builds, the docs and the headless
harness are committed (`0c63058 improvements`); this entry is the only thing on top.

### 2026-09-21 — SCRAPHEAP GUNNER: two players, one car
Fourth mode, again a separate file. `scrapheap-circuit-alpha.html` and `scrapheap-loop-alpha.html`
are both byte-identical and still pass headless runs.

**The design.** Split screen, race only. P1 drives in the existing axonometric view (bottom pane);
P2 rides in the same car behind a 360° ring-mounted gun and sees a first-person raycast view (top
pane). The split is strict: P1's fire keys were removed, and the arrow keys no longer steer. Ammo
comes from pickup pads, so P1's driving line is what keeps P2 loaded — that is where the co-op
tension lives.

**Raycasting.** Reference was the user's `C:\proj\survive2` (a JS port of Andrew Lim's SDL2
raycaster). Took the projection math from it — `viewDist`, `stripAngle`, `dist·cos` fisheye
correction, per-column z-buffer — and deliberately *not* the grid DDA traversal: our track is a
smooth 72-segment superellipse, and voxelising it into tiles would turn a clean oval into a visible
staircase. Cast against wall segments instead (three rings: two barriers plus a tall perimeter
fence for the horizon), 320 columns × 216 segments ≈ 1 ms/frame of arithmetic.

Two reuse wins worth remembering:
- `rasterCar` now takes `ky`/`kz`/`scale`, so the first-person car billboards are the *same*
  low-poly meshes re-baked at eye level (`KY_FPS = 0.16`) instead of the axonometric `KY = 0.62`.
  Both halves show the same vehicles.
- The pane system fell out of the loop build's `PX` / `S = PX*Z` split. `toScreen` just needed to
  centre on the pane instead of the canvas.

**The bug worth remembering.** The ray-vs-segment solve had `u` negated — I used denominator
`drx·ey − dry·ex` where solving `t·d = A + u·E` gives `dry·ex − drx·ey`. With the sign flipped,
the `0 ≤ u ≤ 1` test accepted intersections on each segment's *backward extension*. On a closed
ring of similar segments those spurious hits look entirely plausible, so the middle of the screen
coincidentally agreed and only the edges were wrong — and I had copied the same wrong formula into
my test's reference implementation, so the two agreed with each other while both being wrong.
What caught it: an analytic case. A flat wall perpendicular to the view must report the *same*
perpendicular distance in every column — that is the whole point of fisheye correction — so the
expected answer is a number you can write down without any code. It now reads 100.0000 across all
320 columns. **Lesson: when a reference implementation is a copy of the thing under test, it
proves nothing. Get one case you can compute by hand.**

**First browser session (same day).** Player reported the gunner camera felt like the car was
turning toward the barrier when it was only drifting closer to it. It was **not** a projection
bug: a straight-corridor test showed the vanishing point pinned to the centre column at every
lateral offset, right down to 10 units from the wall.

The cause was perceptual. A wall's top edge tilts by `(EYE_Z - BARRIER_H)/lateralGap` across the
screen, and it pivots about the centre of the view — which is the visual signature of rotation. At
eye 27 / barrier 22 that numerator was **5**, so the edge sat 6 px off the horizon (i.e. right
where the brain's "level" reference is) and then swung across the whole frame as you closed in.
Worse, the wall face was a flat untextured colour, so sliding toward it produced *no* motion on the
wall at all — the tilting silhouette was the only signal.

Fixes, in order of how much they mattered:
1. Raised `EYE_Z` 27 → 38 (he is on a ring mount above the roof, so this is also more truthful).
   Puts the barrier top 19.5 px below the horizon at track centre instead of 6, where it reads as
   a low wall being looked down on rather than a tilting skyline. Note this makes the tilt
   *larger*, which is correct — the aim is to get the line off the horizon, not to flatten it.
2. Vertical banding on the wall face from the along-wall coordinate, so lateral motion is visible.
3. A real top ribbon on the barrier, using `WALL_T` and the ray/wall-normal incidence, so a
   see-over wall looks like one.
4. A fixed gun mount and a vertical bearing line drawn into the pane. A foreground that never
   moves is the strongest available cue that the camera is steady — and since hit detection here
   is purely horizontal, a tall bearing line is an honest reticle too.
5. Road mask 160² → 384² (14.4 → 6.0 units/cell). The old quantisation stepped the distant road
   edge around as you moved, which was a second false bending cue.

**Then the gun felt laggy.** Raising the eye created a second problem: bullets still spawned at
`z=6`, down at the road, so a tracer seen from eye 38 projected `(38-6)·viewDist/dist` *below* the
horizon — far under the bottom of the pane at close range. It only climbed into view at ~144 units,
0.34 s after firing (it had been 0.17 s at eye 27). The new gun mount silhouette made it worse,
hiding 17.5 of the 50 rows below the horizon in the exact centre column where the tracer emerges.

Fix: the player's shots now spawn at the gunner's own sightline (`EYE_Z`) and ease down to the
road-level travel height, so the tracer appears *on* the crosshair on the first frame. Mount
trimmed back to hide 11.5 rows instead of 17.5. `z` is cosmetic here — hit tests are purely 2D —
so none of this changes aiming or damage.

**The instructive part:** the first attempt used gravity for the drop, and a frame-by-frame trace
showed the tracer appearing correctly, then *blinking out* between ~64 and ~122 units before
reappearing. The screen's visible band below the horizon grows **linearly** with distance
(`usable·d/viewDist`), so an accelerating drop outruns it. The settle has to be linear in distance
and gentler than that slope; `SHOT_SETTLE = 260` units keeps the tracer on screen for every eye
height the tuning keys allow (verified at 24/38/52/70). Eyeballing "does it appear immediately"
would have caught the first bug and missed the second.

**Then the fix broke the other view.** Raising the shot's world `z` fixed the gunner's pane and
wrecked the driving pane: P1 saw bullets leaving the *roof* of the car instead of the front. That
was the wrong move and should have been obvious — `z` is shared world state and the two panes
render it with completely different cameras, so changing it to suit one view necessarily breaks the
other. Reverted: bullets are back at `z=6` and missiles at `z=7`, exactly as they were, and the
raised tracer is now a **render-only offset inside `rcSprites`**, applied only to shots owned by
the player. Same visual result in the gunner's pane, zero change to world state.

The linear-in-distance easing turns out to have a tidy property in that form: `EYE_Z − renderZ`
grows in proportion to distance and the projection divides by distance, so the two cancel exactly.
The tracer draws at a *constant* 18 rows below the horizon for its whole flight — a clean straight
stream that cannot blink out, at every eye height the tuning keys allow.

**Rule worth keeping:** in a split-screen build, anything that only affects how something *looks*
belongs in that pane's renderer, not in the entity.

**Next time:** ask whether the eye height and FOV landed in the right place.

### 2026-09-10 — SCRAPHEAP LOOP: the auto-racer experiment
Third mode, built as a separate file so the driving game could not break. It didn't: the original
`scrapheap-circuit-alpha.html` is byte-identical and still passes a headless run of all three of
its levels.

**The design.** "Rock 'n' Roll Racing + Loop Hero" answered as: *you are the promoter, not the
driver.* The car runs the circuit on the AI racing line forever; you watch the whole loop at once
and build the show around it. Cards were rejected for something simpler — a fixed palette of parts
with prices, like an RTS build menu. No hand, no draw, no discard; you buy what you can afford.

The Loop Hero tension survives the swap because of a single currency: SCRAP buys both parts and
car upgrades, so every hazard you place is armour you didn't buy — and hazards are the only real
income. HEAT is the escalation dial, raising payouts and rival strength together, with safe parts
carrying *negative* heat so caution costs you twice.

**How it was built.** `cp` of the circuit build, then ~50 surgical edits. The engine, rendering,
physics, weapons and AI are untouched below the `LOOP MODE` banner. Two changes worth remembering:
- Zoom was added by renaming the old `S` to `PX` (canvas/HUD scale) and defining a new
  `S = PX*Z` as the world scale. Every existing world-space draw call then zoomed for free, with
  no oversized fills. Sprites re-bake on zoom exactly as they already did on resolution change.
- The player's input branch in `updateCar` was replaced with `aiThink`. Rivals route to
  `aiCombat` (hunters), your driver to `aiRace` (runs the line). Both were already written.

**Balance, from `tools/headless.js`** (built this session, kept in the repo). Lap time is ~18s.
Three simulated play styles over 180s:

| style | outcome | score |
| --- | --- | --- |
| all danger, no upkeep | dead on lap 3 | 575 |
| danger + repair bays | dead on lap 7, 8 kills | **2435** |
| safe parts only | survived, 10 laps, 0 kills | 765 |

Mixed builds beating both extremes is the curve we wanted. Three bugs the simulation caught that a
browser probably wouldn't have: lap 1 was free (car started 3% before the line), the oil+ramp
synergy was unreachable (both wanted the single road slot — sectors now have two), and rivals
out-damaged the driver roughly 3:1 (they now scale rate *and* damage off one `gunMul` knob).

**Next time:** open it in a browser. Nothing in this mode has been looked at, only measured.

### 2026-09-10 — docs bootstrap (first Claude Code session)
Project moved from the claude.ai web sessions into this repo / Claude Code. No gameplay changes.
Wrote `README.md` (architecture, controls, conventions) and this file so future sessions can pick
up without re-reading the whole source.

### Before the log — what was built in the web sessions
Reconstructed from git history; these commits predate this log.

- `dbc0c01` — generated the car sprite sheet asset; fixed death-by-pit; fixed cars catching on the
  corners of round objects (barrels and mounds now collide as circles, not boxes).
- `26e64d8` — fixed effect z-positioning (explosions and debris were drawn at the wrong height);
  dropped the old `scrapheap-circuit.bundle` in favour of the plain HTML file.
- `d4aef64` — first working version: both modes, three levels, AI, weapons, baked car sprites.
- `80f0e55` — initial commit.

---

### Entry template

```
### YYYY-MM-DD — short title
What changed and why. Anything half-finished, and where it is.
Open question for next time, if any.
```
