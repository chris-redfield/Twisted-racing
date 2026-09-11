# SCRAPHEAP CIRCUIT

A vehicular combat game in the spirit of **Twisted Metal** crossed with **Rock 'n' Roll Racing**:
four armed cars, a fixed-angle pixel-art view, and weapons that stay live whether you are
brawling in an arena or running laps.

Two builds, each a single self-contained HTML file. No dependencies, no build step, no server.

| File | What it is |
| ---- | ---------- |
| `scrapheap-circuit-alpha.html` | **the driving game** — BRAWL and RACE, you steer |
| `scrapheap-loop-alpha.html` | **SCRAPHEAP LOOP** — a Loop Hero–style auto-racer, you build the track instead of driving it |

---

## Running it

Open either HTML file in any modern browser (double-click it, or drag it onto a browser window).
Audio only starts after the first keypress, which is a browser rule, not a bug.

If you prefer a local server (some browsers are fussy about `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/scrapheap-circuit-alpha.html
#           or http://localhost:8000/scrapheap-loop-alpha.html
```

## Controls — scrapheap-circuit (the driving game)

| Key | Action |
| --- | --- |
| `↑` / `W` | throttle |
| `↓` / `S` | brake / reverse |
| `←` `→` / `A` `D` | steer |
| `Shift` | handbrake (kills lateral grip — this is how you drift) |
| `Space` | cannon |
| `X` / `K` | missile |
| `C` / `L` | drop mine |
| `Enter` | menu select / restart after a match |
| `Esc` | back to menu |
| `R` | cycle render scale (1× / 2× / 3×) |
| `F` | fps + entity counter |
| `M` | mute |
| `P` | pause |

## Controls — scrapheap-loop (the auto-racer)

You never steer. Everything is mouse-driven; the keys are shortcuts.

| Input | Action |
| --- | --- |
| click a part, then click a slot | bolt that part onto the loop |
| right-click / shift-click a part on the loop | salvage it for half its cost |
| `1`–`9` | pick a part from the palette |
| `Tab` | swap BOARD view (whole loop) and CHASE view (behind the car) |
| `Space` / `P` | pause — you can keep placing while paused |
| `T` | game speed 1× / 2× / 3× |
| `Esc` | drop the held part, or cash out and end the run |
| `R` `F` `M` | resolution / fps / mute, same as the other build |

## Modes and levels

**BRAWL** — four cars in a closed arena, first to `FRAG_LIMIT` (8) kills wins.
- *Scrapyard* — walled rectangular yard (1800×1400), heavy cover: walls, crates, a central core, explosive fuel drums.
- *Thunder Bowl* — oval dirt stadium (1760×1260), very little cover. The danger is the floor: eight open pits that swallow cars. A pit death costs you nothing (no frag penalty); a plain self-destruct costs one frag.

**RACE** — three laps on a closed circuit, weapons live, pickups on the racing line.
- *Dust Oval* — superellipse circuit with walls, rumble strips and a start/finish line.
- Second race level is a locked placeholder.

## The cars

Four drivers, each with its own low-poly mesh and colour. You always drive **HOGG** (car 0).

| # | Name | Colour | Mesh |
| - | ---- | ------ | ---- |
| 0 | HOGG | orange `#d94f2b` | muscle |
| 1 | VULTURE | blue `#57b7d6` | interceptor |
| 2 | GRAVA | green `#8ad14a` | buggy |
| 3 | MANDIOCA | yellow `#e0b73c` | gun truck |

Stats are currently identical across cars (130 HP) — the meshes are cosmetic for now.

## SCRAPHEAP LOOP — what the mode is

Rock 'n' Roll Racing crossed with Loop Hero. You are not the driver, you are the promoter of a
televised death race. Your car runs the circuit on the same autopilot the AI racers use, forever.
You watch the whole loop at once and build the show around it.

- **Four slots per sector**, sixteen sectors: two on the asphalt (entry and exit) and one on each
  verge. Road parts change how the car drives; verge parts shoot at it, spawn rivals, pay out, or
  patch it up.
- **One currency, SCRAP.** It buys parts *and* car upgrades, so every scrap spent on a hazard is
  scrap not spent on armour — and hazards are what generate scrap.
- **HEAT is the escalation dial.** Every dangerous part adds heat; safe parts (boost strips,
  repair bays) subtract it. Heat multiplies every payout *and* every rival's health and guns.
  Playing it safe costs you twice. Each lap adds heat on its own.
- **You bank nothing if the driver dies.** `Esc` cashes out on your terms.
- Past lap 3 the house sends its own rivals in whether you built a garage or not, so idling on a
  safe loop is never a strategy.

**Synergies** (Loop Hero's adjacency trick):

| Combo | Effect |
| --- | --- |
| FLOODLIGHT | +40% payout in its sector and both neighbours (they stack) |
| OIL SLICK then JUMP RAMP, same sector | ×2 payout — the car slides onto the ramp sideways |
| TURRET NEST on both verges of one sector | CROSSFIRE: both fire twice as fast |

**Upgrades** bought any time from the left rail: ARMOUR (+25 max hull), ENGINE (+8% top speed),
GUNS (+20% rate and damage), PATCH (repair 45 now). Each purchase raises its own price ×1.7.

## Combat rules at a glance

- **Cannon** — 7 damage, 0.14 s cooldown, mild spread (tighter for the player), slight recoil.
- **Missile** — 34 damage, 0.85 s cooldown, carried ammo (start 2 in brawl / 1 in race, cap 5).
- **Mine** — arms after 0.6 s, lives 16 s, carried ammo (start 1, cap 3).
- **Ramming** — damage scales with closing speed and favours whoever drove into the hit.
- **Barrels** — explode when shot or rammed hard, and chain off each other.
- **Pickups** — pads respawn an item every 7–11 s: health `+35`, missile `+2`, mine `+1`.
- **Death** — 2.6 s respawn; the kill is credited to whoever last damaged you.

---

## How the code is laid out

Everything lives in one `<script>` in `scrapheap-circuit-alpha.html` (~2000 lines), split by
banner comments. Grep for the banner to jump to a section:

```
constants        virtual resolution, arena size, tuning knobs
utils            clamp/lerp/rnd/angDiff/shade/rrect
audio            Snd — WebAudio synth, no sample files
input            key state + onPress (menus, hotkeys)
ground tile      procedurally generated dirt/asphalt patterns
world state      cars, shots, mines, fx, skids, pads, blocks, cam, state
                 makeArena() builds the two brawl levels
track            makeTrack/trackProject/trackPoint — the race circuit
menu data        MODES and LEVELS tables (this is where new levels get listed)
projection       toScreen() — world -> screen
collision        trackCollide / blockCollide / blockHitPoint
effects          particles/explode/damage
weapons          fireCannon/fireMissile/dropMine
car update       updateCar — physics, input, pit falls, lap counting
AI               aiThink -> aiCombat / aiRace, whiskers, recovery
projectiles      updateShots
hazards          updateHazards (pits)
pickups          ITEMS + updatePads
drawing          ground, pits, track, walls, blocks, shadows
car models       low-poly meshes (prism/wheelMesh/buildModels)
(rasteriser)     software triangle rasteriser + bakeCarSprites
HUD              drawHUD, drawTitle, drawOver
frame            step() fixed timestep, render(), frame() loop
```

### Rendering model

The look is a **fixed axonometric view faked in 2D canvas**. There is no 3D camera at runtime.

- World is flat XY. Screen Y is squashed by `KY = 0.62`, giving a ~38° viewing angle.
  Height (`z`) is subtracted from screen Y, so anything tall "stands up" out of the ground.
- The game renders to an internal canvas at `480×270 × S` (`S` = 1, 2 or 3, toggled with `R`)
  and is upscaled with `image-rendering: pixelated`. All HUD and menu coordinates are in the
  virtual 480×270 space.
- Depth sorting is **painter's algorithm on world Y** for blocks, cars and shots. Walls are the
  exception: they are split into a *far* half and a *near* half so cars correctly drive behind
  the top of the arena and in front of the bottom.

### Car sprites are baked, not drawn

`buildModels()` defines four low-poly meshes in car space (`+x` nose, `+y` right flank, `+z` up),
built from `prism()` extrusions and `wheelMesh()` cylinders. At startup `bakeCarSprites()` runs a
**software triangle rasteriser with a Z-buffer** (not a painter's sort — a flat body top would
otherwise cover the windshield) at 2× supersampling, producing a sprite sheet of:

- **32 yaw frames** across, and
- **2 rows**: normal, and a white silhouette used for the damage flash.

Faces are coloured by *role* (`body`, `accent`, `shadowed`, `dark`, `glass`, `tyre`, `metal`)
so one mesh recolours per driver, with lambert shading from a fixed `LIGHT` vector.
Sheets are re-baked whenever the render scale changes.

**Hook for external art:** drop a loaded `Image` into `CAR_SHEETS[carIndex]` with the same frame
layout and `bakeCarSprites()` returns it untouched — that is the seam for hand-drawn or
Blender-rendered cars.

### Physics

Simple forward/lateral decomposition per car, fixed 60 Hz step (`DT = 1/60`, accumulator capped at
5 substeps per frame):

- `MAXF 232` forward / `MAXR 95` reverse / `ACC 330` acceleration
- lateral grip `6.4`, dropping to `1.7` while handbraking (the drift)
- turn rate `2.75 rad/s`, scaled by speed (`turnAuth`) and inverted in reverse

### AI

`aiThink()` dispatches to `aiCombat()` or `aiRace()`.

- **Whiskers** — five forward feelers whose reach grows with speed, used to steer around blocks and pits.
- **`openDirection()`** — a small potential field pushing away from walls, blocks and hazards.
- **Stuck recovery** — if a bot moves less than 24 units in half a second while in contact with
  something, `beginRecovery()` picks reverse or forward based on what is clear and backs it out.
- Combat AI has a mild aggro bias toward the player (distance weighted ×0.72).

### Audio

`Snd` is a self-contained WebAudio synth — no audio files. The engine is a sawtooth + square pair
through a lowpass filter, modulated by rpm and slide; everything else (shots, explosions, pickups)
is generated blips and filtered noise bursts.

---

## Conventions

- **One file per build.** Each game is a single portable HTML file. Keep it that way unless we
  decide together to split it — the payoff is that any build is one attachment.
- **The loop build is a fork of the circuit build's engine,** not a shared import, so that changes
  to one can never break the other. Everything above the `LOOP MODE` banner in
  `scrapheap-loop-alpha.html` is the race engine; everything below it is additive. If the mode
  proves out, that is the moment to unify — not before.
- **No dependencies, no build step.**
- Section banner comments (`// ---- name`) are the navigation system. Keep them.
- Comments explain *why* a number or an ordering exists, not what the line does.
- Units are world units; screen conversion happens only in `toScreen()` and the `S`/`KY` scaling.
- Tuning constants live near the top of their section, not inline in the middle of a loop.

## Assets

- `assets/car-sprite-sheet.png` — 1040×520 generated reference sheet. **Not currently loaded by
  the game**; it exists as a starting point for replacing the runtime-baked sprites.

## Testing without a browser

`tools/headless.js` stubs out the canvas and runs a build in node, so a session can prove a change
still loads, steps and renders before anyone opens a browser. Draw calls are no-ops — it checks
that the code *runs*, not that it looks right.

```bash
node tools/headless.js scrapheap-loop-alpha.html 60          # 60 simulated seconds
node tools/headless.js scrapheap-circuit-alpha.html 20 arena 2
```

`require('./tools/headless.js').load(file)` returns `{ E, tick, run }`. `E('expr')` evaluates in
the game's own scope — top-level `let`/`const` never reach the global object, so that hatch is the
only way to read or poke state. This is how the loop mode's balance was tuned.

## Files

```
scrapheap-circuit-alpha.html   the driving game (BRAWL + RACE)
scrapheap-loop-alpha.html      SCRAPHEAP LOOP, the auto-racer
tools/headless.js              run either build in node, no browser
assets/car-sprite-sheet.png    generated sprite reference (unused at runtime)
README.md                      this file — stable project docs
PROJECT.md                     rolling status and session log (read this first each session)
```
