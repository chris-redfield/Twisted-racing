# PROJECT — status and session log

Rolling working document. **Read this first at the start of a session**, and add an entry at the
end of one. `README.md` holds the stable stuff (how it works, conventions); this file holds
*where we are right now*.

---

## Where we are

**Status:** playable alpha, two builds.

- `scrapheap-circuit-alpha.html` — the driving game. BRAWL (Scrapyard, Thunder Bowl) and
  RACE (Dust Oval), four AI cars, complete and playable. **Unchanged since the web sessions.**
- `scrapheap-loop-alpha.html` — SCRAPHEAP LOOP, the auto-racer experiment (2026-09-10). Runs end
  to end: autopilot driver, 64-slot board, 9 parts, 4 upgrades, rivals, cash-out and death screens.
  Never been opened in a browser yet — see *Known rough edges*.
- Car sprites are baked at runtime from four low-poly meshes — no external art in the loop yet.
- Audio is fully synthesised (WebAudio); there is no music.
- `scrapheap-gunner-alpha.html` — SCRAPHEAP GUNNER, the two-player experiment (2026-09-21).
  Split screen, race only: P1 drives in the 2D view, P2 works a 360° gun in a first-person
  raycast view out of the same car. Runs end to end. **Never been opened in a browser.**
- `tools/headless.js` runs any build in node with a stubbed canvas.

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

- Gunner mode's first-person barrier height (22) is a cheat: the 2D half draws the same barrier at
  `TRK.WALL = 11`. It was raised so the wall reads as a wall without blocking the corner ahead.
- **`EYE_Z` and `RC_FOV` are feel numbers, not derived ones.** Tune them live with `[` `]` and
  `-` `=` (both shown in the `F` overlay) rather than reasoning about them. The projection stays
  exactly correct at any value — verified at eye 24/38/52 and FOV 70/95/115.
- Sprite occlusion in the gunner view is per-column nearest-wall only, so a car is either fully
  drawn or fully hidden. Fine while the barrier (22) is taller than a car (~13); it would need
  per-pixel depth if anything shorter ever needs to partly hide something.
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
