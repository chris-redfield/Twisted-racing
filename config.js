// =============================================================================
//  SCRAPHEAP - config.js : every knob worth turning, in one place
// =============================================================================
// index.html loads this file first, so every name below is visible to the game
// exactly as written here. Change a number, reload the page - that's all.
//
// Units: distances are WORLD UNITS (the car is ~38 long, the road 360 wide),
// speeds are units per second, times are seconds, angles are radians unless the
// name says DEG. The HUD shows metres: see RUN.UNITS_PER_M.
//
// `const` = read once at load. `let` = a starting value the game can also change
// while you play (the key that changes it is in the comment).
//
// Don't rename anything here: the game looks these up by name. Adding a new
// name does nothing until the game reads it.
"use strict";

// -----------------------------------------------------------------------------
// 1. THE RUN - menu -> horizontal leg -> the corner -> vertical leg -> the city
// -----------------------------------------------------------------------------
// The road is one path: leg 1 runs left to right (+x), a quarter circle turns it
// to run up the screen (-y), and leg 2 carries straight on into the city.
// Lengths are measured along the middle of the road. The scroll starts at CAM_V0
// and creeps up to CAM_VMAX. Measured in game (2026-11-07): LEG1 11725 = 70.0 s,
// the bend 3.7 s, LEG2 13580 = 66.9 s. Leg 2's end is rounded on to the next city
// chunk (CITY_CH, ~6.5 s of road), so it moves in steps: 13580 -> 66.9 s, anything
// up to 14980 -> 73.4 s. (Before: 15500 / 18800 = 89.9 s / 91.1 s.)
const RUN = {
  LEG1:          11725,  // horizontal survival, start -> corner (70 s)
  CORNER_R:        420,  // radius of the 90-degree bend (middle of the road); the
                         // inside edge is CORNER_R - ROAD_HW, so keep it > ROAD_HW
  LEG2:          13580,  // vertical survival, corner -> city gate (66.9 s, see above)
  QUIET:           650,  // no enemies spawn this close (before/after) to the corner
  UNITS_PER_M:      10,  // HUD distance: world units per metre shown
  // the framing of each leg. Leg 1 is CONVOY's, leg 2 ASCENT's; through the bend
  // the game eases from one to the other.
  ZOOM_H:         0.80,  // world scale on the horizontal leg
  ZOOM_V:         0.72,  // ...and the vertical leg (smaller = see more road)
  VIEW_BIAS_V:    0.66,  // vertical leg: where your car's spot sits down the screen
                         // (0.5 = centre; higher = see further up the road)
  CRUISE_BAND_H:    74,  // W/S trims your speed +/- this around the scroll pace
  CRUISE_BAND_V:   100,
};

// -----------------------------------------------------------------------------
// 2. THE ROAD, THE SCROLL AND THE FRAME
// -----------------------------------------------------------------------------
const ROAD_HW   = 180;           // half-width of the drivable road (barriers at +/- this)
const CAM_V0    = 150;           // starting forced scroll speed (world units/s)
const CAM_VMAX  = 214;           // top forced scroll speed
const CAM_RAMP  = 0.5;           // how fast the scroll speeds up (units/s per s)

// The ends of the frame push back rather than blocking: carry a little way past
// the line and get eased home. K is how hard it pulls, C takes the bounce out of
// the return, MAX is a hard backstop so nothing can throw the car out of frame.
const WALL_K = 4, WALL_C = 3, WALL_MAX = 80;
// The most the FRONT line may put you below the scroll pace while it reels you in.
// Without it the spring pays for the ground a boost gained by taking the speed back
// out of the car - measured at 233 -> 31 against a 153 scroll, which handed you
// straight back to the pack and made using the boost a mistake. The frame is
// allowed to stop the gap OPENING as hard as it likes (that part is unchanged, and
// is what holds you at the line when you simply hold W); it is not allowed to drive
// the car slower than the road. The backstop below still makes leaving impossible.
const WALL_REEL = 30;
// how much of the visible road, front and back, stays out of bounds for the car
const FRAME_FRONT_PAD = 60, FRAME_BACK_PAD_H = 60, FRAME_BACK_PAD_V = 40;

// BOOST - one charge, spend it, wait for it. SPACE, the player's car only.
//
// In the survival stages the player's speed is a REGULATOR (see updateCar): W/S
// pick a target inside CRUISE_BAND around the scroll pace and the throttle serves
// it. So a boost is not a force added to the car - it is a higher target, plus the
// ceiling and the acceleration to reach it. Shoving velocity in directly is the
// thing the stuck-car notes say never to do.
//
// It also needs somewhere to GO. Holding W already parks you near FRONT_MAX, so a
// boost that only raises the target would spend itself against the frame's front
// spring and gain no ground. BOOST_ROOM lends the frame extra room while it burns,
// eased in and out through c.boostEase - a step back to FRONT_MAX at the end would
// leave you 90 units "over" and get slapped, which is the hard wall all over again.
const BOOST_ADD   = 95;          // forward target/ceiling on top of the cruise band
const BOOST_ACC   = 700;         // acceleration while it burns (CAR_ACC is 330)
const BOOST_TIME  = 1.0;         // seconds one charge burns for (was 0.9 - too short to feel)
const BOOST_COOL  = 10;          // seconds to recharge from the end of the burn, at BOOST level 0
                                 // (the BOOST upgrade cuts it: see BOOST_COOL_PER_LEVEL in 3b)
const BOOST_ROOM  = 130;         // extra front-of-frame room while it burns
// how fast boostEase moves, as a multiplier per second. In hard, so the room is
// there before the car is; out slow (~3s), so the front line never retreats out
// from under a car that is still ahead of where it used to be.
const BOOST_EASE_IN = 0.001, BOOST_EASE_OUT = 0.37;

// -----------------------------------------------------------------------------
// 3. THE PLAYER'S CAR
// -----------------------------------------------------------------------------
const CAR_HP  = 200;             // the player's hull points, before HEALTH upgrades (was 130)
const ENEMY_HP_BASE = 130;       // enemies' hull: ENEMY_TYPE.hp multiplies this (kept apart from CAR_HP,
                                 // so the player can get tougher without the enemies following)
const CAR_TOP = 232;             // top speed off the scroll (city, and enemies x pace)
const CAR_ACC = 330;             // acceleration
// base weapon damage, the same for everyone (enemies never get upgrades)
const GUN_DMG     = 7;           // machine gun, per bullet (one every 0.14 s)
const MISSILE_DMG = 34;          // missile, at the centre of its blast (radius 62, falls off to the edge)

