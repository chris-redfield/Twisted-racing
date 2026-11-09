# HANDOFF — session index

Newest first. Each entry is **date — title**; the index is the table of contents, so a new session
reads the top entry (and anything it links to) instead of the whole history. Depth varies by
entry: a plan gets the full brief, a finished change gets what you need to work on it again.
`PROJECT.md` keeps the long-form session log and the reasoning; this file is the jump table.

| Date | Title | Kind |
|---|---|---|
| 2026-11-09 | [BOOST upgrade: the recharge, not the shove](#2026-11-09--boost-upgrade-the-recharge-not-the-shove) | built, 30 headless checks + screenshot |
| 2026-11-09 | [Controller support; MOUSE or CONTROLLER in OPTIONS](#2026-11-09--controller-support-mouse-or-controller-in-options) | built, 60 headless checks; **not yet played on a real pad** |
| 2026-11-08 | [Gun lab: first-person pistol, viewmodel methods compared](#2026-11-08--gun-lab-first-person-pistol-viewmodel-methods-compared) | **pistol is in index.html** (user's picture); lab kept for the 3D method |
| 2026-11-08 | [Green square heals 17.5% of max hull](#2026-11-08--green-square-heals-175-of-max-hull) | built, verified in Chrome |
| 2026-11-08 | [Second store at the city gate; city twice as wide](#2026-11-08--second-store-at-the-city-gate-city-twice-as-wide) | built, verified in Chrome |
| 2026-11-08 | [City view distance defaults to 7000](#2026-11-08--city-view-distance-defaults-to-7000) | built; frame cost not measured |
| 2026-11-08 | [City styles per leg: SLUMS / WIDE / DOWNTOWN](#2026-11-08--city-styles-per-leg-slums--wide--downtown) | built in index.html, screenshots; not played |
| 2026-11-08 | [City lab: street and building scale presets](#2026-11-08--city-lab-street-and-building-scale-presets) | superseded: lab removed, folded into the game |
| 2026-11-07 | [Mines on Q](#2026-11-07--mines-on-q) | built, verified in Chrome |
| 2026-11-07 | [Store: select, then confirm](#2026-11-07--store-select-then-confirm) | built, verified in Chrome |
| 2026-11-07 | [ESC pauses, never ends a run](#2026-11-07--esc-pauses-never-ends-a-run) | built |
| 2026-11-07 | [The Scrap Saints: bounties + store at the checkpoint](#2026-11-07--the-scrap-saints-bounties--store-at-the-checkpoint) | built, verified; balance untested by a human |
| 2026-11-07 | [Legs 70 s each; leg 1 half as dense, no oncoming trucks](#2026-11-07--legs-70-s-each-leg-1-half-as-dense-no-oncoming-trucks) | built, measured |
| 2026-11-07 | [Player HP 200 + upgrade effects (armor/health/gun/missile)](#2026-11-07--player-hp-200--upgrade-effects-armorhealthgunmissile) | built; earning them not designed |
| 2026-11-06 | [GARAGE: pick your car (classic / aspen / sports / biome)](#2026-11-06--garage-pick-your-car-classic--aspen--sports--biome) | built, in index.html |
| 2026-11-05 | [Voxel car proof: CAD model -> voxels -> viewer](#2026-11-05--voxel-car-proof-cad-model---voxels---viewer) | built, not in game |
| 2026-11-06 | [NEXT: cars from downloaded 3D models (voxelized)](#2026-11-06--next-cars-from-downloaded-3d-models-voxelized) | plan, start here |
| 2026-11-06 | [Story + intro comic script; new logo fitted](#2026-11-06--story--intro-comic-script-new-logo-fitted) | notes |
| 2026-11-06 | [Outskirts on legs 1-2, city overview on the map, logo v3 prompt](#2026-11-06--outskirts-on-legs-1-2-city-overview-on-the-map-logo-v3-prompt) | built |
| 2026-11-06 | [The map (M) and the new logo](#2026-11-06--the-map-m-and-the-new-logo) | built |
| 2026-11-06 | [Fixes: side-street dashes, hunters ignore you on foot, C skip, logo](#2026-11-06--fixes-side-street-dashes-hunters-ignore-you-on-foot-c-skip-logo) | built |
| 2026-11-06 | [index.html: the city joined on (steps 2+3)](#2026-11-06--indexhtml-the-city-joined-on-steps-23) | built, played |
| 2026-11-05 | [index.html step 1: menu, leg 1, the corner, leg 2](#2026-11-05--indexhtml-step-1-menu-leg-1-the-corner-leg-2) | built, played |
| 2026-11-05 | [NEXT: the definitive game (`index.html`)](#2026-11-05--next-the-definitive-game-indexhtml) | plan (decisions below) |
| 2026-11-05 | [STREET city: state of the build](#2026-11-05--street-city-state-of-the-build) | reference |
| 2026-11-05 | [Raycaster + ASCII performance](#2026-11-05--raycaster--ascii-performance) | reference |
| 2026-11-04 | [STREET: walk, then a BSP city](#2026-11-04--street-walk-then-a-bsp-city) | summary |

---










## 2026-11-09 — BOOST upgrade: the recharge, not the shove

**Goal:** a fifth thing to buy at the Scrap Saints, for the boost. `BOOST_TIME` also went
**0.9 -> 1.0s** (0.9 was too short to feel). Config: `BOOST_COOL_PER_LEVEL` in **3b**.

**What it does.** `boost` is a fifth upgrade track beside armor / health / gun / missile, and it cuts
the recharge by **1s a level: 10s at level 0, 4s at level 6.**

**Why the recharge and not the strength.** The burn is 1s against a 10s recharge, so at level 0 you
hold a charge **9% of the time** — the cooldown is what limits the boost, by a factor of ten. Halving
it roughly doubles how many boosts a leg gives you, and it is only a timer, so nothing in the physics
moves. Making the boost *stronger* is the trap: `BOOST_ADD` is a target the regulator serves, not a
force, and section 2 of `config.js` already records that a boost which only raises the target spends
itself against the frame's front spring and gains no ground. You would have to raise `BOOST_ROOM`
with it, which pushes the car at the edge of the frame where `WALL_REEL` and the backstop live — the
stuck-car problem all over again. If it ever needs to feel *bigger*, buy `BOOST_TIME` instead:
distance scales linearly with it and it touches no geometry.

**The two places a per-level cooldown goes wrong,** both now covered by the selftest:

- `tryBoost` arming the raw `BOOST_COOL` instead of `boostCool()` — the upgrade would be inert.
- the HUD gauge at the `BST` bar reading `1 - boostCD/BOOST_COOL`. With a 4s countdown over a 10s
  constant the bar fills to 60% and stops, which looks like a broken gauge, not a wrong divisor.

`boostCoolAt(lv)` has a 0.5s floor so a future config edit can't hand out a boost that never ends.
`upgradeTotal()` counts the new track, so the repair price rises with it like the others.

**The store panel grew.** Seven rows: `H` 280 -> 300 and the row pitch 28 -> 26, or CONTINUE sat on
top of the confirm line. `drawOptions()` has an identical-looking panel line — it was left at 280.
The selftest asserts the last row clears the confirm line and the panel clears `VH`, so the next row
added will say so instead of being found in a screenshot.

**Verified:** `node tools/selftest_boost.js` → 30/30 (constants, `tryBoost`, the gauge, a real
60fps recharge timed at ~5s vs ~11s, buying it in the store, the panel geometry). Screenshot of the
garage in Chrome. `node tools/selftest_pad.js` still 60/60. **Not played by a human:** whether 1s of
burn and a 4s floor feel right is a seat-of-the-pants question.

## 2026-11-09 — Controller support; MOUSE or CONTROLLER in OPTIONS

**Goal:** play the whole game on a pad. The mouse stays as it is; the player picks one device and
keeps it. New file `pad.js`, knobs in `config.js` **7b (`PAD`)**, new `OPTIONS` screen off the title.

**The layout. Left side is the car, right side is the guns:**

| | | | |
|---|---|---|---|
| left stick | steer (X, analog) + speed trim (Y) | right stick | the turret |
| d-pad | the same four, digital | | |
| L2 | drift (the handbrake) | R2 | missile |
| L1 | boost | R1 | machine gun |
| Square | mine | Cross | confirm · in and out of the car |
| Circle | back | Options | pause |

On foot: left stick walks, right stick looks, L3 runs, R1 is the pistol, Cross gets back in the car.

**Why the buttons landed there.** The two triggers are the two things you **squeeze and hold**: drift
through a corner on the left, the missile on the right. Both guns sit on the right hand, next to the aim
stick, so firing never costs you the aim. Boost is a **tap** and it is a driving input, so it joins drift
on the left shoulder. Mines moved to Square because they are the rarest thing in the game — you carry
2, 3 at most. The user asked for the guns on R1/R2 specifically, having first tried boost on R2.

**Three things worth knowing before changing it:**

- **The device choice settles the aim fight.** `updateTurret` used to take the mouse branch whenever
  `numPlayers===1 && mouseIn`, which in 1P is always — a right stick would have been overridden on
  every frame. There is no last-input-wins arbitration: `padMode()` (pad.js) is the single gate, and
  it wants *both* `inputMode==='pad'` and a pad actually connected. A saved `'pad'` with nothing
  plugged in quietly stays on the mouse, so nobody can lock themselves out of their own game.
- **The turret holds its bearing when the stick is released.** `padAimAngle()` returns `null` inside
  the deadzone and the caller leaves `c.turret` alone. A stick springs back to centre and a mouse
  does not; without this the gun snapped to straight-ahead every time you let go. And because
  `turret` is stored *relative* to the car, the gun keeps pointing where you aimed it while the car
  slides around underneath — that part was free.
- **The aim is screen-faithful, not world-faithful.** The ground is squashed by `KY` (0.62), so the
  stick is read as a direction *on screen* and converted the way the mouse already was: a 45° push
  comes out as 58.2° in world space. Push the stick at the thing you can see and the shot goes there.

**Presses go through `onPress`.** `padTick(dt)` runs once a frame at the top of `frame()` and
synthesises key codes (`'Enter'`, `'Escape'`, `MINE_KEY`, …), so the title, OPTIONS, garage, store,
setup and wreck screens needed no pad code of their own and cannot drift out of step with the
keyboard. Held controls are read where they are used instead. Edges last a whole frame, so more than
one reader can act on the same press.

**Screens answer to the pad even in MOUSE mode** — only the game itself is gated on the chosen
device. This was the other way round at first, and the self-test caught what that meant: someone who
has just plugged a pad in would have to reach for the keyboard to get to OPTIONS and turn the pad
on, which is the one thing they wanted the pad for. `padTick` gates the menu block on
`padConnected()` and everything below it on `padMode()`.

**Also changed:** analog steering is a real gain — `A`/`D` are a flat ±1, so the stick is the first
thing to give proportional cornering. `MENU_TOP` came down 0.62 → 0.56 because OPTIONS made it a
three-item menu and the `driving:` line had landed on top of the `ENTER` prompt. The hint line under
the canvas now follows the chosen device. Split-screen is untouched: in 2P the pad drives for P1 and
leaves the turret to P2's locked mouse rather than fighting over it.

**Verified:** `node tools/selftest_pad.js` — 59 checks on a fake standard-mapping pad, built on
`tools/headless.js`: deadzones and analog diagonals, trigger travel, edge-fires-once, menu repeat,
the KY aim conversion, the turret holding on release, and a full run through title → OPTIONS → a
live run → on foot → back in the car. It also pins the thing most likely to rot — that in MOUSE mode
the cursor still owns the turret and the stick does not touch it. Re-run it after touching input.
Layout checked in Chrome (`--headless=new --screenshot`); `tools/shot.js` is WSL-only and could not
be used here. `tools/headless.js` gained an `Image` stub, which the on-foot pistol's viewmodel needs
before it will draw at all — that gap predates this work.

**Not yet played on a real pad.** The button *indices* assume the W3C standard mapping, which is
what Chrome reports for DualSense/Xbox/8BitDo, but nothing here has been felt by a human. The
deadzones (`PAD.DZ_MOVE` 0.22, `PAD.DZ_AIM` 0.26) and `PAD.LOOK_RATE` 2.6 are first guesses — expect
to move them. The one to watch is `DZ_AIM`: too small and the turret twitches when the stick rests
off-centre, too large and short aim corrections do nothing.

## 2026-11-08 — Gun lab: first-person pistol, viewmodel methods compared

**Goal:** guns in the on-foot first-person view, with different ways of drawing the gun in hand (the viewmodel)
benchmarked side by side. The user is starting with a pistol; more weapons will come later.

**What's already there:** the first-person view is already "raycaster + billboards" (the Hamburger Hill approach).
The cars' billboards are baked from their 3D meshes at 32 angles (`bakeFpsSprites`). The viewmodel is screen-space
and needs no billboarding.

**Files:**
- `fpsgun.js` is the pistol module (a classic script; it only defines things):
  - `PISTOL` knobs: DMG 18, RATE 0.30, RANGE 1600, HIT_R 14;
  - `gunFire` is hit-scan: the nearest enemy within HIT_R of the line of fire, unless the raycaster's
    centre-column depth `rcZ` (a wall) is nearer; cars[0] is never a target;
  - recoil, muzzle flash, impact puff, hit marker;
  - `gunDraw(w)` draws into `rcCtx` **before the blit**, so ASCII converts it;
  - `GUN_METHODS` `['code','image']`, with V cycling them; `gunMs` holds each method's smoothed draw cost;
  - `gunHud()` is the lab's overlay box.
- `scrapheap-gun-lab.html` is generated by `python3 tools/make_gun_lab.py` from index.html; don't hand-edit it.
  It boots into the city on foot, armed. `WALK_ARMED` is forced true, and `walkFire` → `gunFire`.
- `tools/gun_images.py` packs `assets/guns/*.png` into `assets/guns/guns-2d.js` as data URLs. On `file://`,
  reading pixels back from a plain image file taints the canvas; the green key and ASCII both read pixels.
  The green key and the scale to RC size happen in the browser (`keyAndScale`).
- `assets/guns/IMAGE_PROMPT.md` is the prompt the user takes to an image model (idle.png and fire.png,
  full-frame 16:9 on flat #00FF00).

**Measured in Chrome:**
- code viewmodel about 0.07 ms per frame (whole walk frame about 2.7 ms);
- a hit took exactly 18 HP; a car 40 off the line was a miss;
- the image path was proven with a throwaway test PNG: keyed, scaled and placed, then deleted.

**Finding:** ASCII picks glyphs by brightness (`ASC_LO` 16 → `ASC_HI` 100) and the street is about 40, so a dark
gun vanishes. The code pistol was re-lit (body about 70–90, amber rim, top about 150) and now reads in ASCII. The
image prompt says to keep strong contrast.

**Update (same day): the user's pictures are in.** `assets/guns/idle.png` and `fire.png` are pixel art, about 1672×941.
- The baked flash and casing in `fire.png` just blinked, so the image method now uses **idle only**.
- `drawMuzzleFlash` is animated in code (new size and twist every frame), drawn in front at `GUN_IMG.MUZZLE`
  (0.512, 0.511, measured: the front-sight top). Casings are physics particles from `GUN_IMG.EJECT`, tumbling
  3×1 → 2×2 → 1×3, at `CASING_SCALE` 2. Recoil is the whole picture kicking down (`gunPose`).
- The lab starts on IMAGE when pictures exist (decided in `gunLabBoot`: guns-2d.js loads after fpsgun.js, and
  headless concatenates the scripts, so `typeof` at load hits the TDZ).
- The headless `gunMs` numbers aren't real (virtual clock); read them in a real browser.

**In the game (same day):** the pistol is the default on foot.
- `config.js` sets `WALK_ARMED = true`.
- `index.html` loads `fpsgun.js` and `assets/guns/guns-2d.js` after config. `walkFire` → `gunFire`,
  `updateWalker` calls `gunTick`, `drawWalkView` calls `gunDraw` before the blit, and `drawWalkHUD` calls `gunMarker`
  (the hit marker).
- `gunMethod` -1 resolves on first draw: IMAGE if `GUN_IMAGES.idle` exists, else CODE.
- The lab generator now only adds the stats box (`gunHud`), V and the boot.

**Alignment fix:** the picture used to be placed by its frame, so its front sight (0.512, 0.511 of the picture) sat about
17 px right and 10 px below the crosshair. It is now placed by the front sight: the crosshair's column (where the
hit-scan goes), `GUN_IMG.SIGHT_GAP` 5 RC px below it, with bob and kick added on top.

**Assets:**
- The user's originals live in `assets/guns/source/` (idle.png and fire.png, 1672 px).
- `assets/guns/idle.png` is a 640×360 copy, keyed transparent by the browser's scaler. This took guns-2d.js
  from 3.3 MB to 62 KB.
- **The user said no new images are needed for now.**

**Next:**
1. ~~the user's images go into the IMAGE slot~~ done;
2. a 'mesh' method: a voxelized CC0 pistol through `rasterCar`, a few baked frames;
3. compare looks and cost, then fold the winner into index.html (add `<script src="fpsgun.js">` and set `WALK_ARMED`).

## 2026-11-08 — Green square heals 17.5% of max hull

The run's health pickup was a flat +35. It now heals `healPickup(c)` = `round(maxHp * HEAL_PICKUP)`, with
`HEAL_PICKUP` 0.175 in config.js §3b. Verified in Chrome: 35 / 56 / 77 at HEALTH levels 0 / 3 / 6 (max 200 / 320 / 440).
The old race stages' pads still heal a flat 35 (no upgrades there).

**User idea, not built:** heal power as its own upgrade or skill (e.g. a store row that raises `HEAL_PICKUP`).

## 2026-11-08 — Second store at the city gate; city twice as wide

**Gate store:** `runEvents` now calls `enterCity(); openStore();` when the car crosses `ROAD.gateS`. `enterCity`
saves the city checkpoint first, so `closeStore` writes the purchases into it. A restart at the city checkpoint
(and the C skip) goes through `enterCity` alone, so there is no second store visit. The subtitle reads
"GARAGE · CITY GATE" and CONTINUE reads "into the city" (both keyed on `street`).

**Verified in Chrome:**
- the store opened at the gate with `street` true;
- a gun purchase was saved into `checkpoint.up`;
- a restart kept the cash and levels and didn't reopen the store.

**City width:** `CITY_STYLES.DOWNTOWN.W` went 2000 → 4000 (3820 of city either side of the highway).
- Chunk generation is median about 1 ms, max 4 ms (Node, `Date` resolution); there are 113 buildings and 15 roads per chunk, up from 52 and 7.
- The spawner, the flow grid and the cull are all relative to the player, so nothing else changed.
- The map's zoomed-out panel shows the wider city.

## 2026-11-08 — City view distance defaults to 7000

`VIEW_D` in config.js §8 went from 3600 to 7000, the top of `VIEW_STEPS`; 9 and 0 still step it on foot.
I measured buildings handed to the raycaster downtown, from 8 bearings: on average 120 → 194, in the worst bearing
210 → 468 (`VIEW_LOD` already drops the small far plots). Frame time is not measured (headless Chrome has
no real clock); the F-key overlay on foot shows `walkMs`. If it costs too much, try 5000.

## 2026-11-08 — City styles per leg: SLUMS / WIDE / DOWNTOWN

The lab's presets are now **`CITY_STYLES`** in `config.js` §5a, and **`CITY_LOOK`** picks one per part of the run:
- **leg 1 = SLUMS** (the old city numbers);
- **leg 2 = WIDE**;
- **the city = DOWNTOWN**.

Each style holds:
- street widths by cut depth and the minimum width;
- the cross street and outer road;
- the block (`LOT_*`), pavement and plot (`PLOT_*`) sizes;
- building heights, tower share and tower height;
- `FLOOR`, the storey scale. Buildings carry `fsc`, and both renderers scale storeys and windows by it.

**City:** §6's `CITY_W`/`XST`/`OUTR` come from `CITY_STYLE` (= `CITY_STYLES[CITY_LOOK.CITY]`). The loose
`LOT_*`, `PLOT_*`, `PAVE`, `CITY_ROADS` and `CITY_ROAD_MIN` constants are gone, as are `OUTSKIRTS_CUT`/`OUTSKIRTS_PLOT`
and the outskirts' own heights. `styleCut`, `stylePlot` and `styleHeight` in index.html turn a style into
the cut/plot number sets.

**Outskirts:** a chunk takes LEG1's style if it starts before `bendS0`, otherwise LEG2's. A chunk can't
straddle the two because of the bend's `OUT_M` margin. They stay sparse (`BUILT0/1`) and scenery-only;
side streets are drivable only in the city, as before.

**Front-reach cap:** on leg 1 the buildings below the road lean up over it on screen (drawn see-through at 42%).
With SLUMS heights, 10 of 490 front buildings reached more than 40 into the 223-tall road, and the tallest covered all of it.
Now a front building's height is capped at `(u0 - ROAD_HW)*KY + OUTSKIRTS.FRONT_REACH` (40), so the maximum reach
is 40, measured. Leg 2 has no front buildings (its road runs up the screen).

**Known:** in DOWNTOWN the tall faces lean over the east-west streets; the user will look at that later.

## 2026-11-08 — City lab: street and building scale presets

**Removed 2026-11-08.** The presets became `CITY_STYLES` in config.js (see the entry above); the lab file and its generator are deleted.

**File (was):** `scrapheap-city-lab.html` was a fork. It is **generated** by `python3 tools/make_city_lab.py` from
`index.html`; don't hand-edit it, since it would be overwritten. Re-run the script after any change to
`index.html`. Every patch asserts that it matched exactly once.

**What it does:** **L** (from the menu or in a run) cycles `CITY_PRESETS`, wipes the chunk cache and
restarts at the city gate (`skipToCity`), so the same seed is driven under each preset. A tag at the top
names the live preset; a banner lists its numbers for 3 s.

**How it works:** the city constants (`CITY_W`, `CITY_MCOLS`, `CITY_XST`, `CITY_OUTR`, road widths, pavement,
heights) read from a live `CL` object; `CITY_CUT`/`CITY_PLOT` are mutated in place. Buildings
carry `fsc` (storey scale): both renderers (top-down and raycaster) scale `FLOOR_H`, `WIN_STEP`,
`WIN_A/B` and the window width by it. The outskirts and roadside lots are untouched.

**Why the city looked small** (car 38×20, highway 360):
- every street past the first cut was 70 (`CITY_ROAD_MIN`);
- plots were 44–120;
- a storey was 12, a third of a car, so windows were drawn at half scale.

**Presets, measured within ±1500 of the gate:**

| Preset | Streets (count by width) | Buildings | Median height | Median plot short side |
|---|---|---|---|---|
| CURRENT | 52 of the 64 at 70 | 827 | 51 | 52 |
| WIDE | 90–130 | 335 | 82 | 86 |
| DOWNTOWN | 100–150 | 204 | 261 | 138 |

**Watch when driving:** in DOWNTOWN the tall south faces lean over the east-west streets in the top-down
view. **Next:** the user picks presets, then a district rule (e.g. which preset by chunk) folds into `index.html`.

## 2026-11-07 — Mines on Q

Before this the player had no mine key at all (`dropMine` was only called by enemy AI) and the run
started with 0 mines. Now **Q** (`MINE_KEY` in config.js) drops a mine 20 px behind the car. The run
starts with `MINES_START` = 2, pickups add more (max 3), and there is a 0.5 s cooldown. The mine arms
after 0.6 s, does 40 damage in a 72 px blast, and expires after 16 s. The HUD weapon box shows
"MINE n (Q)". Verified in Chrome by stepping `step(DT)`: Q 2→1, a second Q in the cooldown does
nothing, and an enemy on the armed mine went from 130 to 92 HP. (Headless Chrome throttles rAF, so tests must
call `step(DT)` themselves; `menuT` and frame timers don't advance there.)

## 2026-11-07 — Store: select, then confirm

Every Scrap Saints purchase is now two steps (`storeChoose` in `index.html`): ENTER or a click
selects the row and arms it (gold outline, "BUY X LV n FOR $p?  ENTER yes  ESC no"); a second
ENTER or click on the same row buys (`storeBuy`). ESC or moving the cursor cancels. CONTINUE asks
too ("LEAVE THE GARAGE? you cannot come back"). ESC now only cancels; it no longer leaves the store.
SPACE was removed from the store keys (it's boost, so it was often held on arrival). Input is ignored for
`STORE_LOCK` 0.5 s after the store opens, timed with `performance.now()` so a held fire click or
ENTER can't land. Clicks hit-test the rows (`storeRowY`); a click off the rows does nothing.
Verified in Chrome by driving `onPress`/`storeClick` step by step and checking the cash and levels.

## 2026-11-07 — ESC pauses, never ends a run

In `index.html` `onPress`, ESC during `state==='play'` now toggles `paused` (same as P) instead of
dropping to the title. Quitting a run to the menu is **BACKSPACE while paused**; the PAUSED overlay
says so. ESC still means "back" on the menus, garage, store (continue), comic (skip), map (close) and
the game-over screen. The `#hint` bar lost "ESC menu" and now reads "P / ESC pause".

## 2026-11-07 — The Scrap Saints: bounties + store at the checkpoint

**The user's idea:** the Scrap Saints, a rogue robot organization that hates the robot state, pay you for
every state robot you destroy. Their garage opens at the checkpoint (end of leg 1) as a store; test the
upgrades on leg 2.

- Config `SAINTS` (config.js 3c): bounty batedor $20 / soldado $25 / tanque $35; upgrade level n costs
  100 + 50*n (100, 150, 200...); repair = 40 + 5 per upgrade level owned (kept light, the user's ask);
  dev cash 500.
  Sized from measurement: leg 1 shows 6-13 enemies (avg 10, 8 sims), ~$25 a kill -> ~4 kills = 1 upgrade,
  ~8 = 2, ~12 = 3.
- Only player kills pay (gun/missile/ram via `lastHitBy`); a tanque's own blast has no owner, so its
  victims don't pay. HUD: `$cash` plate under the run plate + a merging "+$N SCRAP SAINTS" toast.
- Store = `state 'store'` drawn over the frozen road (`drawStore`). Rows ARMOR/HEALTH/MACHINE GUN/
  MISSILE (pips, now -> next, price), REPAIR, CONTINUE. UP/DOWN, ENTER buy, ESC continue, click = buy.
  Buying HEALTH adds the 40 to current hull too.
- Run state: `runUp` (levels, starts from config `UPGRADES`), `cash`; reset in startMatch. The checkpoint
  stores `cash` + `up` (written again on leaving the store); `restartFromCheckpoint` restores both and the
  hull to `playerMaxHp()`. The store doesn't reopen on restart. The city checkpoint carries them too.
- Dev mode (I) on the run: **K** = +$500, **J** = open the store anywhere.
- The fixed-step loop now stops stepping the moment state leaves 'play' (store/wreck).
- Verified in Chrome: kills paid $45 (20+25); store opened at camS = bendS0 exactly; health buy
  245->145, max 240, hull +40; armor 6 %; repair $50 refused at $45; restart restored $45 + levels + 240 hull.
  Headless 60 s no errors.
- Still open: mines have no key (see the HP entry); upgrades/cash reset per run.

---

## 2026-11-07 — Legs 70 s each; leg 1 half as dense, no oncoming trucks

- Measured (in-game fixed-step sim, enemies off): before, leg 1 89.9 s, bend 3.4 s, leg 2 91.1 s.
  Now `RUN.LEG1 = 11725` -> **70.0 s**, `RUN.LEG2 = 13580` -> **66.9 s** (leg 2's end snaps to a city chunk,
  CITY_CH 1400 = ~6.5 s steps; the next step up is 73.4 s). Whole run to the gate: 184 s -> 141 s.
- Why leg 1 was brutal: every spawn "from the front" is a yellow tanque, and at wave 1 that's 72 % of spawns.
- `LEG1` in config.js: `DENSITY 0.5` (enemy cap and arrival rate x0.5), `FROM_FRONT false` (everything comes
  from behind, tanque included, as a pursuer: it can catch you, top 209 vs scroll <=185 on leg 1),
  `BACK_MIX [batedor .35, soldado .40, tanque .25]`. Code: `onLeg1()`, `enemyCap()`, `spawnEnemy()`, `updateSpawner()`.
- Measured (one run each, dev mode): leg 1 avg enemies on screen 5.27 -> **3.16**, arrivals 38 -> 11, from the
  front 21 -> 0. Leg 2 unchanged in feel: 8.15 -> 8.23 on screen (cap-bound). Note the wave counter runs on
  distance, so leg 2 now starts at a lower wave (~9 instead of ~12); the wave system is to be redone.
- Both legs still feel too hard to the user; a new wave system is next.

---

## 2026-11-07 — Player HP 200 + upgrade effects (armor/health/gun/missile)

- `CAR_HP` 130 -> **200**. Enemies were `CAR_HP x type.hp`, so they'd have grown too: split out as
  `ENEMY_HP_BASE = 130` (enemies unchanged: batedor 97.5, soldado/tanque 130). Race rivals also use it.
- **Upgrade effects** (config.js section 3b), 4 tracks x levels 0..`UPGRADE_MAX` (6), player only:
  armor = damage cut, `ARMOR_MIN`..`ARMOR_MAX` over levels 1..6 (**6..36 %** since 2026-11-07, was 10..60 %; range is a knob); health +40/level
  (200 -> 440); gun +1.5/level per bullet (7 -> 16); missile +20 % of base/level, linear (34 -> 74.8).
  Current levels live in `let UPGRADES = {armor, health, gun, missile}` (all 0); read at run start / per shot.
  Code: `upgradeLv`, `armorCut`, `playerMaxHp`, `gunDmg`, `missileDmg` next to `damage()`; armor applies in
  `damage()` (cars only; the walker has its own HP).
  Base damages are now named: `GUN_DMG` 7, `MISSILE_DMG` 34.
- **How upgrades are EARNED is not decided yet** (shop? pickups? per-car evolution with the GARAGE?).
- Found: **mines can't be used by the player.** No key calls `dropMine` for the player; the `*` pad is
  collected into `minesLeft` (max 3) but nothing spends it, and the HUD doesn't show it. Run/city enemies have 0 mines.
- Verified in Chrome: base 200/0 %/7/34; armor steps 0,10..60 %; all-6 = 440/60 %/16/74.8, enemy gun stays 7;
  enemies spawn at 97.5/130. Headless 60 s, no errors.

---

## 2026-11-06 — GARAGE: pick your car (classic / aspen / sports / biome)

**In `index.html` itself (the user's call: "in the regular game"); the `index-voxcar.html` test fork was deleted.**
Classic stays the default.

- Menu: START GAME / GARAGE (UP/DOWN or W/S), and "driving: <car>" under the items.
- Garage (`state='garage'`): LEFT/RIGHT browse, ENTER takes it (saved to `localStorage['scrapheap.car']`),
  ESC leaves it as it was, G cycles ASCII mode. The car spins in both visions: the driving camera (left,
  rasterCar at KY) and first person -> ASCII (right, `garageAscii` = asciiBlit's per-cell maths over a small
  offscreen frame; the in-game ASCII path is untouched). Backdrop drawn in code (`drawGarageBg`: corrugated
  wall, lamps, hazard stripe, floor grid); set `GARAGE_BG` in config.js to a painted image and it's used instead.
- Cars: `GARAGE_CARS` in config.js (`vox` = key in assets/voxcars, loaded by `<script>` tags at the top of
  index.html). `GARAGE_MESH` maps them to MODELS (voxel cars appended); `makeCar` sets `mesh` (player ->
  `playerMesh()`), bakes key/draw by `mesh`, so palette/enemy type still follow `model`. rasterCar has lamp/tail.
- Verified: shots of menu + garage (classic/aspen/biome), a run after `garagePick()` drives biome; headless 60 s no errors.
- Open: voxel cars cost ~0.1-0.35 s per bake sheet (vs ~0.02-0.05 s); the evolution/shop idea (cars change with
  upgrades, buy new ones) would hang off GARAGE_CARS + garageSel.

---

## 2026-11-05 — Voxel car proof: CAD model -> voxels -> viewer

**Not integrated into the game, on purpose (the user's call).** Viewer only: `voxcar-viewer.html`.

- Source: `assets/car-model-1/` is a CATIA V5 CAD model (STEP B-rep, not a mesh), 11 named parts.
  **Licence unknown** (looks like a GrabCAD student model), so it's fine for experiments; check the licence before shipping.
- `tools/step_to_stl.py`: STEP -> STL via gmsh (OpenCascade). On WSL gmsh wants libGLU/libOpenGL: `apt download`
  + `dpkg -x` + `LD_LIBRARY_PATH` works without sudo. STLs are in `assets/car-model-1/stl/`.
- `tools/car_voxelize.py <recipe.json> --res N -o out.js`: parts -> roles, wheel instancing, car space,
  surface voxelize + flood-fill solid, exposed faces greedy-merged. Recipe: `tools/cars/aspen.json`
  (the CAD file holds ONE wheel at the origin; centres came from the arches: x -7 / 525, y ±193, z 52 source units).
  Output `assets/voxcars/aspen-{48,64,96}.js` -> `VOXCARS["aspen@64"]` = integer grid quads + lo/vox.
  New roles: `lamp`, `tail` (the viewer's rasterCar has them; index.html's doesn't yet).
- Old `tools/voxelize.py` (also in ../voxel-explore) is the triangle/AABB SAT voxelizer for the voxel engine;
  it was too slow for this and output voxels, not faces.
- **Resolution, measured:** top-down the car is ~50 px long (S=1.6). Res 64 = 0.78 px per voxel, so more voxels
  aren't visible top-down. FP sprite frame is 52 px; if close-ups look soft, enlarge that frame, not the voxel count.
- **Bake cost, measured (node, raster only, 64 frames):** muscle 82 faces 22 ms; aspen@48 1630 faces 119 ms;
  @64 2772 faces 184 ms; @96 5824 faces 375 ms. Per sheet (model+colour). That's the integration cost to fix
  (per-face allocations in rasterCar; precompute normals; or merge coplanar faces across roles) before it goes in the game.
- **Model 2** (`assets/car-model-2/Sports+Car.glb`, a textured low-poly game mesh): recipe `tools/cars/sports.json`,
  output `assets/voxcars/sports-{48,64,96}.js`, in the viewer. The livery lives in a texture, so the tool reads
  the texture colour at every sample point (paint->body, white->accent, black->dark, grey->metal, red->tail;
  `black_lum` 82 on the wheels, whose tread is dark grey), and each voxel takes the majority. `smooth: 1` takes the 3x3x3 majority
  (kills decal speckle), and lamp/tail are exempt so the tail lights survive. Its texture path names a real
  production car (trademark), so it's experiment-only, like model 1's unknown licence.
- **Model 3** (`assets/car-model-3/`, two RARs: `.max` is unusable, `.3ds` extracted to `extracted/` with
  Windows 7-Zip): read by the new `tools/read_3ds.py` (no deps). 732k triangles, all materials black, generic
  names, and an *exploded layout*: the canopy (`Glass`), interior (`Object05`) and side panels (`Plane06/08`) sit
  beside the car, so the recipe `tools/cars/biome.json` uses only the assembled group (nose at -Y, Z up; +Y was a wrong guess, the user caught it) and
  maps roles by material id (710 body, 711 tyre, 714 spokes->metal, 719 tail at the rear...), so it's open-top. Heaviest of the three:
  5520 faces at res 64 (curved shell = many voxel steps). Named after a real brand's concept car; experiment only.
- **(superseded by the GARAGE entry; fork deleted)** In the game (fork): `index-voxcar.html` = index.html + the player drives `biome@64`. Loads
  `assets/voxcars/biome-64.js`; `voxMesh()` appends it to MODELS; makeCar sets `mesh` (player -> PLAYER_MESH,
  others -> model) and the bakes key/draw by `mesh`, so palette/enemy type still follow `model`. rasterCar gained
  lamp/tail. Swap the car via `PLAYER_VOXCAR`. Startup now bakes ~3 heavy sheets (~1 s). Screenshot note: the
  spawn blink (`invuln`) can hide the car; the setup JS keeps `cars[0].invuln=0`.
- Cleanup 2026-11-06 (the user's call): unused sources deleted (CATIA parts, the duplicate STEP zip, .blend/.fbx/.obj/.usdc/
  texture zip, both RARs). What's left is exactly what the recipes read.
- ASCII note: a red body passes the "lit window" test in asciiBlit (pr>120, pr-pb>60) so red cars render as
  `+`/`*`. True of the game's red cars today, too.

---

## 2026-11-06 — NEXT: cars from downloaded 3D models (voxelized)

**His idea (excited: "we have to do it"):** take a 3D car model from the internet, voxelize it
at a reasonable resolution, and import it as a car - in BOTH views and in ASCII.

**How cars render today (explained to him this session):** no images. `buildModels()` makes
4 low-poly meshes from `prism` (extruded outlines) + `wheelMesh`; faces carry ROLES (body,
accent, glass, tyre, metal...), not colours, so one model takes any livery. `rasterCar` is a
small software rasteriser (backface cull, Z-buffer, one fixed `LIGHT`, 2x supersample).
`bakeCarSprites` bakes 32 yaw frames + a white flash row from the driving camera (KY 0.62);
`bakeFpsSprites` bakes the same mesh from a street camera (KY_FPS 0.16) for the raycaster
(`rcSprites` picks the frame from heading vs line of sight). ASCII (`asciiBlit`) is a post-process
over the finished raycast frame (2x3 cells -> luminance picks the glyph, colour tints it), so it
never knows about cars. That's why it all integrates perfectly: two photos of ONE object, then a
filter over everything.

**Plan:**
1. Source: CC0 only (Kenney "Car Kit", Quaternius car packs). No recreations of real
   game/film cars.
2. `tools/` script (Python): load .obj/.glb (trimesh if installable, else a tiny OBJ reader),
   voxelize to ~32-48 voxels long (or decimate the mesh instead - rasterCar takes any polygons),
   map materials/colours to ROLES (body/accent/glass/tyre/metal) so livery still works, emit faces
   (greedy-merge voxel faces, skip hidden ones) as a small JS/JSON data file in car space (+x nose,
   +y right, +z up), scaled to the current cars (~30 long, ~16 wide, wheels on z=0).
3. Load it as an extra entry in `MODELS`; let `ENEMY_TYPE`/the player pick a model index. Both bakes,
   the flash row, ASCII and the map pick it up with no other change.
4. First: a proof with ONE car (player), shown top-down + first person + ASCII (tools/shot.js).
   Watch bake time (~30 ms a sheet today; more faces = slower - measure) and the 52x52 frame size.
- Alternative he also liked: hand-drawn sheets (two views x up to 16 angles per car;
  mirroring halves the work; the unused `assets/car-sprite-sheet.png` seam exists).

**Prompt for the next session:**
> Read HANDOFF.md (top entry). We're importing cars from a downloaded CC0 3D model: voxelize it,
> map its parts to our colour roles, and load it as a car model so it shows top-down, in first
> person and in ASCII. Start with a proof on the player's car.

---

## 2026-11-06 — Story + intro comic script; new logo fitted

- **Logo:** he dropped a new transparent PNG (brush-script SCRAP HEAP, 2140x735) into
  `assets/logo.png`. Fitted with `LOGO_CROP` [0,0,1,1], `LOGO_BLEND` 'source-over',
  `LOGO_WIDTH` 0.80. Logo is settled - don't raise it.
- **Story** (for an intro comic: 2 pages x 4 panels, image-model art, captions typed by the
  game). Script + per-panel prompts: `assets/comic/COMIC_SCRIPT.md`. All nameless. Robots:
  humans gone or super rare. Hero = mechanic robot, an older, weaker model. She = his robot friend,
  **no origin story**. Taken for an **old chip** with code the city needs; kept intact because
  they don't know if they'd break her. Hunters track the CAR (new tech); old models are ignored by
  guards who only fear high-tech androids with energy attacks - the in-world reason for aiCruise.
- **Planned, not built:** upgrades for him AND the car, improvised (HP, ammo, etc.).
- **Intro comic BUILT** (state 'comic', after START GAME, before the run): `COMIC` in config.js
  lists pages/panels (image, caption, caption corner). 2x2 grid of 3:2 panels, revealed one per
  ENTER/click (fade + slight settle), captions typed into a yellow comic box; ENTER finishes the
  typing first; ESC skips; C still jumps to the city. Missing panel = labelled empty frame; a page
  with no images is skipped (page 2 appears once its first image exists). Panels in
  `assets/comic/pageP-N.png`; all 8 panels delivered (2026-11-06). Caption corner `at` = t/b + l/c/r; placed off faces (p1-2 'bl', p2-2 'tc'). The game loads WebP copies (q92,
  `tools/webp.py`; 35 MB of PNG -> 7.4 MB; visually identical at game size, checked side by side);
  the PNG originals stay next to them. New/replaced art: `python3 tools/webp.py <file.png>`.

---

## 2026-11-06 — Outskirts on legs 1-2, city overview on the map, logo v3 prompt

- **Outskirts** (his idea: BSP on the legs too, but sparse - "the edge of the city"; no entry).
  `cityCut`/`cityPlots` now take a parameter set (`CITY_CUT`/`CITY_PLOT` default; proven
  unchanged: `tools/cityprint.js` fingerprint `4ebdc09c` before and after). `makeOutChunk` cuts in
  ROAD coordinates (x = u out, y = s along) with `OUTSKIRTS_CUT/PLOT` and lays it on with
  roadPoint - exact on the straight legs. **Sparsity is INSIDE each block, never whole empty
  blocks** (he rejected vacant blocks): every lot is a paved block, only `BUILT0` 0.30 -> `BUILT1`
  0.65 of its plots get a building (at least one per block), ramping toward the city gate. Dim unmarked streets + pavement blocks
  (`drawOutskirtsGround`), buildings through the old survival renderer. The bend (within
  `OUT_M` = W+60) keeps the old rows. Barrier never opens; nothing collides. Checked: 2348
  outskirts + 47 bend-row buildings over the whole run, 0 overlaps, 0 touching the road.
- **Map, in the city**: the route strip is replaced by a zoomed-out city overview
  (`MAP_CITY_OVERVIEW`, `MAP_OVERVIEW_R` 5200): city, gate wall, leg 2 stub, hunters as dots,
  a box for what the left panel shows. False = no right panel.
- **Logo: LEAVE IT AS IT IS** (the metal wordmark in assets/logo.png). The v3 "route emblem"
  prompt below produced an app icon and he threw it away - he did not want an icon. Don't
  propose logos unless he asks. (Original note:) he disliked the metal wordmark too. Name isn't final, so: `LOGO_WITH_TITLE` draws
  GAME_TITLE under a text-free symbol. New prompts in `assets/LOGO_PROMPT.md` (A: route
  emblem - the L road into the city grid; B: graffiti stencil; C: with the name, once final).
- New tool: `tools/cityprint.js` (city generator fingerprint).

---

## 2026-11-06 — The map (M) and the new logo

- **Logo:** he generated `Scrapheap Neon Metal Wordmark.png` (repo root, kept) -> copied to
  `assets/logo.png`. Black background, not transparent: drawn with `LOGO_BLEND` 'lighter' (black
  adds nothing, glow blends) and cropped to the wordmark band (`LOGO_CROP`).
- **Map (M):** full-screen overlay, pauses the game (`MAP_PAUSES`), M/ESC close, - / = zoom
  (`MAP_RADII`). Style after the-party's minimap minus its paper skin: city blocks flat at true
  size, streets = the floor between them, true plan, north up, neon `MAP_COL`. Left: local map
  (road band, roadside lots, city blocks, barriers with their gaps, walls, pads, hunters as amber
  pips - `MAP_SHOW_ENEMIES`, the-party deliberately hid its monsters - your car outline when on
  foot, you in magenta). Right: the whole run as a strip, driven part lit, checkpoint ring filled
  once earned. Captions: leg + km to the next landmark / THE CITY + distance to your car.
  ~1 ms to draw. **Sound moved to O** (`SOUND_KEY`).

---

## 2026-11-06 — Fixes: side-street dashes, hunters ignore you on foot, C skip, logo

He played the city ("getting good"). Four asks, all built:
- **Side-street lane dashes crawled with the car** (bug). Cause: `drawRoadPath` leaves a
  camera-dependent `lineDashOffset`, and the run draws `drawCityGround` right after it (STREET
  drew the city first, so it never showed). Fix: reset to 0 in `drawCityGround`. Verified: the
  offset used is 0 at every camera position.
- **On foot, the hunters lose interest** (his call: "they stop coming for the player, just
  follow with their lives"). `aiCruise`: grid-aligned street driving at `CITY_CRUISE` 115, turns
  at junctions, U-turn at dead ends, keeps to the middle, brakes for a pedestrian, never fires;
  first move after you get out is away from you. 1.5 s full grace on getting out; bumpers under
  `WALK_RUNOVER_MIN` 70 only shove. Back in the car -> `aiCity` hunting resumes. Measured:
  standing in the street 5 seeds x 40 s -> 1 hit total (was 1-3 per seed, and death before).
- **C** (`SKIP_TO_CITY_KEY`) jumps to the city gate from the menu or anywhere in a run (via the
  city-checkpoint path, pace CAM_VMAX, the wave you'd have).
- **Logo**: menu draws `assets/logo.png` if present (`LOGO_IMAGE`, `LOGO_WIDTH`), else the neon
  text. Prompt for ChatGPT in `assets/LOGO_PROMPT.md`. Name on it is SCRAPHEAP - confirm with him.

---

## 2026-11-06 — index.html: the city joined on (steps 2+3)

He played step 1 to the end ("this is getting good"). Asked: join leg 2 to the city with **no
screen transition**, park and walk, **enemy cars still present and able to enter the small
roads**, and **one key that removes the enemies and brings them back**. Built, not yet played.

- **The gate** is leg 2's end rounded on to a city chunk edge (`ROAD.gateY` = -19600,
  `cityLimitY`). `cityChunks/cityGround` stop there; a wall runs along the city's south edge and
  the highway is shut `CITY_BACK` 2400 behind it (out of sight). Leg 2's lots stop at the gate.
- **The handover** fires when your CAR crosses the gate (`runEvents` -> `enterCity`): `street`
  goes true mid-run, so STREET's free drive, city collision, E to walk all switch on. The city is
  drawn ahead the whole of leg 2's end (run draws both worlds). The camera hands over over
  `CITY_CAM_EASE` 2.4 s: a lagging follow point started at its steady lag + the scroll's offset
  eased out - measured smooth (no lurch, no stall).
- **Hunters**: every enemy uses `aiCity` in the city. Pathing is a **flow field** (`FLOW`, BFS over
  a 170x20u grid round the target, through streets/pavement, across the barrier only at gaps;
  3.5 ms per rebuild every 0.35 s). They follow it downhill, ram, shoot when lined up with a clear
  line. Stuck -> reverse 0.7 s. `citySpawner` keeps `CITY_ENEMIES` 6 around you (900-1500 out,
  off screen), culls past 2600. Leg-2 chasers follow you in (up to 9 at entry).
- **On foot** they hunt the walker: shots (`WALK_SHOT_DMG`) and being run over (`WALK_RUNOVER`)
  hurt; `WALK_HP` 40 bar on the walk HUD; death = "RUN DOWN". Dev mode protects the walker too.
- **N** (`ENEMY_TOGGLE_KEY`) clears every enemy / brings them back, any part of the run.
- **City checkpoint**: entering the city replaces the corner one; ENTER after a wreck puts you at
  the gate in a fresh car.
- New: `tools/oracle.js` (the bit-identical CONVOY/ASCENT check, now a permanent tool).

**Verified:** oracle still identical; full run start -> city headless (handover 181.9 s, no NaN);
9 distinct hunters reached a parked car in 25 s; walker hunted down with damage on; checkpoint;
N both ways on leg 1 and in the city; screenshots of approach / crossing / city / on foot.

**Rough / for him to judge:** hunter count and aggression; leg-2 rumble strips run across the
city's barrier gaps; the city's south wall isn't in the first-person view; no WALK_ARMED yet
(on foot you can only run); `cityGhost` see-through is per car, not per walker.

---

## 2026-11-05 — index.html step 1: menu, leg 1, the corner, leg 2

**Built, not yet played by him.** `index.html` + **`config.js`** (new: every knob, loaded first as
a plain script, so names are unchanged and modders edit one file). Fork of
`scrapheap-madmax-city.html`, which is untouched.

**His answers (2026-11-05):** legs ~90 s each · die after the corner → restart at the corner, full
HP, unlimited · solo only · part 3 HAS car enemies (by density) in v1 · magenta `#ff2bd6` + cyan
`#22f0ff` on `#07040f` · build order: (1) menu + legs + corner + checkpoint ← done, (2) city
arrival, (3) city enemies · zoom: leg 1 keeps CONVOY's 0.8, ease to 0.72 through the bend;
**if the ease looks bad, fix it at 0.8** (`RUN.ZOOM_V = 0.80` in config.js).

**How the corner was solved:** the road is a path (`ROAD`, `makeRoad/roadFrame/roadPoint/
roadProject`: s along, lat to the right, curvature k). Every `vertical ?` branch in survival code
now works in (s, lat): scroll (`camS`, `camLat`, `placeCam`), soft walls, spawner + cull, pads,
all three AIs, spin latch, collision (`trackProject` wraps `roadProject`), road/walls/posts/lots
drawing. CONVOY and ASCENT are single-straight roads. `vertical` now only matters to STREET.
- In the bend the scroll is measured in **your lane** (`laneScale`), else the outside line is
  (R+180)/R longer. Corner radius `RUN.CORNER_R` 420, ~3.3 s.
- Look-ahead along the road replaces ASCENT's `VCY_BIAS` (`RUN.VIEW_BIAS_V`), so it turns with it.
- Zoom eases per frame via `setZoom` (no rescale). Car sheets are baked only at the two leg zooms
  (`homeZoom`, `prebakeSheets` at run start; a bake is ~30 ms) and drawn scaled in between; ground
  tiles use a pattern transform.
- Walls: a stretch whose outward normal faces down-screen draws in front of the cars.
- Inside-of-bend lots are dropped (bare dirt there - a rough edge).
- No spawns within `RUN.QUIET` 650 of the bend. Entering the bend = `checkpoint` + banner.
- End of leg 2 (`ROAD.gateS`) → "CITY AHEAD" over screen (placeholder for step 2).

**Verified:** oracle - seeded bot runs of CONVOY and ASCENT are **bit-identical** to the old file
(60 s dev, 120 s with damage). Path maths vs hand cases + 20k round trips (2e-12). Full run
headless: leg 1 89.9 s, bend 3.3 s, leg 2 89.3 s, gate reached, no NaN. Checkpoint restart both
ways. Real Chrome screenshots through the bend: it reads; scaled sprites fine.

**For him to judge:** difficulty - waves reach 25 by the gate (spawner caps at wave 7/13, so leg 2
is all max); zoom ease feel; menu font (bold monospace, not the party's Deathly face).
Dev stages remain on the menu's digit keys 1-4 (not shown). DEV_MODE off by default (I toggles).

**Next (step 2):** at `ROAD.gateS` hand over to STREET: stop scroll/spawner, turn on BSP chunks
offset to start at the gate (leg 2 is on x = 0 like STREET's highway), E to walk.

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
