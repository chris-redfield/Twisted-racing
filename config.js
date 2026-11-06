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
// and creeps up to CAM_VMAX, so 90 s of driving is ~15500 units on leg 1 and
// ~18800 on leg 2 (it starts faster).
const RUN = {
  LEG1:          15500,  // horizontal survival, start -> corner
  CORNER_R:        420,  // radius of the 90-degree bend (middle of the road); the
                         // inside edge is CORNER_R - ROAD_HW, so keep it > ROAD_HW
  LEG2:          18800,  // vertical survival, corner -> city gate
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
const BOOST_TIME  = 0.9;         // seconds one charge burns for
const BOOST_COOL  = 10;          // seconds to recharge, counted from the end of the burn
const BOOST_ROOM  = 130;         // extra front-of-frame room while it burns
// how fast boostEase moves, as a multiplier per second. In hard, so the room is
// there before the car is; out slow (~3s), so the front line never retreats out
// from under a car that is still ahead of where it used to be.
const BOOST_EASE_IN = 0.001, BOOST_EASE_OUT = 0.37;

// -----------------------------------------------------------------------------
// 3. THE PLAYER'S CAR
// -----------------------------------------------------------------------------
const CAR_HP  = 130;             // hull points (enemies scale theirs off this)
const CAR_TOP = 232;             // top speed off the scroll (city, and enemies x pace)
const CAR_ACC = 330;             // acceleration

// -----------------------------------------------------------------------------
// 4. ENEMIES AND THE SPAWNER
// -----------------------------------------------------------------------------
// One entry per model/colour. `size` is relative to the player's car, `hp` to
// CAR_HP, `pace` to the scroll speed. `from` is which end of the road they enter.
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
// 5b. THE OUTSKIRTS (legs 1 and 2) - the same BSP cut as the city, sparse
// -----------------------------------------------------------------------------
// The edge of the city: the same blocks and little unmarked streets, but every
// block is only partly built - a few low buildings with gaps between them. It
// fills in as you go: BUILT0 of a block's plots have a building at the start of
// leg 1, BUILT1 by the city gate (every block keeps at least one).
// The road's barrier never opens here: it's scenery. (The bend keeps the old
// rows of lots: a cut can't follow a curve.)
const OUTSKIRTS = {
  SEED:    5113,
  CH:      1400,   // chunk length along the road
  IN:      ROAD_HW + 34,   // lots start this far from the road's middle
  W:       1150,   // and run out to here
  BUILT0:  0.30,   // share of a block's plots with a building at the start...
  BUILT1:  0.65,   // ...and at the city gate
  H0: 16, H1: 58,  // building heights (most of them)
  TOWER:   0.025,  // the odd taller one
  TOWER_H0: 90, TOWER_H1: 170,
  LIT:     0.55,   // lit windows relative to the city's (it's darker out here)
};
const OUTSKIRTS_CUT  = { LOT_MIN:190, LOT_MAX:560, LOT_STOP:0.40, LOT_JITTER:0.85, LOT_ASPECT:1.5,
                         LOT_MERGE:0.45, LOT_MERGE_MAX:700, roadW: d => d < 1 ? 66 : 54 };
const OUTSKIRTS_PLOT = { PLOT_MIN:56, PLOT_MAX:140, PLOT_DEEP:56, PLOT_DEEP_MAX:150, PLOT_STOP:0.25 };

// -----------------------------------------------------------------------------
// 6. THE CITY (part 3) - a BSP-cut strip of blocks either side of the highway
// -----------------------------------------------------------------------------
// Any street whose cut reaches the highway opens a gap in the barrier, which is
// how the car gets in and out. A chunk is cut from a seed made of (chunk, side),
// so the same stretch of road is always the same city and nothing is saved.
const CITY_SEED  = 7717;
const CITY_CH    = 1400;            // chunk length along the road
const CITY_W     = 1400;            // the strip's outer edge (the city wall)
const CITY_IN    = ROAD_HW + 6;     // lots start just past the barrier
const CITY_XST   = 92;              // the cross street at the top of every chunk
const CITY_OUTR  = 78;              // the road down the strip's outer edge
const CITY_ROADS = [86, 70, 58, 50];// road width by depth of cut: avenues first, lanes last
const CITY_ROAD_MIN = 70;           // ...but never under this (50s and 58s were undrivable)
const LOT_MIN = 150, LOT_MAX = 440, LOT_STOP = 0.3, LOT_JITTER = 0.75;
const LOT_ASPECT = 1.5, LOT_MERGE = 0.3, LOT_MERGE_MAX = 560;
const PAVE = 16;                    // pavement ring round every block
const PLOT_MIN = 44, PLOT_MAX = 120, PLOT_DEEP = 44, PLOT_DEEP_MAX = 130, PLOT_STOP = 0.2;
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
const WALK_ARMED     = false;
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
// 8. FIRST-PERSON VIEW AND QUALITY
// -----------------------------------------------------------------------------
const VIEW_STEPS = [1150, 1800, 2600, 3600, 5000, 7000];   // what 9 / 0 step through
let   VIEW_D = 3600;                 // how far you see on foot
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
// the menu logo: a PNG (transparent background) next to index.html. If the file
// is missing the menu falls back to GAME_TITLE in neon text. '' = always text.
const LOGO_IMAGE = 'assets/logo.png';
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