// -----------------------------------------------------------------------------
// 3b. PLAYER UPGRADES - the effects. HOW they are earned isn't decided yet.
// -----------------------------------------------------------------------------
// Four tracks, each with levels 0..UPGRADE_MAX. Level 0 = no upgrade. Only the
// player's car uses them. UPGRADES below holds the current levels; set a number
// there to try a level out (it is read when a run starts).
//
//   armor    cuts every hit the car takes by a percentage. Level 1 = ARMOR_MIN,
//            level UPGRADE_MAX = ARMOR_MAX, evenly spaced between
//            (6/12/18/24/30/36 % as set). Change the range here, nothing else.
//   health   + HEALTH_PER_LEVEL hull points each (6 x 40 = 240 more, so 440 max)
//   gun      + GUN_DMG_PER_LEVEL machine-gun damage per bullet each
//            (6 x 1.5 = +9, so 7 -> 16 per bullet)
//   missile  + MISSILE_DMG_PER_LEVEL of the BASE missile damage each, added, not
//            compounded (6 x 20% = +120%, so 34 -> 74.8)
//   boost    - BOOST_COOL_PER_LEVEL seconds off the boost recharge each
//            (6 x 1s = 10s -> 4s). The recharge is what limits the boost, not its
//            strength: the burn is 1s, so at level 0 you hold a charge 9% of the
//            time. Raising BOOST_ADD instead would spend itself against the
//            frame's front spring and gain no ground - see section 2.
//
// Armor and health stack: what it takes to wreck the car is HP / (1 - armor).
// Base 200; all 6 health + all 6 armor = 440 / 0.64 = 687, 3.4x the base car
// (with the old 10..60 % armor it was 1100, 5.5x - which is why it came down).
const UPGRADE_MAX = 6;
const ARMOR_MIN = 0.06, ARMOR_MAX = 0.36;   // +6 % a level (was 10..60 %)
const HEALTH_PER_LEVEL      = 40;
const HEAL_PICKUP = 0.175;          // green square heals this share of max hull: 35 at 200, 56 at 320, 77 at 440
                                    // (was a flat 35). Idea for later: heal power as its own upgrade.
const GUN_DMG_PER_LEVEL     = 1.5;
const MISSILE_DMG_PER_LEVEL = 0.20;
const BOOST_COOL_PER_LEVEL  = 1.0;  // seconds off BOOST_COOL a level (10 -> 4 at level 6)
let   UPGRADES = { armor:0, health:0, gun:0, missile:0, boost:0 };   // levels every run STARTS with (testing)

// -----------------------------------------------------------------------------
// 3c. THE SCRAP SAINTS - cash per kill, and their garage at the checkpoint
// -----------------------------------------------------------------------------
// A rogue robot outfit that pays you for destroying state robot property. Every
// enemy YOU wreck (gun, missile, ram) pays its BOUNTY. At the checkpoint (the
// start of the bend) the game stops at their garage: spend it on upgrades
// (section 3b) or a repair, then carry on into leg 2. Wreck on leg 2 and you
// restart at the checkpoint with what you left the garage with.
//
// Leg 1 shows ~6-13 enemies (10 on average, measured), ~$25 a kill, so ~4 kills
// buy one upgrade, ~8 buy two, ~12 three.
const SAINTS = {
  BOUNTY: { batedor:20, soldado:25, tanque:35 },   // cash per kill, by enemy type
  PRICE0:        100,  // an upgrade's first level...
  PRICE_STEP:     50,  // ...and every next level of the same track costs this much more (100, 150, 200...)
  REPAIR0:        40,  // a full repair...
  REPAIR_PER_LV:   5,  // ...plus this for every upgrade level you own, all tracks (light on purpose)
  DEV_CASH:      500,  // dev mode (I): K adds this much; J opens the garage anywhere on the run
};

// -----------------------------------------------------------------------------
// 3c-bis. HOW SHARP THE SENTRY'S FIRST-PERSON SPRITE IS
// -----------------------------------------------------------------------------
// rasterCar's `vsc` is pixels per world unit. bakeFoeSheet used to pass 1, so the
// 22-unit sentry baked into a 26-pixel sprite and was then MAGNIFIED by distance:
//
//     distance   drawn    magnification of a 26 px sheet
//       200 u     16 px   none (the sheet was bigger than needed)
//       120 u     27 px   x1.0
//        60 u     54 px   x2.1
//        25 u    129 px   x5.0
//        18 u    179 px   x6.9   <- FOE_AI.STOP: where a provoked sentry stops
//
// So the closer one got, the worse it looked, and at arm's length it was an
// unreadable smear. Nothing was wrong with the ART: sentry@96 is voxelised at
// res 96 and the bake was throwing three quarters of it away.
//
// 4 is the CEILING, not a taste: it makes a 103 px frame, which is the model's own
// 96-voxel resolution. Past that there is nothing left to extract and you would
// have to re-voxelise. 3 (74 px) already looks close; 1 does not.
//
// What it costs, all of it ONE-OFF and shared by every sentry alive (the sheet is
// keyed by model name, so 220 of them cost what one does):
//        vsc | frame  | sheet    | memory
//          1 | 15x26  | 240x156  | 0.14 MB   <- what this used to be
//          2 | 30x52  | 480x312  | 0.57 MB
//          3 | 44x78  | 704x468  | 1.26 MB
//          4 | 59x103 | 944x618  | 2.23 MB   <- here
// (measured off sentry@96: R 6.31, zmax 22.0, through foeSheetNew's own formula)
// Per FRAME it costs nothing extra: the blit runs with imageSmoothingEnabled
// false, so it is destination-bound, and the destination size does not change.
// The bake is lazy per pose (foeSheetEnsure), so it is spread over the first few
// poses rather than paid in one hitch.
//
// NOTE it is paid whether or not ASCII is on. asciiBlit is a post-process that
// reads the finished pane back, so the billboard is drawn the same either way -
// G only decides whether the detail survives.
const FOE_VSC = 4;

// The cars have the same problem in first person, and worse. bakeFpsSprites also
// rasters at 1 px per world unit, and a car is magnified HARDER than a sentry
// because you can get right up against one:
//        600 u  34 px  (downscaled)       80 u  117 px  x2.3
//        300 u  56 px  x1.1               40 u  234 px  x4.5
//        150 u  71 px  x1.4               20 u  468 px  x9.0
//
// But a car sheet is NOT the sentry's single shared one - it is keyed by mesh AND
// colour, so there is one per livery, and the frame is ceil(52*c.scale*vsc) with
// c.scale running to 1.5 in play. MEASURED on foot in the city, 7 cars present,
// 4 distinct mesh|colour sheets, frames 52/78/42/79 at vsc 1:
//        vsc | frames (4 sheets) | total
//          1 | 52/78/42/79       |  4.1 MB   <- what it was
//          2 | 104/156/83/157    | 16.3 MB
//          3 | 156/233/124/235   | 36.4 MB   <- here
//          4 | 208/311/165/313   | 64.7 MB
// So vsc 4 is cheap for the sentry (ONE shared sheet, 2.23 MB) and expensive for
// the cars - 65 MB of canvas. 3 is the compromise. Before raising it to 4, do the
// padding fix below instead: it buys about 4.6x and would put vsc 4 near 14 MB.
//
// AND IT IS ONLY PAID WHEN ASCII IS OFF. asciiBlit quantises the pane into glyphs,
// so the extra detail cannot survive it - there is no reason to hold a sharp sheet
// while G has ASCII on. carVsc() returns 1 in ASCII mode, the sheet key carries the
// vsc, and pressing G drops the cached sheets so only one set is ever in memory.
// The cost of that is a rebake when you toggle G, which is the right trade: you
// pay a hitch on a keypress instead of 20 MB all the time.
//
// Unlike the sentry's, a car sheet bakes all 64 frames AT ONCE (the sentry's is
// lazy per pose), so the hitch is real. If it bites, the cheap fix is not a lower
// vsc but the frame. A car mesh is 35.0 long x 18.2 wide x 11.0 tall, which at
// KY_FPS projects to about 35x14 - inside a 52x52 cell. That is ~18 px of padding
// above the roof and ~20 below the contact patch, about 4.6x more sheet than the
// car needs. Sizing the cell from the mesh the way foeSheetNew does for a figure
// would make vsc 4 cost less than vsc 2 does now. NOT DONE: ay = round(fh*0.62)
// is the contact patch the wheels stand on, so the anchor has to be rederived
// from the mesh at the same time or every car floats. Worth doing deliberately.
const CAR_VSC = 3;

