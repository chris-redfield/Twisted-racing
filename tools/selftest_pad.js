#!/usr/bin/env node
// Checks the controller (pad.js + its hooks in index.html) with no browser and no
// pad plugged in: a fake standard-mapping gamepad is poked frame by frame and the
// game is asked what it did about it.
//
//   node tools/selftest_pad.js
//
// Built on tools/headless.js, so the canvas is a no-op and this proves behaviour,
// not looks. It cannot tell you how the pad FEELS - the deadzones and LOOK_RATE
// still need a human - but it does catch a wrong button index, an edge that fires
// twice, an axis sign flip, and the aim snapping back on release.
'use strict';
const path = require('path');
const { load } = require('./headless.js');

// ---- a fake pad we can poke (W3C standard mapping, like Chrome reports)
const pad = {
  id: 'Fake Pad (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
  index: 0, connected: true, mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
};
let plugged = true;
const press   = (i, v = 1) => { pad.buttons[i].pressed = v > 0.5; pad.buttons[i].value = v; };
const release = (i) => { pad.buttons[i].pressed = false; pad.buttons[i].value = 0; };
const sticks  = (lx = 0, ly = 0, rx = 0, ry = 0) => { pad.axes = [lx, ly, rx, ry]; };
const B = { CROSS:0, CIRCLE:1, SQUARE:2, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7,
            SELECT:8, START:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 };

const g = load(path.join(__dirname, '..', 'index.html'));
g.sandbox.navigator = { getGamepads: () => (plugged ? [pad] : [null]) };
const E = g.E;
const frame = (n = 1) => { for (let i = 0; i < n; i++) g.tick(); };