// -----------------------------------------------------------------------------
// 3d. THE SENTRY'S RIG - posing the voxel model (foe.js)
// -----------------------------------------------------------------------------
// The enemy is one voxel model carved from one drawing (tools/sprite_voxelize.py),
// so it has no animation of its own. Instead the faces are split into groups by
// where they sit in the model, each group is rotated about a pivot, and the result
// is baked like any other frame. Both views get it for free, because both bakes
// call the same posing function.
//
// LEGS ONLY for now. Arms are a worse bet on this model: the sentry was drawn with
// its arms against its body, so the carve merged them into the torso slab and an
// "arm" group would drag part of the chest with it. Legs sell a walk anyway.
//
// Measured off sentry@96: the model is 22.0 tall, 12.4 wide, 4.4 deep; the legs
// part below z = 11. If a future enemy is a different shape, these move.
const FOE_RIG = {
  POSES:     6,      // frames in the cycle. 6 reads at the sizes this draws at
  YAWS:     16,      // directions baked per pose. The cars use 32, but a car turns
                     // constantly and is read at speed; a sentry turns rarely and
                     // is 9 character rows tall, where 22.5-degree steps are not
                     // visible. Bake cost is POSES x YAWS x faces, so this halves
                     // it - raise it if a turning sentry ever looks like it pops.
  HIP_Z:     11.0,   // world units: the height the legs swing about
  KNEE_Z:     6.5,   // ...and the height the shin folds back at
  SWING:     0.35,   // radians at the extreme of the stride (20 degrees)
  KNEE:      0.50,   // radians the knee folds at mid-swing (29 degrees).
                     // Not decoration: with a straight leg the cycle is a pure
                     // scissor, and sin() sampled at POSES points then gives
                     // mirror-image duplicates - 6 poses that are really 3. The
                     // knee bends only on the leg swinging FORWARD, which breaks
                     // that symmetry and makes every pose distinct.
  STRIDE:    26,     // world units walked per FULL cycle - this is what stops the
                     // feet skating, so it belongs with WALK_SPD, not with a timer
  WALK_SPD:  30,     // units/s when a sentry is walking (the player walks at 46)
};

// -----------------------------------------------------------------------------
// 3e. THE SENTRIES: THEIR AI, AND HOW MANY THERE ARE
// -----------------------------------------------------------------------------
// The rules, all the user's and all settled (HANDOFF 2026-11-09), so that nobody
// re-litigates them from the code:
//   * scattered over the whole city, not spawned at a point
//   * each one is on its OWN. Shooting one does not turn the others on you
//   * they IGNORE you to begin with. That is the comic's rule, not a stub: he is
//     an old model and the city's guards are beneath caring
//   * being shot is what provokes one - that one, nobody else
//   * a provoked sentry FOLLOWS you, and NEVER shoots (asked and settled: the
//     brief's "they just follow you for now" is the rule, in the car and out of it)
//   * it gives up when you get far enough away, and then ignores you again
const FOE_AI = {
  CHASE_SPD: 52,    // units/s once provoked. He WALKS at 46 and RUNS at 92, so a
                    // sentry out-paces a stroll and loses a sprint - which is the
                    // whole reason GIVE_UP means anything. The rig does not care
                    // what this is: the walk phase runs on DISTANCE, so the feet
                    // keep still against the ground at any speed.
  TURN:     3.2,    // rad/s its heading can swing, so it arcs round a corner
                    // instead of snapping to face you
  NEAR:     170,    // inside this, with nothing in the way, it comes straight at
                    // you instead of following the street grid (aiCity's number)
  STOP:      18,    // ...and stops here, at arm's length, rather than treading on you
  GIVE_UP:  900,    // loses you past this. The pistol reaches 1600, so you can
                    // always start a fight from outside the range it will follow
                    // you to - which is what makes the first shot a decision.
  LOSE_T:    1.2,   // but only once it has been that far away for this long. THIS
                    // is the anti-flicker, not a second wider radius: a radius
                    // still flickers when you jog along its boundary, where a time
                    // debounce cannot. And giving up is one-way - only another
                    // bullet re-provokes it - so afterwards there are no two
                    // states left to oscillate between.
  STUCK_T:   1.0,   // provoked, but gone nowhere for this long: shoulder past
  STUCK_D:   10,    // "nowhere" being less than this far in that time
};

// How many there are, and where they stand. Density is drawn PER CITY BLOCK from
// a normal distribution rather than laid down at a flat rate, so some blocks are
// busy and most are empty. Deliberately thin to start - the user's words were
// "make it small for now, otherwise it will be crowded" - and MEAN is the one
// number to raise.
//
// A block is one BSP lot, ~500-750 units a side, and a chunk of city holds about
// 14 of them per side. MEAN 0.22 with SD 0.80 rounds and clamps to roughly: six
// blocks in ten empty, three with one sentry, one with two or three.
const FOE_POP = {
  MEAN:      5,    // sentries per block, on average. THIS IS THE KNOB: it is the
                   // only number that changes how many there are. Measured along
                   // the road, averaged over four spots (live = bodies within
                   // KEEP, view = most visible in one first-person look):
                   //    MEAN  MAX | live  nearest  <300  <600  in one view
                   //     0.4   3  |  15     256     1.3   2.3      7
                   //     0.8   3  |  20     293     1.3   3.0      8
                   //     1.2   4  |  24     277     0.8   2.8     11
                   //     1.8   5  |  38     253     1.8   4.8     16
                   //     2.5   6  |  60     249     3.3   8.0     23
                   //     3.5   8  |  80     190     5.0  11.0     28
                   //     5    12  | 148     200     3.5  14.3     28   <- here
                   //    25    60  | 377     180    (a swarm - see below)
                   // The rows up to 3.5 were taken at ROADSIDE 0.6; the MEAN 5
                   // row is at 0.45, which is why its <300 is LOWER than the
                   // 3.5 row's even though it has twice the bodies - a smaller
                   // share of them is standing on the frontage. Compare rows
                   // only at equal ROADSIDE.
                   // Below ~1.2 the curve is flat and noisy: at those rates the
                   // few blocks near the road dominate and luck decides. Raise
                   // MAX with it or MAX becomes the real limit (see below).
                   //
                   // THE CITY-CENTRE SET, measured and kept for when the centre
                   // gets its own density: MEAN 25, SD 8, MAX 60, ROADSIDE 0.2.
                   // That is ~377 live, ~190 in one view, nearest ~180, and it
                   // costs 0.28 ms of a 16.7 ms frame. Every number in that set
                   // has to move together - see SD, MAX and ROADSIDE below.
  SD:      1.6,    // the spread about it, in the SAME units as MEAN - so it has
                   // to be scaled WITH it or the distribution quietly dies. At
                   // MEAN 2.5 an SD of 0.8 is a 33% spread and blocks really do
                   // differ; leave SD at 0.8 and raise MEAN to 25 and it is a 3%
                   // spread - every block gets exactly 25 and "some blocks busy,
                   // some empty" is gone, replaced by a flat rate. Rounded and
                   // clamped at nought, and at a low MEAN that clamp is what
                   // leaves most blocks empty (the curve's whole left half lands
                   // on none). At a high MEAN nothing reaches nought and no
                   // block is ever empty - unavoidable, and the right look when
                   // the fiction is a city swarming with guards.
  MAX:      12,    // never more than this on one block. NOT a second density
                   // knob - it is a ceiling, and a ceiling only does something
                   // while it is being hit. Swept on its own at MEAN 2.5:
                   //    MAX | live  nearest  <600  in view   blocks at the cap
                   //      2 |  43     250      5.5    14            87%
                   //      3 |  55     245      7.0    19            56%
                   //      4 |  60     249      8.0    22            10%
                   //      5 |  60     249      8.0    23             1%
                   //      6 |  60     249      8.0    23             0%   <- here
                   //     8+ |  60     249      8.0    23             0%
                   // So above 5 it is identical: raising it further is a no-op,
                   // and the only thing it can do is HOLD DENSITY BACK. The rule
                   // of thumb is that MAX stops mattering past about
                   // MEAN + 3*SD; below that it quietly caps MEAN, which is why
                   // the old MAX of 3 made MEAN stop answering past ~1.5.
                   // Leave it slack and treat MEAN as the only dial.
  SEED:   4231,    // its own seed, NOT CITY_SEED: changing the city's layout seed
                   // should not also shuffle where its guards are standing
  KEEP:   1800,    // a sentry gets a BODY inside this radius of you...
  DROP:   2400,    // ...and loses it past here. A RADIUS, not a band of chunks:
                   // a chunk is 1400 long but the city's whole 4000-unit width,
                   // so giving a body to a whole chunk spent twenty sentries in
                   // twenty-six three thousand units out to the side, in blocks
                   // nobody will ever walk down. Both sit outside the 1500-unit
                   // billboard cull so nothing appears while you are looking at
                   // it, and DROP > KEEP so the boundary cannot thrash.
  TRIES:    14,    // tries at finding a pavement spot on a block before giving up.
                   // Higher than it looks like it needs to be because GAP makes
                   // a crowded block reject most rolls; when it does run out,
                   // that sentry is skipped, which is what caps density at what
                   // the pavement can actually hold.
  GAP:      16,    // closest two sentries may be placed, world units. A sentry is
                   // 12 wide, so below ~12 they overlap and above ~20 a busy
                   // block starts refusing most of its draws.
  ROADSIDE: 0.45,  // share that stand on the block's ROAD-FACING edge rather than
                   // anywhere on its perimeter. Not decoration - see foeSpot: a
                   // block has four pavement edges and only one faces the
                   // highway, so picking uniformly hides three sentries in four
                   // down streets the player never walks. At 0 they are
                   // invisible however high MEAN goes.
                   //
                   // IT TRADES OFF AGAINST MEAN, and the two must move in
                   // OPPOSITE directions. At a low MEAN it has to be high or you
                   // meet nobody (0.6 at MEAN 2.5). At a high MEAN it has to come
                   // down or the frontage packs shoulder to shoulder and the
                   // city reads as a guard of honour lining the route - at
                   // MEAN 25 that is exactly what 0.6 looks like, and 0.2 gives
                   // the same 377 sentries as scattered knots along the street.
                   // Compare .shots/extreme-mean-25.png (0.6) with
                   // .shots/extreme-roadside-0.2.png (0.2). At the MEAN of 5 this
                   // sits between the two, nearer the low-MEAN end.
};