let fails = 0, total = 0;
function ok(name, cond, extra = '') {
  total++;
  if (cond) console.log(`  ok   ${name}`);
  else { fails++; console.log(`  FAIL ${name}${extra ? '  <- ' + extra : ''}`); }
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const deg  = (r) => r * 180 / Math.PI;
const head = (s) => console.log(`\n-- ${s}`);

frame();
head('detection, and the OPTIONS gate');
ok('a pad is detected', E('padConnected()') === true);
ok('padMode is false while OPTIONS says mouse', E('padMode()') === false);
E('setInputMode("pad")');
ok('padMode goes live once OPTIONS says controller', E('padMode()') === true);
plugged = false; frame();
ok('unplugged falls back to the mouse (cannot lock you out)', E('padMode()') === false);
plugged = true; frame();
ok('replugging is picked up without a reload', E('padMode()') === true);

head('stick deadzone and analog response');
sticks(0.1); frame();
ok('a nudge inside DZ_MOVE reads zero', E('padStick("L").x') === 0);
sticks(1); frame();
ok('a full push reads 1', near(E('padStick("L").x'), 1));
sticks(Math.SQRT1_2, Math.SQRT1_2); frame();
ok('a full diagonal keeps magnitude 1 (radial deadzone, not square)',
   near(E('padStick("L").m'), 1, 1e-9), String(E('padStick("L").m')));
sticks(E('PAD.DZ_MOVE') + 0.001); frame();
ok('just past the deadzone is still gentle (rescaled, no jump)',
   E('padStick("L").x') < 0.01, String(E('padStick("L").x')));

head('steering and the throttle');
sticks(-1); frame();
ok('stick left steers -1', near(E('padSteer()'), -1));
sticks(); press(B.LEFT); frame();
ok('d-pad left steers -1', near(E('padSteer()'), -1));
press(B.RIGHT); frame();
ok('d-pad left + right cancel out', E('padSteer()') === 0);
release(B.LEFT); release(B.RIGHT);
sticks(0, -1); frame();
ok('stick up is throttle +1 (the axis is inverted for this)', near(E('padThrottle()'), 1));
sticks(0, 1); frame();
ok('stick down is throttle -1', near(E('padThrottle()'), -1));
sticks(0, -0.6); frame();
const part = E('padThrottle()');
ok('a part push is analog, not on/off', part > 0.1 && part < 0.95, String(part));
sticks();

head('the aim: holds on release, and is screen-faithful');
frame();
ok('at rest padAimAngle is null, so the turret HOLDS', E('padAimAngle()') === null);
sticks(0, 0, 1, 0); frame();
ok('push right aims +x (0 deg)', near(E('padAimAngle()'), 0));
sticks(0, 0, 0, -1); frame();
ok('push up aims -y (-90 deg)', near(deg(E('padAimAngle()')), -90));
sticks(0, 0, 0, 1); frame();
ok('push down aims +y (+90 deg)', near(deg(E('padAimAngle()')), 90));
// the ground is squashed by KY, so 45 deg on screen must come out steeper in world
sticks(0, 0, Math.SQRT1_2, Math.SQRT1_2); frame();
const a45 = deg(E('padAimAngle()'));
ok('45 deg on screen -> 58.2 deg in world (KY correction)', near(a45, 58.21, 0.05), String(a45));
sticks();

head('triggers travel, and edges fire once');
press(B.L2, 0.2); frame();
ok('L2 at 0.2 is not pressed (under PAD.TRIG)', E('padHeld("L2")') === false);
press(B.L2, 0.9); frame();
ok('L2 at 0.9 is pressed', E('padHeld("L2")') === true);
release(B.L2); frame();
press(B.R2); frame();
ok('R2 gives an edge on the frame it goes down', E('padPressed("R2")') === true);
ok('the same edge reads twice in one frame (several consumers)', E('padPressed("R2")') === true);
frame();
ok('the edge is gone next frame while still held', E('padPressed("R2")') === false);
ok('...but it still reads as held', E('padHeld("R2")') === true);
release(B.R2); frame();

head('menu repeat');
press(B.UP); frame();
ok('the first press moves one row', E('padRepeat("UP")') === true);
let ticks = 0;
for (let i = 0; i < 20; i++) { frame(); if (E('padRepeat("UP")')) ticks++; }
ok('a held d-pad is silent through the MENU_REPEAT delay', ticks === 0, `ticks=${ticks}`);
ticks = 0;
for (let i = 0; i < 40; i++) { frame(); if (E('padRepeat("UP")')) ticks++; }
ok('then it starts repeating', ticks > 2, `ticks=${ticks}`);
release(B.UP); frame();
ok('repeat stops on release', E('padRepeat("UP")') === false);

// Starting from MOUSE mode on purpose: a player who has just plugged a pad in
// must be able to reach OPTIONS and switch it on with the pad itself.
head('OPTIONS, driven by the pad, starting from mouse mode');
E('setInputMode("mouse"); state = "options"; optIdx = 0');
frame();
ok('the OPTIONS screen draws', E('state') === 'options');
ok('the pad works the menus even in mouse mode', E('padMode()') === false && E('padConnected()') === true);
press(B.CROSS); frame(); release(B.CROSS);
ok('cross on the INPUT row switches to the controller', E('inputMode') === 'pad', E('inputMode'));
ok('the hint line under the canvas follows it',
   E('hintEl.textContent').indexOf('L-STICK') === 0, E('hintEl.textContent').slice(0, 24));
press(B.DOWN); frame(); release(B.DOWN);
ok('d-pad down moves to BACK', E('optIdx') === 1, String(E('optIdx')));
press(B.CIRCLE); frame(); release(B.CIRCLE);
ok('circle backs out to the title', E('state') === 'title', E('state'));

head('in a run');
ok('the controller is the chosen device going in', E('padMode()') === true);
E('skipToCity()');
frame(5);
ok('a run is live', E('state') === 'play', E('state'));
sticks(1); frame(3);
ok('the left stick steers while driving', E('padSteer()') > 0.9);
sticks();
// the turret follows the right stick, and keeps its bearing when let go
E('cars[0].angle = 0');
sticks(0, 0, 0, -1); frame(4);
const up = E('cars[0].turret');
ok('right stick up points the turret up', Math.abs(deg(up) + 90) < 1, String(deg(up)));
sticks(); frame(4);
ok('the turret HOLDS that bearing once the stick is released',
   near(E('cars[0].turret'), up, 1e-9), String(E('cars[0].turret')));
// L1 boost
E('cars[0].boostT = 0; cars[0].dead = false; cars[0].pitT = 0');
press(B.L1); frame();
ok('L1 fires the boost', E('cars[0].boostT') > 0, `boostT=${E('cars[0].boostT')}`);
release(B.L1); frame();
// SQUARE mine, exactly one per press
E('cars[0].minesLeft = 2; cars[0].minecool = 0; mines.length = 0');
press(B.SQUARE); frame();
const dropped = E('mines.length');
frame(3);                                   // still held: must not keep dropping
ok('square drops exactly one mine per press',
   dropped === 1 && E('mines.length') === 1, `press=${dropped} held=${E('mines.length')}`);
release(B.SQUARE); frame();
// the guns
E('shots.length = 0; cars[0].cool = 0');
press(B.R1); frame(3);
ok('R1 fires the machine gun', E('shots.length') > 0, `shots=${E('shots.length')}`);
release(B.R1);
E('shots.length = 0; cars[0].mcool = 0; cars[0].missiles = 2');
press(B.R2, 0.9); frame(3);
ok('R2 past PAD.TRIG fires a missile', E('shots.some(s=>s.kind==="missile")') === true);
release(B.R2); frame();
E('shots.length = 0; cars[0].mcool = 0; cars[0].missiles = 2');
press(B.R2, 0.2); frame(3);
ok('a half-squeezed R2 does NOT fire (the trigger has travel)',
   E('shots.length') === 0, `shots=${E('shots.length')}`);
release(B.R2); frame();
// L2 drift reaches the physics as the handbrake
press(B.L2, 0.9); frame();
ok('L2 reads as held, which is what updateCar takes for the handbrake',
   E('padHeld("L2")') === true);
release(B.L2); frame();
// pause
E('paused = false');
press(B.START); frame(); release(B.START); frame();
ok('the OPTIONS button pauses', E('paused') === true);
press(B.START); frame(); release(B.START); frame();
ok('and unpauses', E('paused') === false);

head('on foot');
ok('we are in STREET, where you can get out', E('street') === true);
E('cars[0].vx = 0; cars[0].vy = 0; if(onFoot) toggleOnFoot()');
press(B.CROSS); frame(); release(B.CROSS); frame();
ok('cross gets you out of the car', E('onFoot') === true);
if (E('onFoot')) {
  E('walker.x = 0; walker.y = 0; walker.a = 0');
  sticks(0, -1); frame(6);
  const walked = E('Math.hypot(walker.x, walker.y)');
  ok('the left stick walks', walked > 0.5, walked.toFixed(2));
  E('walker.x = 0; walker.y = 0; walker.a = 0');
  sticks(0, -0.45); frame(6);
  const slow = E('Math.hypot(walker.x, walker.y)');
  ok('a part-pushed stick walks slower (analog)',
     slow > 0.01 && slow < walked * 0.85, `full=${walked.toFixed(2)} part=${slow.toFixed(2)}`);
  sticks();
  E('walker.a = 0');
  sticks(0, 0, 1, 0); frame(5);
  ok('the right stick turns the view', E('walker.a') > 0.01, String(E('walker.a')));
  E('walker.pitch = 0');
  sticks(0, 0, 0, -1); frame(5);
  ok('right stick up looks UP', E('walker.pitch') > 0.01, String(E('walker.pitch')));
  sticks();
  E('walker.x = 0; walker.y = 0; walker.a = 0');
  sticks(0, -1); press(B.L3); frame(6);
  const ran = E('Math.hypot(walker.x, walker.y)');
  ok('L3 runs', ran > walked * 1.3, `walk=${walked.toFixed(2)} run=${ran.toFixed(2)}`);
  release(B.L3); sticks();
  E('gunShots = 0; gunCool = 0');
  press(B.R1); frame(4);
  ok('R1 fires the pistol on foot', E('gunShots') > 0, `shots=${E('gunShots')}`);
  release(B.R1); frame();
  E('walker.x = cars[0].x; walker.y = cars[0].y');
  press(B.CROSS); frame(); release(B.CROSS); frame();
  ok('cross gets you back in the car', E('onFoot') === false);
}

// Who OWNS the aim in mouse mode. The car is driving and the camera is moving, so
// the turret changes every frame on its own - there is no fixed angle to assert.
// Instead: recompute both candidate answers from the SAME frame and see which one
// the turret actually took.
head('the mouse keeps the aim when OPTIONS says mouse');
const norm = `(function(t){const TAU=Math.PI*2;t=((t%TAU)+TAU)%TAU;return t>Math.PI?t-TAU:t;})`;
const wantMouse = `${norm}((function(){const wx=(mouseSX-VCX)/S+cam.x,wy=(mouseSY-VCY)/(S*KY)+cam.y;` +
                  `return Math.atan2(wy-cars[0].y,wx-cars[0].x)-cars[0].angle;})())`;
const wantStick = `${norm}(-Math.PI/2-cars[0].angle)`;   // what a stick pushed UP would command
E('setInputMode("mouse"); mouseIn = true; mouseSX = VCX + 80; mouseSY = VCY + 40');
sticks(0, 0, 0, -1);                        // shove the stick somewhere else entirely
frame(6);
// updateTurret runs before the car has finished moving inside the same step, so
// the mouse answer recomputed afterwards is a sub-step stale - close, not equal.
const got = E('cars[0].turret');
const eMouse = Math.abs(got - E(wantMouse)), eStick = Math.abs(got - E(wantStick));
ok('the turret follows the MOUSE formula (within a sub-step)', eMouse < 0.02,
   `off by ${deg(eMouse).toFixed(2)} deg`);
ok('and is nowhere near what the stick asked for', eStick > 0.2,
   `off by ${deg(eStick).toFixed(1)} deg`);
sticks();

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