// -----------------------------------------------------------------------------
// 3f. THE MOVING SENTRIES - a SEPARATE population from the standing ones
// -----------------------------------------------------------------------------
// His rule: the standing sentries (FOE_POP) stay exactly as they are, and the
// movers are a completely separate sample with their own knobs. Nothing here
// reads FOE_POP, and turning FOE_WALK.ON off leaves the standing city untouched.
//
// WHY THIS IS CHEAP - and it is the whole design. A mover's position is a PURE
// FUNCTION OF THE CLOCK, not something we integrate frame by frame:
//
//     route = an arc of its block's pavement ring (two distances along it)
//     position(t) = ringPoint(ring, lerp(s0, s1, pingpong(t)))
//
// That buys four things at once:
//   * NO PATHFINDING. The ring is the same line foeSpot already stands sentries
//     on, so it is pavement by construction. FLOW is no use here anyway - it
//     points at the player and its clearances are a CAR's.
//   * NOTHING TO SIMULATE OFF SCREEN. A mover with no body is one plan entry and
//     costs zero: we do not step it, we EVALUATE it when it comes into range.
//     His question - "if the thing is not on screen, why bother" - is answered
//     by never running it at all rather than by running it and hiding it.
//   * NO TELEPORT ON RETURN. Walk away and come back and the schedule says where
//     it should be at this instant, whether or not anyone was watching. The
//     standing sentries get this for free because they never move; the movers
//     get it because the clock, not the frame, is what moves them.
//   * NO DRIFT, NO STUCK, NO COLLISION. There is nothing to wedge against a wall,
//     so none of foeCollide / foeStuck / foeSeparate runs for a mover on duty.
//
// The only stateful part is being SHOT: a provoked mover leaves its schedule and
// chases on the normal FOE_AI path, then rejoins the route when it gives up.
const FOE_WALK = {
  ON:     true,    // false = no movers at all; the standing city is unaffected
  MEAN:      5,    // movers per block, on average. THE KNOB, and it is its own.
                   // Doubled from 2.5 on 2026-11-10 ("too few of them"), which
                   // makes it equal to FOE_POP.MEAN - so the city is now a true
                   // half-and-half: as many walking as standing.
  SD:      2.0,    // same units as MEAN, so it HAS to be scaled WITH MEAN - this
                   // went 1.0 -> 2.0 with the MEAN above. Leave it behind and the
                   // spread shrinks in relative terms until every block gets the
                   // same number; see FOE_POP.SD for what that looks like at 10x.
  MAX:      16,    // ceiling per block; a no-op only while it is SLACK, and slack
                   // means above about MEAN + 3*SD. At MEAN 5 / SD 2 that is 11,
                   // so the old 8 would have quietly capped the doubling and made
                   // MEAN stop answering - exactly the trap FOE_POP.MAX documents.
  SEED:   9173,    // its own seed: the movers are not a reshuffle of the standers
  KEEP:   1800,    // gets a BODY inside this radius...
  DROP:   2400,    // ...and loses it past here. Same reasoning as FOE_POP's.
  LANE:   0.25,    // where the walking lane sits across the pavement, as a
                   // fraction of CITY_STYLE.PAVE from the lot edge. The standers
                   // are at 0.5 (the middle), so 0.25 puts the movers on the KERB
                   // side and keeps them mostly out of each other. The pavement
                   // is only PAVE wide and a sentry is 12, so they still brush
                   // past - which is what people walking a street do.
  SPD:      26,    // units/s on duty, before the reason's multiplier. Below
                   // FOE_RIG.WALK_SPD (30) on purpose: 30 is a sentry WALKING AT
                   // you, and a commute should not look as urgent as a pursuit.
  ARC0:    900,    // shortest route along the ring. Raised with ARC1 so the whole
                   // DISTRIBUTION moves up, not just its top end: leaving ARC0
                   // low only lengthened the long routes and left the median at
                   // 2.6x when the ask was 4x.
  ARC1:   2600,    // ...and longest. Drawn per mover, then clamped by ARC_MAXF.
                   // MEASURED (552 blocks, 1403 routes): the pavement ring of a
                   // block is 1166 units round at the smallest, 1912 median,
                   // 2894 at the biggest. So ARC1 is the ONLY thing that limits
                   // route length until it passes about 520 - at ARC1 520 the
                   // ARC_MAXF clamp fired on 0 of 1403 routes. Raise this to get
                   // longer walks; raise ARC_MAXF too if you want them longer
                   // than half a block.
  ARC_MAXF: 0.90,  // ...but never more than this fraction of the ring. THIS IS THE
                   // REAL CEILING on a ping-pong route, not ARC1: a route lives on
                   // ONE block's ring, so it physically cannot be longer than that
                   // ring. 2026-11-10, asked for "4x bigger": the median ring is
                   // 1912, so 4x the old median (521 -> 2084) is longer than a
                   // whole lap of a median block and cannot exist. 0.90 is as far
                   // as it goes - the mover walks nearly all the way round and
                   // comes back. To go beyond this a route has to CROSS A STREET
                   // onto the next block, which is new machinery (see HANDOFF).
                   // A mover that should circle without reversing gets `loop`.
  PAUSE:   1.6,    // seconds stood still at each end before turning round
  // A route that does not fit is TRIMMED, not thrown away - throwing it away
  // throws away the mover with it. These are the fractions of the drawn arc it
  // tries, in order, and the shortest arc worth having.
  SHRINK: [1, 0.72, 0.5, 0.34, 0.22, 0.14],
  ARC_MIN:  70,    // below this a "route" is just standing about: reject it and
                   // let the block keep one fewer mover
  REJOIN_T:  6,    // seconds a mover may spend walking back to its round after
                   // being shot at, before it just snaps onto the schedule. It
                   // hurries back at FOE_AI.CHASE_SPD, which MUST stay above the
                   // fastest mover (SPD * the biggest reason multiplier) or it is
                   // chasing a schedule that runs away from it and never arrives.
  SAMPLE:   20,    // route validation step: every this many units along the arc
                   // must be pavement, or the route is rejected. Corners are the
                   // reason - on a small block the inset corner lands inside the
                   // building footprint (the same hazard foeSpot guards against).
  // WHY each one is walking. Purely parameters - a reason is a weight, a speed
  // multiplier and a pause multiplier, so adding one is a line. `w` are relative
  // weights, normalised, so they do not have to sum to 1.
  REASONS: [
    // `loop: true` walks the WHOLE ring, one way, for ever - no turning round and
    // no pause. It is the longest route there is (a full lap of the block, 1166
    // to 2894 units) and the cheapest, because there is no ping-pong to work
    // out. It is also what policing actually looks like.
    { name:'POLICE',   w:0.35, spd:0.85, pause:2.0, loop:true },
    { name:'DELIVERY', w:0.25, spd:1.05, pause:2.5 },  // office kit, door to door
    { name:'REMOVAL',  w:0.15, spd:0.70, pause:3.0 },  // shifting the heavy stuff
    { name:'MILITARY', w:0.15, spd:1.45, pause:0.4 },  // the overlords' police
    { name:'SOCIAL',   w:0.10, spd:0.90, pause:4.0 },  // his joke, and it stays:
                                                       // two robots going nowhere
                                                       // slowly is free character
  ],
  // NOT BUILT YET, and each needs art or paired movement rather than a knob:
  // a carried box for DELIVERY, two sentries carrying one crate for REMOVAL, a
  // file of three for MILITARY, and a pair for SOCIAL. The schedule supports
  // them - give two movers the same route and a phase offset - but the sprites
  // and the pair-keeping do not exist. See HANDOFF.
};

// -----------------------------------------------------------------------------
// 4. ENEMIES AND THE SPAWNER
// -----------------------------------------------------------------------------
// One entry per model/colour. `size` is relative to the player's car, `hp` to
// ENEMY_HP_BASE, `pace` to the scroll speed. `from` is which end of the road they enter.
//   1 VULTURE  blue    BATEDOR - smaller, fast, fragile; comes up from behind,
//                                overtakes down one side, then turns on you
//   2 GRAVA    green   SOLDADO - normal size, the one that chases from behind
//   3 MANDIOCA yellow  TANQUE  - bigger, slow, fishtails, and explodes
const ENEMY_TYPE = {
  1: { kind:'batedor', size:0.80, hp:0.75, pace:1.10, from:'back'  },
  2: { kind:'soldado', size:1.20, hp:1.00, pace:1.00, from:'back'  },
  3: { kind:'tanque',  size:1.30, hp:1.00, pace:0.90, from:'front' }
};
// Difficulty climbs in waves: one wave per WAVE_DIST units driven. The gap
// between spawns starts at SPAWN_GAP0 s and shrinks SPAWN_GAP_WAVE s per wave,
// never below SPAWN_GAP_MIN (each gap is then jittered x0.7..1.3).
const WAVE_DIST      = 1400;
const SPAWN_GAP0     = 2.0;
const SPAWN_GAP_WAVE = 0.12;
const SPAWN_GAP_MIN  = 0.5;
// LEG 1 is the gentle leg. Elsewhere the spawner sends 72% of arrivals (at wave 1)
// from the FRONT, and every one of those is a yellow tanque driving at you. Here:
const LEG1 = {
  DENSITY:    0.5,     // share of the usual enemy count AND arrival rate (0.5 = half as many)
  FROM_FRONT: false,   // false: nothing comes from the front; the tanque comes up from behind
  // with FROM_FRONT false, the mix of what comes up behind: batedor, soldado, tanque
  BACK_MIX:   [0.35, 0.40, 0.25],
};
const PURSUE_SQUAD = 4;            // greens working the player at once; the rest queue
const BOMB_DMG = 46, BOMB_R = 96;  // what the yellow one lets go when it dies
const GUN_BURST = 4.0;             // seconds of fire an enemy gets
const GUN_REST  = 1.5;             // seconds before it can start again
const RAM_GAIN  = 1.7;             // how much harder a rear-ender shoves the player
const RAM_COAST = 1.0;             // seconds the cruise control lets that boost run
const FLANK_OFF = 78;              // how wide a batedor swings to go round you
const BLOCK_LEAD = 70;             // how far in front it sits once it is there

// -----------------------------------------------------------------------------
// 5. ROADSIDE BUILDINGS (legs 1 and 2)
// -----------------------------------------------------------------------------
// Each tier is a row of lots down each side of the road: one lot every `step`
// units, `empty` = share of empty lots, in0..in1 = distance from the road's
// middle, w/d/h = width (along the road), depth and height ranges.
const BLD_TIERS = [
  { step:118, empty:0.22, in0:212, in1:238, w0:58,  w1:100, d0:44, d1:78,  h0:32,  h1:76  },  // near
  { step:168, empty:0.14, in0:440, in1:540, w0:88,  w1:150, d0:70, d1:130, h0:130, h1:300 }   // far
];
const BLD_SKY   = { step:260, empty:0.30, in0:900, in1:1300, w0:120, w1:220, d0:120, d1:200, h0:380, h1:850 };
const SKY_REACH = 3500;              // how far ahead/behind along the road the giants exist
const SKY_LIT   = 0.45;              // their lit-window share, relative to the other tiers
const BLD_COLS  = ['#4a3c52','#56463e','#3e4454','#5a4a4c','#48394a','#3c3c4a','#524058'];
const FLOOR_H = 12, WIN_STEP = 13;   // storey height and window pitch, world units

// -----------------------------------------------------------------------------
// 5a. CITY STYLES - one scale of streets and buildings per part of the run
// -----------------------------------------------------------------------------
// Tried side by side in the (now removed) city lab. Units are world units: the
// car is 38 long x 20 wide, the highway 360 wide.
//   W        the city wall's distance from the centre line (city only)
//   ROADS    street width by depth of cut, avenues first; never under ROAD_MIN
//   XST/OUTR the cross street atop every chunk / the road down the outer edge
//   LOT_*    blocks (the cut);  PAVE pavement ring;  PLOT_* building plots
//   H        normal building heights; TOWER = share of towers, TOWER_H theirs
//   FLOOR    storey scale: 1 = FLOOR_H (12) a storey; windows grow with it
const CITY_STYLES = {
  // tight streets, small walk-ups: the slums along leg 1 (the city as it was)
  SLUMS:    { W:1400, ROADS:[86,70,58,50], ROAD_MIN:70, XST:92, OUTR:78,
              LOT_MIN:150, LOT_MAX:440, LOT_STOP:0.3, LOT_JITTER:0.75, LOT_ASPECT:1.5, LOT_MERGE:0.3, LOT_MERGE_MAX:560,
              PAVE:16, PLOT_MIN:44, PLOT_MAX:120, PLOT_DEEP:44, PLOT_DEEP_MAX:130, PLOT_STOP:0.2,
              H:[26,96], TOWER:0.07, TOWER_H:[150,320], FLOOR:1 },
  // real streets, mid-rise: leg 2
  WIDE:     { W:1700, ROADS:[130,110,100,90], ROAD_MIN:90, XST:120, OUTR:100,
              LOT_MIN:200, LOT_MAX:600, LOT_STOP:0.3, LOT_JITTER:0.75, LOT_ASPECT:1.5, LOT_MERGE:0.3, LOT_MERGE_MAX:760,
              PAVE:20, PLOT_MIN:80, PLOT_MAX:200, PLOT_DEEP:70, PLOT_DEEP_MAX:200, PLOT_STOP:0.2,
              H:[45,150], TOWER:0.10, TOWER_H:[220,450], FLOOR:1.5 },
  // boulevards and high-rises: the city centre (part 3). W doubled 2000 -> 4000 (2026-11-08):
  // the city was a tall thin strip; it now spreads 3820 out either side of the highway
  DOWNTOWN: { W:4000, ROADS:[150,120,110,100], ROAD_MIN:100, XST:140, OUTR:110,
              LOT_MIN:300, LOT_MAX:760, LOT_STOP:0.3, LOT_JITTER:0.7, LOT_ASPECT:1.5, LOT_MERGE:0.3, LOT_MERGE_MAX:900,
              PAVE:24, PLOT_MIN:120, PLOT_MAX:260, PLOT_DEEP:110, PLOT_DEEP_MAX:260, PLOT_STOP:0.3,
              H:[120,450], TOWER:0.25, TOWER_H:[500,900], FLOOR:1.6 },
};
// which style each part of the run is built in
const CITY_LOOK = { LEG1:'SLUMS', LEG2:'WIDE', CITY:'DOWNTOWN' };

// -----------------------------------------------------------------------------
// 5b. THE OUTSKIRTS (legs 1 and 2) - the same BSP cut as the city, sparse
// -----------------------------------------------------------------------------
// The edge of the city: the same blocks and unmarked streets, but every block is
// only partly built, with gaps between the buildings. It fills in as you go:
// BUILT0 of a block's plots have a building at the start of leg 1, BUILT1 by the
// city gate (every block keeps at least one). The sizes - streets, blocks,
// plots, heights, storeys - come from CITY_LOOK.LEG1 / LEG2 (section 5a).
// The road's barrier never opens here: it's scenery. (The bend keeps the old
// rows of lots: a cut can't follow a curve.)
const OUTSKIRTS = {
  SEED:    5113,
  CH:      1400,   // chunk length along the road
  IN:      ROAD_HW + 34,   // lots start this far from the road's middle
  W:       1150,   // and run out to here
  BUILT0:  0.30,   // share of a block's plots with a building at the start...
  BUILT1:  0.65,   // ...and at the city gate
  LIT:     0.55,   // lit windows relative to the city's (it's darker out here)
  FRONT_REACH: 40, // a building on the camera's side of the road (leg 1's lower side) leans
                   // over it on screen; its roof may reach this far into the road (road = 223)
};

// -----------------------------------------------------------------------------
// 6. THE CITY (part 3) - a BSP-cut strip of blocks either side of the highway
// -----------------------------------------------------------------------------
// Any street whose cut reaches the highway opens a gap in the barrier, which is
// how the car gets in and out. A chunk is cut from a seed made of (chunk, side),
// so the same stretch of road is always the same city and nothing is saved.
// The sizes are the CITY_LOOK.CITY style (section 5a); edit them there.
const CITY_SEED  = 7717;
const CITY_CH    = 1400;            // chunk length along the road
const CITY_IN    = ROAD_HW + 6;     // lots start just past the barrier
const CITY_STYLE = CITY_STYLES[CITY_LOOK.CITY];
const CITY_W     = CITY_STYLE.W;    // the strip's outer edge (the city wall)
const CITY_XST   = CITY_STYLE.XST;  // the cross street at the top of every chunk
const CITY_OUTR  = CITY_STYLE.OUTR; // the road down the strip's outer edge
const CITY_WALL_H = 70;             // the wall round the outside of the strip
// the skyline giants, pushed out past the city wall so they stay a backdrop
const BLD_SKY_CITY = { step:260, empty:0.25, in0:CITY_W+260, in1:CITY_W+700,
                       w0:120, w1:220, d0:120, d1:200, h0:420, h1:900 };

// Part 3 - the city in the run. It starts at the end of leg 2 (rounded to the
// next chunk edge) and your car crossing that line hands the run over: the
// scroll stops and you drive free, park, and walk.
const CITY_BACK = 2400;             // the highway is closed this far back behind the city edge
const CITY_CAM_EASE = 2.4;          // seconds the camera takes to hand over from the scroll to following you
// enemy cars in the city: kept around you, not an endless wave
const CITY_ENEMIES      = 6;        // how many hunt you at once
const CITY_SPAWN_GAP    = 2.2;      // seconds between arrivals while under that number
const CITY_SPAWN_MIN    = 900;      // they turn up this far away...
const CITY_SPAWN_MAX    = 1500;     // ...and no further (always off screen)
const CITY_CULL         = 2600;     // and are forgotten past this
// how they find you: a grid of the streets around you, filled outward from your
// position. They follow it downhill, side streets included.
const CITY_FLOW_CELL    = 20;       // grid cell, world units
const CITY_FLOW_N       = 170;      // cells across (CELL x N = the area they can path in)
const CITY_FLOW_EVERY   = 0.35;     // seconds between refills
const CITY_CRUISE       = 115;      // how fast they idle round the city once you're out of the car
// the key that clears every enemy car, and brings them back (works in every part)
const ENEMY_TOGGLE_KEY  = 'KeyN';
// testing: jump straight to the city gate (from the menu, or anywhere in a run)
const SKIP_TO_CITY_KEY = 'KeyC';

// -----------------------------------------------------------------------------
// 7. ON FOOT (E next to a stopped car)
// -----------------------------------------------------------------------------
//  STREET_ENEMIES - run the spawner in the city.
//  WALK_ARMED     - a sidearm on foot (SPACE / click).
const STREET_ENEMIES = false;
const WALK_ARMED     = true;    // the pistol: fpsgun.js (knobs: PISTOL there), picture: assets/guns/
const WALK_SPD = 46, RUN_SPD = 92;   // units/s (SHIFT runs)
const WALK_R = 5;                    // body radius against buildings and the car
let   WALK_EYE = 16;                 // standing eye height ([ ] on foot to tune)
const WALK_BARRIER_H = 7;            // the road barrier as you see it on foot
const WALK_TURN = 2.4;               // rad/s, arrow-key turning
const WALK_SENS = 0.0032;            // radians per unit of locked-mouse movement
const WALK_LIM = 760;                // how far either side of the road you can wander
const EXIT_SPEED = 25;               // the car has to be (nearly) stopped to get out
const ENTER_R = 34;                  // how close to the car E puts you back in
const WALK_HP = 40;                  // a person is not a car
const WALK_SHOT_DMG = 6;             // an enemy round that finds you on foot
const WALK_RUNOVER  = 0.12;          // damage per unit/s of a car that hits you on foot
const WALK_RUNOVER_MIN = 70;         // ...but only above this speed: slower and it just shoves you
const WALK_PITCH_UP = 0.78, WALK_PITCH_DOWN = -0.51;   // look up/down limits
const WALK_PITCH_RATE = 1.4;         // rad/s, Up/Down arrows

// -----------------------------------------------------------------------------
// 7b. THE CONTROLLER (pad.js)
// -----------------------------------------------------------------------------
// Mouse or pad is picked in OPTIONS on the title screen and remembered
// (localStorage 'scrapheap.input'). With nothing plugged in it is the mouse
// whatever is saved, so choosing CONTROLLER and unplugging can't lock you out.
// The chosen one owns the aim; the keyboard keeps working in both, because every
// dev key hangs off it.
//
//   LEFT = the car                       RIGHT = the guns
//   left stick  steer (X) + speed trim (Y)   right stick  the turret
//   d-pad       the same four, digital
//   L2  drift (handbrake)                    R2  missile
//   L1  boost                                R1  machine gun
//   Square  mine    Cross  confirm / in and out of the car    Circle  back
//   Options  pause
// On foot: left stick walks, right stick looks, L3 runs, R1 is the pistol,
// Cross gets you back in the car.
const PAD = {
  // standard-mapping button indices (the W3C "standard" gamepad: DualSense,
  // Xbox, 8BitDo and most things that aren't a flight stick)
  BTN: { CROSS:0, CIRCLE:1, SQUARE:2, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7,
         SELECT:8, START:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 },
  AX:  { LX:0, LY:1, RX:2, RY:3 },
  DZ_MOVE:     0.22,   // left stick: slack the steering and walking ignore...
  DZ_AIM:      0.26,   // ...and the firmer push the right stick needs to take the turret
  TRIG:        0.35,   // how far L2/R2 travel before they count as pressed
  LOOK_RATE:   2.6,    // rad/s, right stick on foot (the arrows' WALK_TURN is 2.4)
  MENU_REPEAT: 0.42,   // seconds a held d-pad waits before it starts repeating...
  MENU_RATE:   0.12,   // ...and the gap between repeats after that
};

// -----------------------------------------------------------------------------
// 7b. CAMERA SHAKE
// -----------------------------------------------------------------------------
// explode() kicks the camera. For most of this game's life it did so at FULL
// strength no matter where the blast was, which was invisible as a bug while
// explosions were rare and always happened under your own bumper.
//
// The sentries broke that. The 2D pane shows only +/-160 x +/-90 world units, and
// hunter cars cruise at CITY_CRUISE, well over FOE.RAM_MIN - so they mow sentries
// down all over the city, hundreds of units past anything you can see. Measured
// at MEAN 25, just driving and never firing a shot: 3 deaths in 30 s, ALL THREE
// further than 600 units away, and the screen shook for 13% of the frames. Firing
// made it 27 deaths, 25 of them off screen, shaking 27% of the time.
//
// So the kick is scaled by how far the camera is from the blast: full inside
// NEAR, fading to nothing at FAR. A death you cannot see cannot shake you.
const SHAKE = {
  NEAR:    110,   // full kick within this many units of the camera
  FAR:     700,   // nothing at all beyond this; linear in between
  SENTRY: 0.45,   // blast POWER for a dying sentry. Was 1.2 - the same as a whole
                  // car exploding (see explode's callers: barrel 0.8, missile 1.0,
                  // mine 1.1, car 1.2, car bomb 2.4). One person popping is a bump.
};

// -----------------------------------------------------------------------------
// 8. FIRST-PERSON VIEW AND QUALITY
// -----------------------------------------------------------------------------
const VIEW_STEPS = [1150, 1800, 2600, 3600, 5000, 7000];   // what 9 / 0 step through
let   VIEW_D = 7000;                 // how far you see on foot (default = the top step; 9 brings it in if it costs too much)
const VIEW_LOD = 900, VIEW_LOD_PX = 2.5;   // past VIEW_LOD, skip buildings under this many px
let   RC_FOV = 95 * Math.PI/180;     // field of view (- = to tune)
let   EYE_Z  = 26;                   // gunner's eye height ([ ] to tune)
let   CAR_MAG_MAX = 2.2;             // distant-car exaggeration in first person (, . to tune)
let   ASC_LO = 16, ASC_HI = 100, ASC_GAMMA = 1.0;   // ASCII: luminance -> glyph tone curve

// -----------------------------------------------------------------------------
// 8b. THE MAP (M) - a full-screen map over the game, which pauses while it's open
// -----------------------------------------------------------------------------
// After the-party's minimap: the city is drawn SHRUNK, every block at its real
// size and place, and the streets are just the ground showing between them.
const MAP_KEY   = 'KeyM';
const MINE_KEY  = 'KeyQ';              // drop a mine behind the car (player)
const MINES_START = 2;                // mines the run starts with (pickups add more, max 3)
const SOUND_KEY = 'KeyO';              // sound on/off (moved off M for the map)
const MAP_PAUSES = true;               // the game holds still while you read it
const MAP_RADII  = [700, 1300, 2400, 4200];   // how far the local map reaches (- / = step)
let   MAP_ZOOM   = 1;                  // which of MAP_RADII it opens at
const MAP_SHOW_ENEMIES = true;         // hunters as pips (the-party hid its monsters on purpose)
// once you're in the city the run's route strip is done with; the right panel
// becomes a zoomed-out overview of the city round you (false = no right panel)
const MAP_CITY_OVERVIEW = true;
const MAP_OVERVIEW_R    = 5200;        // how far that overview reaches
const MAP_COL = {
  GROUND: '#0b0716',   // wasteland / off the map
  STREET: '#1e1636',   // roads and the city floor (the gaps between blocks)
  BLOCK:  '#3b2b5e',   // a city block / a roadside lot
  BLOCK_EDGE: '#54427e',
  WALL:   '#22f0ff',   // barriers and the city wall
  YOU:    '#ff2bd6',   // the only magenta on the map
  CAR:    '#22f0ff',   // your car, when you're out of it
  HUNTER: '#ffb02e',   // enemy cars
  PAD:    '#e8e0ff',   // pickups
};

// -----------------------------------------------------------------------------
// 8c. THE INTRO COMIC - shown after START GAME, before the run
// -----------------------------------------------------------------------------
// Each page is up to 4 panels, read left to right, top to bottom. ENTER (or a
// click) reveals the next panel, ESC skips the comic. A panel whose image isn't
// there yet shows as an empty frame; a page with no images at all is skipped.
// `at` is where the caption box sits: t/b (top/bottom) + l/c/r (left/centre/right),
// e.g. 'tl', 'tc', 'br' - put it where it doesn't cover anyone's face.
// `size` (optional) is the caption's text size; 8 if left out.
// Captions are typed by the game, so the wording can change without new art.
const COMIC = {
  ENABLED: true,
  PAGES: [
    [ { img:'assets/comic/page1-1.webp', at:'tl', caption:'The humans are gone. They left us the world, and nothing to do in it.' },
      { img:'assets/comic/page1-2.webp', at:'bl', caption:'Out here, we had nothing they wanted. Almost.' },
      { img:'assets/comic/page1-3.webp', at:'tl', caption:'' },
      { img:'assets/comic/page1-4.webp', at:'br', caption:"They didn't want her. They wanted what she carries." } ],
    [ { img:'assets/comic/page2-1.webp', at:'tl', caption:'' },
      { img:'assets/comic/page2-2.webp', at:'tc', caption:'One road in. Every hunter they own on it.' },
      { img:'assets/comic/page2-3.webp', at:'tl', size:6.5, caption:'They hunt only new tech. An old model like me? Beneath their notice.' },
      { img:'assets/comic/page2-4.webp', at:'br', caption:"Hold on. I'm coming." } ],
  ],
  TYPE_SPEED:  38,      // caption letters per second
  PANEL_FADE:  0.45,    // seconds a panel takes to come in
  CAPTION_BG:  '#f4e39a',   // the classic yellow caption box
  CAPTION_INK: '#14101a',
  GUTTER_INK:  '#000000',   // panel borders
};

// -----------------------------------------------------------------------------
// 9. COLOURS - the cyberpunk menu and HUD
// -----------------------------------------------------------------------------
const NEON = {
  BG:      '#07040f',   // near-black, a touch of violet
  MAGENTA: '#ff2bd6',   // titles, the selected item
  CYAN:    '#22f0ff',   // glow, accents, the checkpoint
  DIM:     '#5a4a7a',   // unselected items, small print
  INK:     '#e8e0ff',   // body text
};
const GAME_TITLE = 'SCRAPHEAP';   // the name on the menu
// the menu logo: an image (WebP/PNG, transparent background) next to index.html. If the file
// is missing the menu falls back to GAME_TITLE in neon text. '' = always text.
const LOGO_IMAGE = 'assets/logo.webp';
const LOGO_WIDTH = 0.80;          // how much of the screen's width it may take
const LOGO_CROP  = [0, 0, 1, 1];         // the part of the image to use: x, y, w, h as fractions
// how it's laid on the menu: 'lighter' adds it (a black background disappears,
// glow blends in); 'source-over' draws it as is (use with a transparent PNG)
const LOGO_BLEND = 'source-over';
// true when the image is a SYMBOL with no lettering: the menu then writes
// GAME_TITLE under it, so renaming the game doesn't mean a new image
const LOGO_WITH_TITLE = false;

// Dev mode: your car takes no damage (I toggles it in game). Off for real runs.
const DEV_MODE = false;

// -----------------------------------------------------------------------------
// GARAGE (menu -> GARAGE): the cars you can pick. `vox` names a voxel car from
// assets/voxcars/ (built by tools/car_voxelize.py, loaded by a <script> tag in
// index.html); no `vox` = the classic hand-built car. The choice is remembered.
// -----------------------------------------------------------------------------
const GARAGE_CARS = [
  { name:'CLASSIC', vox:null,        blurb:'the old hand-built muscle car' },
  { name:'ASPEN',   vox:'aspen@64',  blurb:'wedge sports car, rear wing' },
  { name:'SPORTS',  vox:'sports@64', blurb:'race livery coupe' },
  { name:'BIOME',   vox:'biome@64',  blurb:'teardrop concept, glass canopy' },
];
// optional painted backdrop for the garage (WebP/PNG next to index.html). While it is
// null or missing, the garage draws its own workshop in code.
const GARAGE_BG = null;
