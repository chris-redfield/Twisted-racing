#!/usr/bin/env node
// Checks the on-foot enemy billboard (foe.js + its hooks in index.html).
//
//   node tools/selftest_foe.js
//
// The canvas is a no-op here, so this proves the WIRING - that a sentry reaches
// the billboard list, draws without throwing, is occluded and culled like
// everything else - not that it looks right. How it looks is a screenshot
// question, and the answer is in HANDOFF.md.
'use strict';
const path = require('path');
const { load } = require('./headless.js');

const g = load(path.join(__dirname, '..', 'index.html'));
const E = g.E;
const frame = (n = 1) => { for (let i = 0; i < n; i++) g.tick(); };
let fails = 0, total = 0;
function ok(name, cond, extra = '') {
  total++;
  if (cond) console.log(`  ok   ${name}`);
  else { fails++; console.log(`  FAIL ${name}${extra ? '  <- ' + extra : ''}`); }
}
const head = (s) => console.log(`\n-- ${s}`);

frame();

head('the sprite is packed and the knobs are there');
ok('enemies-2d.js is loaded', E('typeof ENEMY_IMAGES') === 'object');
ok('it carries sentry_idle', E('!!ENEMY_IMAGES.sentry_idle') === true);
ok('as a data URL, not a file path (file:// cannot read pixels back)',
   E('ENEMY_IMAGES.sentry_idle.src.slice(0,15)') === 'data:image/png;',
   E('ENEMY_IMAGES.sentry_idle.src.slice(0,15)'));
ok('with its packed size, which the billboard needs for the aspect',
   E('ENEMY_IMAGES.sentry_idle.w') > 0 && E('ENEMY_IMAGES.sentry_idle.h') > 0,
   E('ENEMY_IMAGES.sentry_idle.w') + 'x' + E('ENEMY_IMAGES.sentry_idle.h'));
ok('a sentry stands taller than the player (FOE.H vs WALK_EYE)', E('FOE.H') > E('WALK_EYE'));

head('nothing spawns on its own');
ok('the game starts with no foes', E('foes.length') === 0);

head('a spawned sentry reaches the billboard list');
E('skipToCity()'); frame(5);
// the city scatters sentries of its own now, and these checks count foes[]
// exactly - so switch it off for them (the scattering has its own head below)
E('enemiesOn = false; clearFoes()');
ok('a run is live', E('state') === 'play', E('state'));
E('cars[0].vx = 0; cars[0].vy = 0; if(!onFoot) toggleOnFoot()');
frame();
ok('we are on foot', E('onFoot') === true);
E('clearFoes(); const w = walker; spawnFoe(w.x + Math.cos(w.a)*120, w.y + Math.sin(w.a)*120, w.a + Math.PI)');
ok('spawnFoe added one', E('foes.length') === 1);
ok('it is in front of the walker, at ~120 units',
   Math.abs(E('Math.hypot(foes[0].x-walker.x, foes[0].y-walker.y)') - 120) < 1);
const kinds = E('gatherBillboards(walker.x, walker.y, walker.a).map(b => b.kind)');
ok('gatherBillboards reports it as a foe', kinds.indexOf('foe') >= 0, kinds.join(','));

head('it draws without art, and without throwing');
// headless never fires Image.onload, so foeFrame() stays null all run: this is the
// fallback box path, which exists so the billboard is testable with no browser
ok('the picture never arrives here, as the stub intends', E('foeFrame()') === null);
let err = null;
try { frame(30); } catch (e) { err = e; }
ok('30 frames with a sentry on screen, no runtime error', err === null, err && err.message);
ok('and it is still standing there', E('foes.length') === 1);

head('culling and occlusion, same rules as every other billboard');
E('clearFoes(); const w = walker; spawnFoe(w.x + Math.cos(w.a)*2000, w.y + Math.sin(w.a)*2000)');
ok('past the 1500-unit billboard limit it is dropped',
   E('gatherBillboards(walker.x, walker.y, walker.a).filter(b => b.kind==="foe").length') === 0);
E('clearFoes(); const w = walker; spawnFoe(w.x - Math.cos(w.a)*200, w.y - Math.sin(w.a)*200)');
ok('one directly behind you is outside the FOV and dropped',
   E('gatherBillboards(walker.x, walker.y, walker.a).filter(b => b.kind==="foe").length') === 0);
E('clearFoes()');
ok('clearFoes empties the list', E('foes.length') === 0);

// On foot there is NO KERB in the first-person view (his call, 2026-11-10):
// a flat ribbon could not be layered correctly against the sentries by any clip,
// so it is gone until it comes back as a real volume. From the gunner's seat the
// barrier is still drawn full height.
head('on foot there is no kerb; at the wheel the barrier is still there');
E('clearFoes(); walker.x = ROAD_HW - 90; walker.y = cars[0].y; walker.a = 0; walker.pitch = 0');
frame();
ok('we are on foot', E('onFoot') === true);
E('buildCityRings(walker.y, walker.x, walker.y, walker.a)');
ok('no barrier ring at x = +/-ROAD_HW on foot',
   E('rings.filter(r => r.pts.length && Math.abs(Math.abs(r.pts[0].x) - ROAD_HW) < 1).length') === 0);
ok('and no low rings at all', E('rings.filter(r => r.low).length') === 0);
ok('a sentry just past the barrier is still drawn (not culled)',
   E('clearFoes(); spawnFoe(walker.x + 108, walker.y, Math.PI); ' +
     'gatherBillboards(walker.x, walker.y, walker.a).filter(b => b.kind==="foe").length') === 1);
E('clearFoes()');
E('walkReset()');
frame(2);
ok('back in the car', E('onFoot') === false);
E('buildCityRings(cars[0].y, cars[0].x, cars[0].y, cars[0].angle)');
ok('at the wheel the barrier rings are back, full height',
   E('rings.filter(r => r.pts.length && Math.abs(Math.abs(r.pts[0].x) - ROAD_HW) < 1 && r.h === BARRIER_H).length') > 0);
E('cars[0].vx = 0; cars[0].vy = 0; if(!onFoot) toggleOnFoot()');
frame();

head('the voxel model (tools/sprite_voxelize.py)');
ok('sentry-vox.js is loaded', E('typeof SPRITEVOX') === 'object');
const vkey = E('Object.keys(SPRITEVOX)[0]');
ok('it carries one model', !!vkey, String(vkey));
ok('its roles are all names rasterCar knows',
   E(`SPRITEVOX[${JSON.stringify(vkey)}].roles.every(r => ['body','accent','shadowed','dark','glass','tyre','metal','lamp','tail'].includes(r))`) === true,
   E(`SPRITEVOX[${JSON.stringify(vkey)}].roles.join(",")`));
ok('faces are whole 13-number records (role + 4 corners)',
   E(`SPRITEVOX[${JSON.stringify(vkey)}].f.length % 13`) === 0);
ok('the visor survived as lamp faces (the part ASCII keeps)',
   E(`(() => { const d = SPRITEVOX[${JSON.stringify(vkey)}], L = d.roles.indexOf('lamp');
       let n = 0; for(let i = 0; i < d.f.length; i += 13) if(d.f[i] === L) n++; return n; })()`) > 0);
ok('it registers into MODELS', E('foeMesh()') >= 0, String(E('foeMesh()')));

// the headless canvas is a no-op but rasterCar still runs: the sheet comes out
// the right shape even though nothing was painted
let bakeErr = null;
try { E('bakeFoeSheet(FOE_COL)'); } catch (e) { bakeErr = e; }
ok('baking does not throw', bakeErr === null, bakeErr && bakeErr.message);
ok('the sheet has FOE_RIG.YAWS directions',
   E('bakeFoeSheet(FOE_COL).n') === E('FOE_RIG.YAWS'), String(E('bakeFoeSheet(FOE_COL).n')));
ok('the frame is tall enough for a 22-unit sentry',
   E('bakeFoeSheet(FOE_COL).fh') >= 22*Math.sqrt(1 - 0.16*0.16),
   String(E('bakeFoeSheet(FOE_COL).fh')));
ok('the feet anchor sits near the bottom of the frame',
   E('bakeFoeSheet(FOE_COL).ay') > E('bakeFoeSheet(FOE_COL).fh')*0.8,
   E('bakeFoeSheet(FOE_COL).ay') + ' of ' + E('bakeFoeSheet(FOE_COL).fh'));
ok('X cycles the renderer and comes back', E('foeCycleRender()') === 'image' && E('foeCycleRender()') === 'vox');

head('the driving view draws them too');
E('if(onFoot) toggleOnFoot(); clearFoes()');
frame();
ok('we are back in the car', E('onFoot') === false);
E('const m = cars[0]; spawnFoe(m.x + 40, m.y, 0)');
let d2Err = null;
try { E('bakeFoe2D(FOE_COL)'); } catch (e) { d2Err = e; }
ok('the 2D sheet bakes', d2Err === null, d2Err && d2Err.message);
ok('the same directions here', E('bakeFoe2D(FOE_COL).n') === E('FOE_RIG.YAWS'));
// Pinned to the zoom the CAR sheets bake at, never to the live S. Through the
// bend the zoom eases every frame; baking at S rebuilt all six strips per frame.
ok('it is baked at homeZoom, like the car sheets',
   E('bakeFoe2D(FOE_COL).S') === E('PX*homeZoom()'),
   `${E('bakeFoe2D(FOE_COL).S')} vs ${E('PX*homeZoom()')}`);
const sheetId = E('bakeFoe2D(FOE_COL).cv');
E('S = S*1.37');                                   // pretend the zoom is easing
const sameSheet = E('bakeFoe2D(FOE_COL).cv') === sheetId;
E('S = S/1.37');
ok('a changing S does NOT rebuild it (drawFoe2D scales by zk instead)', sameSheet);
ok('a rescale drops it (same hook that clears CAR2D)',
   E('clearFoeSheets(); Object.keys(foeSheets2D).length') === 0);
let drawErr = null;
try { frame(20); } catch (e) { drawErr = e; }
ok('20 frames driving past a sentry, no runtime error', drawErr === null, drawErr && drawErr.message);
ok('and it is still there', E('foes.length') === 1);
E('clearFoes()');

head('the walk rig (FOE_RIG in config.js)');
E('foeMesh()');
ok('pose 0 is the carve itself, untouched',
   E('posedMesh(MODELS[foeMesh()], 0) === MODELS[foeMesh()]') === true);
const sigs = [];
for (let p = 0; p < E('FOE_RIG.POSES'); p++)
  sigs.push(E(`(() => { let s = 0; for(const f of posedMesh(MODELS[foeMesh()], ${p}))
    for(const v of f.v) s += v[0]*7.1 + v[2]*3.3; return Math.round(s*100); })()`));
ok('every pose is a different shape', new Set(sigs).size === sigs.length,
   `${new Set(sigs).size} distinct of ${sigs.length}`);
// this is what the knee is FOR: without it sin() sampled at POSES points gives
// mirror-image duplicates and half the cycle is wasted
const zr = (p) => E(`(() => { let lo = 1e9, hi = -1e9;
    for(const f of posedMesh(MODELS[foeMesh()], ${p})) for(const v of f.v){
      if(v[2] < lo) lo = v[2]; if(v[2] > hi) hi = v[2]; } return [lo, hi]; })()`);
const z0 = zr(0);
ok('standing, the feet are exactly on the ground', Math.abs(z0[0]) < 1e-9, String(z0[0]));
let worst = 0, tallest = 0;
for (let p = 0; p < E('FOE_RIG.POSES'); p++) {
  const [lo, hi] = zr(p);
  if (lo < worst) worst = lo;
  if (hi > tallest) tallest = hi;
}
// the hip HAS to drop when the legs spread or the sentry walks on tiptoe; what is
// left under the floor is the corner of a rotating foot box, and it is sub-pixel
ok('no pose sinks more than a fraction of a unit into the road', worst > -1.0, String(worst));
ok('and the body dips over the cycle rather than rising',
   tallest <= z0[1] + 1e-9, `${tallest} vs standing ${z0[1]}`);

head('the phase runs on distance, not time');
E('clearFoes(); const m = cars[0]; const f = spawnFoe(m.x + 60, m.y, 0); f.walk = true');
ok('a standing sentry shows pose 0', E('(foes[0].walk = false, foePose(foes[0]))') === 0);
E('foes[0].walk = true; foes[0].phase = 0');
const x0 = E('foes[0].x');
E('updateFoes(1/60)');
const moved = E('foes[0].x') - x0, ph = E('foes[0].phase');
ok('walking moves it along its facing', moved > 0, String(moved));
ok('and the phase advanced by exactly distance/STRIDE',
   Math.abs(ph - moved/E('FOE_RIG.STRIDE')) < 1e-9, `${ph} vs ${moved/E('FOE_RIG.STRIDE')}`);
E('foes[0].phase = 0.999');
E('updateFoes(1/60)');
ok('the phase wraps instead of running away', E('foes[0].phase') < 0.5, String(E('foes[0].phase')));
E('foes[0].phase = 0.99');
ok('the pose index stays inside the sheet',
   E('foePose(foes[0])') < E('FOE_RIG.POSES') && E('foePose(foes[0])') >= 0);
ok('the first-person sheet has a row per pose',
   E('bakeFoeSheet(FOE_COL).poses') === E('FOE_RIG.POSES'));
ok('the last pose row is inside the sheet',
   E('foeRow(bakeFoeSheet(FOE_COL), FOE_RIG.POSES - 1, true) + bakeFoeSheet(FOE_COL).fh')
     <= E('bakeFoeSheet(FOE_COL).cv.height'));
E('clearFoes()');


// ---------------------------------------------------------------------------
// From here: the AI, the damage, and the city laying them out (2026-11-09).
// Note on isolation: clearFoes() now clears foeLive with foes[], so the city
// WILL put its sentries straight back. A behaviour test that wants an empty
// street therefore runs with `enemiesOn = false` (onFootInCity's default); the
// head that tests the scattering turns it back on.
// ---------------------------------------------------------------------------

// put the player on foot, well clear of his own car: a sentry that cannot reach
// you because your CAR is in the way is correct, and useless to measure against
// ...and on a QUIET street. Hunter cars cruise the city at CITY_CRUISE (115),
// which is well over FOE.RAM_MIN, so they mow sentries down as they go. That is
// right in the game and pure noise in a behaviour test - it was killing the test
// sentry mid-assertion. Clearing them and pushing citySpawnT out of reach stops
// new ones WITHOUT touching enemiesOn, which citySentries also reads.
const quietStreet = () => E('for(let i = cars.length - 1; i >= 1; i--) cars.splice(i, 1); citySpawnT = 1e9');
// withCity=false (the default) also stops the city putting its OWN sentries
// back the moment a test clears them.
const onFootInCity = (withCity) => {
  E('skipToCity()'); frame(5);
  E('cars[0].vx = 0; cars[0].vy = 0; if(!onFoot) toggleOnFoot()'); frame(2);
  E('walker.y -= 300; cars[0].x = 1e5; cars[0].y = 1e5'); frame(4);
  quietStreet();
  E('enemiesOn = ' + (withCity ? 'true' : 'false'));
  if(!withCity) E('clearFoes()');
};
const dist = () => E('Math.hypot(foes[0].x - walker.x, foes[0].y - walker.y)');

head('five of YOUR pistol shots, and the sentry is scrap');
onFootInCity();
ok('FOE.HP is the five-shot number for PISTOL.DMG',
   E('FOE.HP') > 4*E('PISTOL.DMG') && E('FOE.HP') <= 5*E('PISTOL.DMG'),
   `HP ${E('FOE.HP')}, dmg ${E('PISTOL.DMG')}`);
E('clearFoes(); const w = walker; spawnFoe(w.x + Math.cos(w.a)*120, w.y + Math.sin(w.a)*120, w.a + Math.PI)');
let shots4 = 0;
for(let i = 0; i < 4; i++){ E('gunCool = 0; gunFire()'); if(!E('foes[0].dead')) shots4++; }
ok('four shots leave it standing', shots4 === 4 && E('foes[0].dead') === false, E('foes[0].hp'));
E('gunCool = 0; gunFire()');
ok('the fifth kills it', E('foes[0].dead') === true, E('foes[0].hp'));
ok('and it does not walk once it is dead', E('foes[0].walk') === false);

// The pistol used to test the YAW ALONE, which made the line of fire an
// infinite vertical cylinder: aim at your boots, kill a sentry 500 units off.
// gunFire now walks the ray the crosshair is on - z(d) = eye - DROP*d - and
// asks for z inside [0, FOE.H] at the target, plus PISTOL.AIM_PAD pixels.
head('the round goes where the CROSSHAIR is, not merely where you face');
onFootInCity();
const aimAt = (dist, pitch) => E(
  'clearFoes(); const w = walker; w.pitch = ' + pitch + '; ' +
  'spawnFoe(w.x + Math.cos(w.a)*' + dist + ', w.y + Math.sin(w.a)*' + dist + ', w.a + Math.PI); ' +
  'foes[0].hp = 9999; gunCool = 0; gunFire(); 9999 - foes[0].hp');
ok('level, at 120 units, it is a hit', aimAt(120, 0) === E('PISTOL.DMG'));
ok('aimed at the road it is a MISS, however well lined up', aimAt(120, -0.35) === 0);
ok('...and so is aimed over his head', aimAt(120, 0.45) === 0);
ok('at the full look-down the round lands in the road, yards away',
   E('walker.pitch = WALK_PITCH_DOWN; gunCool = 0; gunFire(); Math.round(gunImpact.d)') < 40,
   E('Math.round(gunImpact.d)'));
ok('...and that shot hit nothing', E('gunImpact.hit') === false);
// the drop is the renderer's own geometry, so the two cannot disagree
ok('the drop is the crosshair\'s offset from the horizon, in RC_VD',
   Math.abs(E('(RC_H/2 - (RC_HORIZON + RC_VD*Math.tan(walker.pitch)))/RC_VD') -
            E('(RC_H/2 - RC_HORIZON)/RC_VD - Math.tan(walker.pitch)')) < 1e-12);
ok('level, the line of fire reaches the road at about 210 units',
   Math.abs(E('walker.pitch = 0; WALK_EYE/((RC_H/2 - RC_HORIZON)/RC_VD)') - 213) < 25,
   E('Math.round(WALK_EYE/((RC_H/2 - RC_HORIZON)/RC_VD))'));
ok('so a sentry past it needs the crosshair lifted onto him',
   aimAt(400, 0) === 0 && aimAt(400, 0.1) === E('PISTOL.DMG'));
ok('a wall still stops the round before any of this', E('typeof rcZ') === 'object');
E('walker.pitch = 0; clearFoes()');

head('it ignores you until YOU shoot it');
E('clearFoes(); const w = walker; const f = spawnFoe(w.x + 60, w.y, 0); f.ox = f.x; f.oy = f.y');
frame(120);
ok('two seconds in front of it and it has not moved',
   E('Math.hypot(foes[0].x - foes[0].ox, foes[0].y - foes[0].oy)') < 1e-9);
ok('...nor is it angry', E('foes[0].mad') === false);
E('foeDamage(foes[0], 1, 0)');
ok('one round of yours provokes it', E('foes[0].mad') === true);
// a HUNTER's stray round still hurts it, but does not make it blame you
E('clearFoes(); const w = walker; spawnFoe(w.x + 60, w.y, 0); foeDamage(foes[0], 10, 3)');
ok('a hunter’s stray round hurts it', E('foes[0].hp') === E('FOE.HP') - 10);
ok('...without turning it on you', E('foes[0].mad') === false);

head('no coordination: shooting one leaves the rest cold');
E('clearFoes(); const w = walker; for(let i = 0; i < 4; i++) spawnFoe(w.x + 80 + i*18, w.y + 30, 0)');
E('foeDamage(foes[0], 20, 0)');
ok('one of four is provoked, and only one', E('foes.filter(f => f.mad).length') === 1);
E('foes[0].hp = 1; foeDamage(foes[0], 50, 0)'); frame(2);
ok('its death explosion does not anger the others either',
   E('foes.filter(f => f.mad && !f.dead).length') === 0);
ok('...nor scratch them (explode reads dmg 0 as 0 for sentries)',
   E('foes.slice(1).every(f => f.hp === FOE.HP)') === true);

head('provoked, it follows you - and stops at arm’s length');
E('clearFoes(); const w = walker; const f = spawnFoe(w.x + 300, w.y, 0); f.mad = true; f.gunT = 1e9');   // gun held: a sentry plants to fire (FOE_GUN), and this times its walk
const dStart = dist();
frame(60);                                  // the first second is mostly the turn
ok('it closes on you', dist() < dStart, `${Math.round(dStart)} -> ${Math.round(dist())}`);
const dTurned = dist();
frame(60);
// once it is pointed at you it must be covering CHASE_SPD, not FOE_RIG.WALK_SPD -
// the difference is the whole reason GIVE_UP means anything
ok('at CHASE_SPD once it is facing you, not the idle WALK_SPD',
   dTurned - dist() > (E('FOE_AI.CHASE_SPD') + E('FOE_RIG.WALK_SPD'))/2,
   `closed ${Math.round(dTurned - dist())} in 1 s; CHASE_SPD ${E('FOE_AI.CHASE_SPD')}, WALK_SPD ${E('FOE_RIG.WALK_SPD')}`);
frame(300);
ok('and it stops short of treading on you',
   dist() > E('FOE.R') + E('WALK_R') - 1 && dist() < E('FOE_AI.STOP') + 6, String(Math.round(dist())));
ok('standing still, it shows pose 0 again', E('foePose(foes[0])') === 0, String(E('foePose(foes[0])')));
ok('the walk phase ran on the distance it covered', E('foes[0].phase') >= 0 && E('foes[0].phase') < 1);

head('it is solid: you cannot walk through one');
E('clearFoes(); const w = walker; spawnFoe(w.x + 8, w.y, 0)');
frame(2);
ok('the walker is pushed out to FOE.R + WALK_R',
   Math.abs(dist() - (E('FOE.R') + E('WALK_R'))) < 0.01, String(dist()));
// ...but the door probe must NOT see them, or a sentry loitering by the car
// reports NO ROOM TO OPEN THE DOOR, which is wrong and baffling
const probe = E('(() => { const p = { x: cars[0].x, y: cars[0].y }; const x0 = p.x, y0 = p.y; walkCollide(p); return Math.hypot(p.x - x0, p.y - y0); })()');
E('clearFoes(); const m = cars[0]; spawnFoe(m.x + 8, m.y, 0)');
ok('walkCollide ignores sentries (toggleOnFoot uses it as a free-space probe)',
   Math.abs(E('(() => { const p = { x: cars[0].x, y: cars[0].y }; const x0 = p.x, y0 = p.y; walkCollide(p); return Math.hypot(p.x - x0, p.y - y0); })()') - probe) < 1e-9);

head('it gives up when you get away, and then ignores you again');
E('clearFoes(); const w = walker; const f = spawnFoe(w.x + 60, w.y, 0); f.mad = true');
E('foes[0].x = walker.x + FOE_AI.GIVE_UP + 200');
frame(30);
ok('a moment past GIVE_UP is not enough (LOSE_T debounces it)', E('foes[0].mad') === true);
frame(120);
ok('LOSE_T later it has lost you', E('foes[0].mad') === false);
E('foes[0].x = walker.x + 50; foes[0].y = walker.y');
frame(120);
ok('and walking back into its face does not restart it: only a bullet does',
   E('foes[0].mad') === false);
E('foeDamage(foes[0], 1, 0)');
ok('a bullet does', E('foes[0].mad') === true);

head('the car’s weapons kill them too (and only the player’s anger them)');
// A fresh run, in the car, on the HIGHWAY - and firing ALONG it. The tests above
// park the car off in the city to get it out of the walker's way, and a round
// fired from in there is eaten by a building before it reaches anything
// (blockHitPoint), which looks exactly like a sentry that cannot be shot.
E('startMatch(1)'); frame(2);
E('skipToCity()'); frame(5);
quietStreet();
E('clearFoes(); const m = cars[0]; m.x = 0; m.vx = 0; m.vy = 0; spawnFoe(m.x, m.y - 200, 0)');
ok('the line of fire is clear', E('!blockHitPoint(foes[0].x, foes[0].y + 6, 3)') === true);
E('shots.push({x:foes[0].x, y:foes[0].y + 6, z:5, vx:0, vy:-600, angle:-Math.PI/2, life:1, dmg:GUN_DMG, owner:0, kind:"gun", smoke:0})');
frame(2);
ok('a cannon round takes GUN_DMG off it', E('foes[0].hp') === E('FOE.HP') - E('GUN_DMG'),
   `${E('foes[0].hp')} of ${E('FOE.HP')}`);
ok('the round was consumed, not passed through', E('shots.length') === 0);
E('clearFoes(); const m = cars[0]; spawnFoe(m.x, m.y - 200, 0); explode(foes[0].x, foes[0].y, 1, 0, 40, 72)');
ok('a blast hurts one at its centre', E('foes[0].hp') === E('FOE.HP') - 40, String(E('foes[0].hp')));
E('clearFoes(); const m = cars[0]; spawnFoe(m.x, m.y - 200, 0); explode(foes[0].x, foes[0].y + 71, 1, 0, 40, 72)');
ok('and barely scratches one at the edge of the radius', E('foes[0].hp') > E('FOE.HP') - 2);
E('clearFoes(); const m = cars[0]; spawnFoe(m.x, m.y - 16, 0); m.vx = 0; m.vy = -160; foeRam()');
ok('a car at 160 u/s runs one down', E('foes[0].dead') === true);
E('clearFoes(); const m = cars[0]; spawnFoe(m.x, m.y - 16, 0); m.vx = 0; m.vy = -20');
E('globalThis.__py = foes[0].y; foeRam()');
ok('below RAM_MIN it is only shoved clear', E('foes[0].dead') === false && E('foes[0].hp') === E('FOE.HP'));
ok('...and really is shoved', E('foes[0].y - __py') < 0);
E('cars[0].vx = 0; cars[0].vy = 0');

head('the flow field is refilled for a sentry hunting you on foot');
// enemiesOn gates the refill as well as the spawner, so this one needs it on
E('enemiesOn = true; clearFoes(); cars[0].vx = 0; cars[0].vy = 0; if(!onFoot) toggleOnFoot()'); frame(3);
E('FLOW.ok = false; FLOW.t = 99');
frame(10);
ok('nothing hunting you: nothing refills it', E('FLOW.ok') === false);
E('const w = walker; const f = spawnFoe(w.x + 60, w.y, 0); f.mad = true; FLOW.t = 0');
frame(4);
ok('one provoked sentry does', E('FLOW.ok') === true);
ok('foeMadN counts it, which is what cityStep reads', E('foeMadN') === 1);

head('the city scatters them by block, and culls what you have left');
E('startMatch(1)'); frame(2);
ok('a fresh run has none of them, and no memory of them',
   E('foes.length') === 0 && E('foeLive.size') === 0 && E('foeKilled.size') === 0 && E('foePlans.size') === 0);
onFootInCity(true);
frame(40);                                  // one chunk seeded a frame; 6 are in range
// `!f.route` throughout this head: the MOVERS (FOE_WALK) also carry a key and a
// ck, and they belong to cityWalkers, not to citySentries. Without the filter
// these checks silently started measuring both populations at once.
const nFoe = E('foes.filter(f => f.ck && !f.route).length');
ok('the city has placed some', nFoe > 0, String(nFoe));
ok('every one is standing on a PAVEMENT (cityGround 2)',
   E('foes.filter(f => f.ck && !f.route).every(f => cityGround(f.x, f.y) === 2)') === true);
ok('each one that has a body is in the live index',
   E('foes.filter(f => f.key && !f.route).every(f => foeLive.has(f.key))') === true);
// DROP, not KEEP. KEEP is where a sentry is GIVEN a body; it keeps it until
// DROP, so the band between the two is legitimately occupied once you have moved
// at all. (Asserting KEEP here passed only while the city was thin enough that
// the band usually happened to be empty - one density knob away from failing.)
ok('and every one with a body is inside DROP',
   E('foes.filter(f => f.key && !f.route).every(f => Math.hypot(f.x - walker.x, f.y - walker.y) <= FOE_POP.DROP)') === true);
const blocksSeeded = E('(() => { let n = 0; for(const k of foePlans.keys()){ const [kk, sd] = k.split(":").map(Number); n += cityChunk(kk, sd).blocks.length; } return n; })()');
// measured against the PLANS - every sentry the city drew - not the subset that
// happens to have a body inside KEEP right now
const planned = E('(() => { let n = 0; for(const v of foePlans.values()) n += v.length; return n; })()');
const perBlock = planned/blocksSeeded;
ok('the density per block is near FOE_POP.MEAN, not a multiple of it',
   perBlock > E('FOE_POP.MEAN')*0.4 && perBlock < E('FOE_POP.MEAN')*2.5,
   `${perBlock.toFixed(2)} per block over ${blocksSeeded} blocks (MEAN ${E('FOE_POP.MEAN')})`);
// a block's count comes from one draw of a normal, so the shape to look for is
// "most blocks empty, a few with more than one" - not a flat rate
const occupied = E('(() => { const m = {}; for(const v of foePlans.values()) for(const p of v){ const k = p.ck + ":" + p.key.split(":")[2]; m[k] = (m[k] || 0) + 1; } return Object.values(m); })()');
// The shape to hold on to is "a DRAW per block", not a flat rate - block counts
// must vary. "Most blocks empty" is only true while MEAN is low, so it is
// asserted as what it is: a property of a low MEAN, not of the design. Without
// this the test fails the moment the knob is turned up, which is exactly when
// you least want to be arguing with your own suite.
ok('block counts vary - it is a distribution, not a flat rate',
   new Set(occupied).size > 1 || occupied.length < blocksSeeded,
   'counts: ' + occupied.slice().sort((a, b) => b - a).slice(0, 8).join(','));
const MEAN = E('FOE_POP.MEAN');
if(MEAN <= 0.5)
  ok('at a low MEAN most blocks are empty', occupied.length < blocksSeeded*0.6,
     `${occupied.length} of ${blocksSeeded} blocks occupied at MEAN ${MEAN}`);
else
  ok(`at MEAN ${MEAN} most blocks are occupied, as they should be`,
     occupied.length > blocksSeeded*0.4,
     `${occupied.length} of ${blocksSeeded} blocks occupied`);
ok('...and some hold more than one', occupied.some(n => n > 1),
   'counts: ' + occupied.sort((a, b) => b - a).slice(0, 6).join(','));
ok('none is placed inside the 1500-unit billboard cull on the frame it appears',
   E('FOE_POP.KEEP') > 1500 && E('FOE_POP.DROP') > E('FOE_POP.KEEP'),
   `KEEP ${E('FOE_POP.KEEP')}, DROP ${E('FOE_POP.DROP')}`);

head('they stand where you will walk past them - the regression that bit');
// This is the one that shipped broken and had to be found by playing: 17
// sentries, scattered exactly as asked, every one of them invisible. A block has
// four pavement edges and only ONE faces the highway, so picking uniformly put
// three in four down interior side streets at 500-1400 units. Raising the
// density did nothing - MEAN 0.22 and MEAN 0.8 both left ONE inside 600 units.
// If these two ever fail again, the enemies are in the game and unmeetable.
const onInnerEdge = E(`(() => {
  let inner = 0, all = 0;
  for(const [k, v] of foePlans){
    const [kk, sd] = k.split(":").map(Number);
    const blocks = cityChunk(kk, sd).blocks;
    for(const p of v){
      const b = blocks[+p.key.split(":")[2]];
      if(!b) continue;
      all++;
      const e = Math.abs(b.x0) < Math.abs(b.x1) ? b.x0 : b.x1;
      if(Math.abs(Math.abs(p.x) - Math.abs(e)) < CITY_STYLE.PAVE) inner++;
    }
  }
  return [inner, all];
})()`);
// Measured against whatever ROADSIDE is set to, not a number calibrated at one
// value of it: picking the inner edge happens either deliberately (ROADSIDE) or
// by luck (a quarter of the rest), so the share should land near
// ROADSIDE + (1 - ROADSIDE)/4. A fixed threshold here fails the moment the knob
// moves, which is when you need the suite to still be telling the truth.
const RS = E('FOE_POP.ROADSIDE'), want = RS + (1 - RS)/4;
const got = onInnerEdge[0]/Math.max(1, onInnerEdge[1]);
ok('the road-facing share tracks ROADSIDE',
   onInnerEdge[1] > 0 && got > want*0.6 && got < want*1.5,
   `${(got*100).toFixed(0)}% on the frontage, expected about ${(want*100).toFixed(0)}% at ROADSIDE ${RS}`);
const nearest = E('Math.min(...foes.filter(f => f.key && !f.route).map(f => Math.hypot(f.x - walker.x, f.y - walker.y)))');
ok('and one is close enough to the road to READ when you get out of the car',
   nearest < 400, `nearest is ${Math.round(nearest)} units (22 units tall; past ~600 it is a speck)`);
ok('...while the live set is still only what is near you, not a whole chunk',
   E('foes.filter(f => f.key && !f.route).length') < E('(() => { let n = 0; for(const v of foePlans.values()) n += v.length; return n; })()'),
   `${E('foes.filter(f => f.key && !f.route).length')} with a body of ${E('(() => { let n = 0; for(const v of foePlans.values()) n += v.length; return n; })()')} planned`);

head('the same city gives the same sentries back (nothing is saved)');
// Compared over the ones inside KEEP only: cityFoesOff takes away everything
// with a key, including any sitting out in the KEEP..DROP band, and coming back
// only re-bodies what is inside KEEP. The band is therefore expected to differ,
// and the determinism claim is about the inside-KEEP set.
const snap = '(() => foes.filter(f => f.key && !f.route && Math.hypot(f.x - walker.x, f.y - walker.y) <= FOE_POP.KEEP)' +
             '.map(f => f.key + "@" + Math.round(f.x) + "," + Math.round(f.y)).sort().join("|"))()';
const before = E(snap);
E('cityFoesOff()');
ok('cityFoesOff takes the city’s away', E('foes.filter(f => f.ck && !f.route).length') === 0);
frame(40);
ok('and they come back in exactly the same places',
   E(snap) === before, `${before.split('|').length} sentries compared`);

head('...but a sentry you WRECKED stays wrecked');
E('const f = foes.find(x => x.ck && !x.route); globalThis.__k = f.key; f.hp = 1; foeDamage(f, 50, 0)');
ok('the kill is remembered by key', E('foeKilled.has(__k)') === true);
E('walker.y -= 12000'); frame(40);
ok('walking right out of the city drops them', E('foes.filter(f => f.ck && !f.route && f.ck.startsWith("-11")).length') === 0);
E('walker.y += 12000'); frame(40);
ok('coming back brings the others', E('foes.filter(f => f.ck && !f.route).length') > 0);
ok('...and leaves the one you killed lying where it fell',
   E('foes.some(f => f.key === __k)') === false);

head('a sentry dropped by hand (Z) is never culled by the spawner');
E('clearFoes(); const w = walker; spawnFoe(w.x + 100, w.y, 0)');
ok('it has no chunk', E('foes[0].ck') === null);
E('walker.y -= 12000'); frame(40);
ok('and it survives being left 12000 units behind', E('foes.some(f => !f.ck && !f.route)') === true);

head('the hit flash is recoloured, not baked (hitFrame takes a row now)');
E('startMatch(1)'); frame(2);
onFootInCity();
E('clearFoes(); const w = walker; const f = spawnFoe(w.x + 60, w.y, 0); f.walk = true; f.phase = 0.5; f.hurtFlash = 0.1');
ok('the sheet still has no flash row (one strip per pose)',
   E('bakeFoeSheet(FOE_COL).cv.height') === E('bakeFoeSheet(FOE_COL).fh*FOE_RIG.POSES'));
ok('hitFrame reads the row it is given',
   E('(() => { const sp = bakeFoeSheet(FOE_COL); const c = hitFrame(sp, 0, sp.fh*2); return c.width === sp.fw && c.height === sp.fh; })()') === true);
let flashErr = null;
try { frame(30); } catch(e) { flashErr = e; }
ok('30 frames with a flashing, walking sentry on screen', flashErr === null, flashErr && flashErr.message);

head('a run of frames with the whole thing live, in both panes');
E('startMatch(1)'); frame(2);
onFootInCity(true);
let liveErr = null;
try {
  E('enemiesOn = true; citySpawnT = 0.5');   // everything live: the soak wants the lot
  frame(60);
  E('for(const f of foes) if(Math.random() < 0.5) f.mad = true');
  frame(180);
  E('asciiMode = 1'); frame(60);            // the ASCII pane, which is where a flash matters
  E('asciiMode = 0'); frame(30);
  E('if(onFoot) toggleOnFoot()'); frame(120);   // and back in the car, with the 2D sheet
} catch(e) { liveErr = e; }
ok('no runtime error over ~12 s of city with sentries in it, chasing, in both panes',
   liveErr === null, liveErr && liveErr.message);
ok('and there are still sentries standing', E('foes.filter(f => !f.dead).length') > 0,
   String(E('foes.filter(f => !f.dead).length')));

// A sentry dying used to kick the camera at full strength from anywhere in the
// city, because explode() had no distance term at all - it was written when a
// blast only ever happened under your own bumper. With hunter cars mowing
// sentries down hundreds of units away, that read on screen as a permanent
// shake nobody had asked for. The camera kick now has to fall off with range.
head('a death you cannot see does not shake the camera');
onFootInCity();
const kick = (dx, power) => {
  E('cam.shake = 0');
  E(`explode(cam.x + ${dx}, cam.y, ${power}, null, 0, 10)`);
  return E('cam.shake');
};
ok('a sentry dying at your feet still kicks the camera', kick(0, E('SHAKE.SENTRY')) > 0);
ok('...but a whole car exploding there kicks it harder',
   kick(0, 1.2) > kick(0, E('SHAKE.SENTRY')));
ok('the kick falls off with distance', kick(400, 1.2) < kick(0, 1.2) && kick(400, 1.2) > 0);
ok('and past SHAKE.FAR there is none at all', kick(E('SHAKE.FAR') + 1, 2.4) === 0);
ok('a blast beside the camera is NOT weakened by the fix', kick(0, 2.4) === Math.min(9, 2.4*3));
ok('SHAKE.NEAR is inside it, SHAKE.FAR outside',
   E('SHAKE.NEAR') > 0 && E('SHAKE.FAR') > E('SHAKE.NEAR'));
// the whole point: a quiet street full of sentries being run over off screen
E('cam.shake = 0');
let offscreen = 0;
for(const d of [800, 1200, 2000]){
  E(`explode(cam.x + ${d}, cam.y, SHAKE.SENTRY, null, 0, 10)`);
  if(E('cam.shake') > 0) offscreen++;
}
ok('three sentries popping off screen leave the camera completely still', offscreen === 0);

// ...and it must not be heard either. Snd.boom() takes no arguments - it is one
// fixed-volume bang - so a sentry run over across the city was as loud as one
// under your bumper. Nothing the player fires can reach SHAKE.FAR (a missile is
// 190 units/s for 2.6 s = 494), so this can only ever silence someone else's.
head('...and it is not heard either');
onFootInCity();
const booms = (dx) => {
  E('globalThis.__b = 0');
  E('if(!globalThis.__wrapped){ globalThis.__wrapped = 1; const o = Snd.boom; Snd.boom = function(){ globalThis.__b++; return o.apply(Snd, arguments); }; }');
  E('globalThis.__b = 0');
  E(`explode(cam.x + ${dx}, cam.y, SHAKE.SENTRY, null, 0, 10)`);
  return E('globalThis.__b');
};
ok('a sentry dying at your feet is heard', booms(0) === 1);
ok('one just inside SHAKE.FAR is still heard', booms(E('SHAKE.FAR') - 20) === 1);
ok('one past SHAKE.FAR is silent', booms(E('SHAKE.FAR') + 20) === 0);
ok('and one right across the city is silent', booms(3000) === 0);
ok('the player cannot throw a blast as far as SHAKE.FAR (so none of theirs is cut)',
   190 * 2.6 < E('SHAKE.FAR'), '190*2.6 = ' + (190*2.6) + ' vs ' + E('SHAKE.FAR'));

// ===================================================================== MOVERS
// A SEPARATE population (FOE_WALK) whose position is a pure function of the
// clock rather than something we integrate. These checks are about the four
// things that buys: no pathfinding needed, nothing to simulate off screen, no
// teleport when a body is dropped and given back, and no drift.
head('the movers are a separate population that walks');
onFootInCity(true);
E('walker.y -= 300'); frame(240);
const movers   = () => E('foes.filter(f => !!f.route).length');
const standers = () => E('foes.filter(f => f.ck && !f.route).length');
ok('the city placed some of each', movers() > 0 && standers() > 0,
   `${movers()} movers, ${standers()} standers`);
ok('they are a different set, not a relabelling',
   E('FOE_WALK.SEED') !== E('FOE_POP.SEED'));
ok('every mover is on a PAVEMENT (cityGround 2), with no pathfinding involved',
   E('foes.filter(f => f.route).every(f => cityGround(f.x, f.y) === 2)') === true);
ok('none of them is inside a building',
   E('foes.filter(f => f.route && cityGround(f.x, f.y) === 3).length') === 0);
ok('the mover live index has no orphans (citySentries must not cull them)',
   E('walkLive.size') === movers(),
   `${E('walkLive.size')} keys vs ${movers()} bodies`);

// they move, but not all at once - the paused ones are standing at an end
const p0 = E('foes.filter(f => f.route).map(f => f.x + "," + f.y)');
frame(120);
const p1 = E('foes.filter(f => f.route).map(f => f.x + "," + f.y)');
let shifted = 0;
for(let i = 0; i < Math.min(p0.length, p1.length); i++) if(p0[i] !== p1[i]) shifted++;
ok('most of them have moved after two seconds', shifted > p0.length*0.5,
   `${shifted} of ${p0.length} moved`);

head('a mover is driven by the CLOCK, not by the frame');
ok('walkAt is pure: the same route at the same t gives the same point',
   E('(() => { const rt = foes.find(f => f.route).route; const a = walkAt(rt, 123.456), b = walkAt(rt, 123.456);' +
     ' return a.x === b.x && a.y === b.y && a.phase === b.phase; })()') === true);
ok('...and a different t gives a different one',
   E('(() => { const rt = foes.find(f => f.route).route;' +
     ' return walkAt(rt, 0).x !== walkAt(rt, rt.arc/rt.spd*0.5).x || walkAt(rt, 0).y !== walkAt(rt, rt.arc/rt.spd*0.5).y; })()') === true);
// the whole point of the clock: leave, come back, and it is where it SHOULD be
E('globalThis.__wk = foes.find(f => f.route).route.key');
E('walker.y -= 12000'); frame(60);
ok('walking away takes its body (and nothing is left in the index)',
   E('foes.some(f => f.route && f.route.key === globalThis.__wk)') === false &&
   E('walkLive.has(globalThis.__wk)') === false);
E('walker.y += 12000'); frame(60);
ok('coming back puts it EXACTLY where the schedule says - no teleport to the start',
   E('(() => { const f = foes.find(f => f.route && f.route.key === globalThis.__wk); if(!f) return -1;' +
     ' const p = walkAt(f.route, matchTime); return Math.hypot(f.x - p.x, f.y - p.y); })()') < 0.001);
ok('an off-duty mover costs nothing: far more routes exist than have bodies',
   E('(() => { let n = 0; for(const v of walkPlans.values()) n += v.length; return n; })()') > movers()*1.5,
   `${E('(() => { let n = 0; for(const v of walkPlans.values()) n += v.length; return n; })()')} routes, ${movers()} bodies`);

head('shoot a mover and it leaves its round, then goes back to it');
onFootInCity(true);
E('walker.y -= 300'); frame(240);
quietStreet();                      // no hunter is going to run the subject over
E('globalThis.__m = foes.find(f => f.route && !f.dead); globalThis.__m.hp = 9999;' +
  'globalThis.__mx = globalThis.__m.x; globalThis.__my = globalThis.__m.y;');
E('foeDamage(globalThis.__m, 5, 0)');
ok('your bullet provokes it', E('globalThis.__m.mad') === true);
frame(120);
ok('it leaves the route to chase you',
   E('Math.hypot(globalThis.__m.x - globalThis.__mx, globalThis.__m.y - globalThis.__my)') > 20);
// Park the walker at a MEASURED distance from the mover: over GIVE_UP (900) so it
// loses interest, under FOE_WALK.DROP (2400) so the body survives to rejoin. It
// has to be measured, not guessed - nudging the walker 1500 units only opened the
// gap to 897 (the geometry is sideways) and the mover, closing at CHASE_SPD on a
// stationary target, simply never gave up.
E('walker.x = globalThis.__m.x + 1600; walker.y = globalThis.__m.y');
frame(240);
ok('it gives up and is still the same body (not culled mid-test)',
   E('globalThis.__m.mad') === false && E('foes.includes(globalThis.__m)') === true);
frame(420);
ok('and it is back on its schedule',
   E('globalThis.__m.rejoin') !== true &&
   E('(() => { const f = globalThis.__m, p = walkAt(f.route, matchTime);' +
     ' return Math.hypot(f.x - p.x, f.y - p.y); })()') < 1,
   `off by ${E('(() => { const f = globalThis.__m, p = walkAt(f.route, matchTime); return Math.hypot(f.x - p.x, f.y - p.y); })()').toFixed(2)}`);
// REJOIN_T is the backstop, but it only works if the hurry-back outruns the route
ok('the hurry-back speed beats the fastest mover, or it would never arrive',
   Math.max(E('FOE_AI.CHASE_SPD'), E('FOE_WALK.SPD')*2) >
   E('FOE_WALK.SPD') * Math.max(...E('FOE_WALK.REASONS.map(r => r.spd)')));

head('the reasons are weights, and FOE_WALK.ON is a real off switch');
const planMix = E('(() => { const c = {}; let n = 0;' +
  ' for(let k = -30; k < -11; k++) for(const sd of [-1, 1]) for(const rt of walkChunkPlan(k, sd)) { c[rt.reason] = (c[rt.reason] || 0) + 1; n++; }' +
  ' return { n, c }; })()');
const wTot = E('FOE_WALK.REASONS.reduce((a, r) => a + r.w, 0)');
let mixOk = planMix.n > 200;
for(const r of E('FOE_WALK.REASONS.map(r => [r.name, r.w])')){
  const got = (planMix.c[r[0]] || 0)/planMix.n, want = r[1]/wTot;
  if(got < want*0.75 || got > want*1.25) mixOk = false;
}
ok('every reason appears at about its weight', mixOk,
   `${planMix.n} routes: ${JSON.stringify(planMix.c)}`);
ok('all five reasons are represented',
   Object.keys(planMix.c).length === E('FOE_WALK.REASONS.length'));
E('FOE_WALK.ON = false; cityWalkersOff()'); frame(120);
ok('FOE_WALK.ON = false removes every mover...', movers() === 0);
ok('...and leaves the standing city untouched', standers() > 0, `${standers()} standers`);
E('FOE_WALK.ON = true'); frame(240);
ok('...and turning it back on brings them back', movers() > 0, `${movers()} movers`);

// walkFit trims a route that does not fit rather than throwing the MOVER away.
// In the city as it stands today it never fires - 0 of 2790 routes needed it,
// because every pavement ring here is fully walkable. It is kept because
// CITY_STYLE (SLUMS / WIDE / DOWNTOWN) changes block sizes, and a corner inset
// on a small lot lands inside the footprint. So it is proved here against a
// stubbed cityGround instead of against a city that happens not to need it.
head('walkFit trims a route to fit instead of losing the mover');
onFootInCity(true);
E('walker.y -= 300'); frame(240);
E('globalThis.__rt0 = foes.find(f => f.route && !f.route.loop).route');
// a route exactly as planned is already valid
ok('a planned route passes validation as it stands',
   E('walkRouteOk(globalThis.__rt0)') === true);
// now make the far half of the ring unwalkable and re-fit a copy
E(`globalThis.__og = cityGround;
   globalThis.__mk = (rt, frac) => {
     const bad = ringPoint(rt.ring, rt.s0 + rt.span*frac, 1);
     cityGround = (x, y) => (Math.hypot(x - bad.x, y - bad.y) < 8 ? 3 : globalThis.__og(x, y));
   };`);
E('globalThis.__rt = Object.assign({}, globalThis.__rt0); globalThis.__a0 = globalThis.__rt.arc;');
E('globalThis.__mk(globalThis.__rt, 0.9)');          // blocked near the far end
const fitted = E('walkFit(globalThis.__rt)');
ok('a route blocked near its far end is kept, not rejected', fitted === true);
ok('...and it came back shorter', E('globalThis.__rt.arc') < E('globalThis.__a0'),
   `${Math.round(E('globalThis.__a0'))} -> ${Math.round(E('globalThis.__rt.arc'))} units`);
ok('...and what is left really is walkable', E('walkRouteOk(globalThis.__rt)') === true);
ok('...and its span still matches its arc (sign kept)',
   Math.abs(Math.abs(E('globalThis.__rt.span')) - E('globalThis.__rt.arc')) < 0.001);
E('cityGround = globalThis.__og');
// the shrink fractions are OF THE ORIGINAL, not compounding - 1, 0.72, 0.5 ...
// applied in turn to a shrinking arc would collapse to 0.36, 0.12, 0.0006
ok('the shrink steps are fractions of the ORIGINAL arc, and descend',
   E('FOE_WALK.SHRINK[0]') === 1 &&
   E('FOE_WALK.SHRINK.every((v, i, a) => i === 0 || v < a[i-1])') === true);
// a lapper that cannot lap becomes a ping-pong walker rather than disappearing
E('globalThis.__lp = Object.assign({}, foes.find(f => f.route && f.route.loop).route)');
E('globalThis.__mk(globalThis.__lp, 0.5)');
const lapFit = E('walkFit(globalThis.__lp)');
ok('a lapper whose ring is blocked falls back to ping-pong, keeping the mover',
   lapFit === true && E('globalThis.__lp.loop') === false);
E('cityGround = globalThis.__og');
// and it does give up when there is genuinely nowhere to walk
E(`globalThis.__no = Object.assign({}, globalThis.__rt0);
   cityGround = () => 3;`);
const none = E('walkFit(globalThis.__no)');
E('cityGround = globalThis.__og');
ok('with no pavement anywhere the route is refused (the block keeps one fewer)', none === false);
ok('ARC_MIN is the floor it refuses below', E('FOE_WALK.ARC_MIN') > 0);

// ---------------------------------------------------------------------------
// INTO THE CITY THROUGH THE GATE, not skipToCity(). Every other check in this
// file (and in the quest bot) enters with skipToCity, which calls enterCity()
// from OUTSIDE the frame loop - so for a long time nothing tested the one frame
// a real run actually takes: placeCam() -> runEvents() -> updateSpawner(dt).
// runEvents parks the cement truck at the yard, thousands of units ahead, and
// then the leg culler runs in that same frame. It used to splice the truck out.
head('the gate: the cement truck survives the frame that enters the city');
E('stage = "run"'); E('startMatch(1)'); frame(1);
E('checkpoint = { camV, wave, kills:convoyKills, cash, up:Object.assign({}, runUp) }');
E('camS = ROAD.gateS - 300; distance = camS; placeCam();');
E(`(function(){ const f = roadFrame(ROAD.gateS + 60), me = cars[0];
     me.x = f.x; me.y = f.y; me.angle = Math.atan2(f.ty, f.tx);
     me.vx = f.tx*CAM_VMAX; me.vy = f.ty*CAM_VMAX; me.speed = CAM_VMAX; })()`);
E('runEvents()');
ok('the gate put us in the city', E('street') === true);
ok('and the quest parked a truck', E('!!(quest && quest.truck)') === true);
ok('the truck is far enough ahead to be inside the leg culler\'s reach',
   E('roadProject(quest.truck.x, quest.truck.y).s - camS') > E('halfExtent(roadFrame(camS)) + 460'));
E('updateSpawner(1/60)');
ok('the leg culler does NOT cull it (it is parked)', E('cars.indexOf(quest.truck)') > 0);
ok('nor your own car, were you to leave one on a leg',
   E(`(function(){ const c = makeCar(nextId++, false, cars[0].x + 4000, cars[0].y, 0, 0);
        c.parked = true; c.role = 'parked'; cars.push(c); updateSpawner(1/60);
        const kept = cars.indexOf(c) > 0; if(kept) cars.splice(cars.indexOf(c), 1); return kept; })()`) === true);
// and the map says where it is: a CEMENT mark on the local map AND on the
// city-overview panel (the thing he calls the minimap)
const marks = E(`(function(){
  const got = [], f = ctx.fillText;
  ctx.fillText = s => got.push(String(s));
  mapOpen = true; drawMap(); mapOpen = false;
  ctx.fillText = f;
  return got.filter(s => /CEMENT|TRUCK/.test(s)).length;
})()`);
ok('the map draws the truck twice: local map + city overview', marks === 2, 'marks=' + marks);

// ---------------------------------------------------------------------------
// In the city you drive BOTH ways. A pad is placed "ahead", and ahead used to mean
// deeper in road-s whichever way you were pointing - so after the quest, when you
// turn round, all four pads stayed deeper than you and none was ever recycled.
head('pads are placed the way you are DRIVING, not the way the road runs');
E('stage = "run"'); E('startMatch(1)'); frame(1); E('skipToCity()'); frame(30);
const padNear = () => E('Math.min(...pads.map(p => Math.hypot(p.x - cars[0].x, p.y - cars[0].y)))');
const roll = (dy, n) => { for(let i = 0; i < n; i++){
  E(`(function(){ const me = cars[0]; me.x = 0; me.y += ${dy}; cam.x = 0; cam.y = me.y;
       me.vx = 0; me.vy = ${dy > 0 ? 1 : -1}*120; })()`); frame(20); } };
E('(function(){ const me = cars[0]; me.x = 0; me.y = cityLimitY - 300; cam.x = 0; cam.y = me.y; })()');
frame(20);
roll(-300, 10);                                  // driving deeper, the way in
const deepNear = padNear();
ok('driving deeper, a pad is always near the road ahead', deepNear < 900, 'nearest ' + Math.round(deepNear));
roll(300, 14);                                   // turn round, drive back out
const outNear = padNear();
ok('driving back out, pads follow you instead of stranding deep in the city',
   outNear < 900, 'nearest ' + Math.round(outNear));
// a pad you just drove over holds null for timer seconds before it recycles, so
// "every pad is either stocked or counting down" is the stable form of this
ok('and every pad is either stocked or counting down to it',
   E('pads.every(p => !!p.item || p.timer > 0)') === true);
ok('on the legs "ahead" is still forward (padFwd 1)',
   E('(function(){ street = false; padAimUpdate(); const d = padFwd; street = true; return d; })()') === 1);

// ---------------------------------------------------------------------------
// THE HERO'S OWN UPGRADES (section 3b-bis) - the Saints' body shop. Everything
// here is the walker; the car's tracks in runUp must not move.
head("the hero's upgrade tracks");
E('stage = "run"'); E('startMatch(1)'); frame(1); E('skipToCity()'); frame(10);
ok('a run starts him at WALK_HP with no levels',
   E('walkUpTotal()') === 0 && E('walkerMaxHp()') === E('WALK_HP'));
E('walkUp.hull = 3');
ok('the hull track raises his max', E('walkerMaxHp()') === E('WALK_HP + WALK_HP_PER_LEVEL*3'));
E('walkUp.pdmg = 2; walkUp.prate = 2;');
ok('pistol damage follows pdmg', E('pistolDmg()') === E('pistolDmgAt(2)'));
ok('and the gap between shots follows prate',
   Math.abs(E('pistolRate()') - E('pistolRateAt(2)')) < 1e-9);
ok('level 0 has NO rig - it is a thing he buys', E('walkRepairRate()') === 0);
E('walkUp.repair = 1');
ok('level 1 fits it', E('walkRepairRate()') === E('WALK_REPAIR_RATE'));
E('walkUp.repair = 5');
ok('and it caps at 10 hull a second', E('walkRepairRate()') === 10);
E('walkUp.repair = 4');
ok('the car keeps its own levels out of it', E('upgradeTotal()') === 0);
// the numbers he set: start and cap of every track
ok('hull runs 50 -> 100', E('walkerHpAt(0)') === 50 && E('walkerHpAt(WALK_UP_MAX)') === 100);
ok('pistol runs 18 -> 27 a hit', E('pistolDmgAt(0)') === 18 && E('pistolDmgAt(WALK_UP_MAX)') === 27);
ok('pistol damage never steps backwards',
   E('(function(){ for(let i=1;i<=WALK_UP_MAX;i++) if(pistolDmgAt(i) < pistolDmgAt(i-1)) return false; return true; })()') === true);
ok('the rig runs 0 -> 10 hull a second', E('walkRepairAt(0)') === 0 && E('walkRepairAt(WALK_UP_MAX)') === 10);
// and a damaged hero with no rig has no way to heal on foot - his call, so it is
// pinned here rather than left to be rediscovered as a bug
ok('with no rig, holding the key heals nothing',
   E(`(function(){ const keep = walkUp.repair; walkUp.repair = 0;
        walker.hp = 10; keys[WALK_REPAIR_KEY] = true;
        for(let i=0;i<30;i++) updateWalker(1/60);
        keys[WALK_REPAIR_KEY] = false; const hp = walker.hp; walkUp.repair = keep;
        return hp === 10; })()`) === true);

head('the sprint tank');
E('walkUp.sprint = 0'); E('toggleOnFoot()'); frame(4);
E('(function(){ walker.stam = walkStamMax(); keys["ShiftLeft"] = true; keys["KeyW"] = true; })()');
const stam0 = E('walker.stam');
frame(60);                                              // a second of running
const stam1 = E('walker.stam');
ok('running drains it', stam1 < stam0 - 0.5, stam0.toFixed(2) + ' -> ' + stam1.toFixed(2));
ok('and he is actually running', E('walker.running') === true);
E('keys["ShiftLeft"] = false');
frame(60);
ok('walking refills it', E('walker.stam') > stam1);
E('(function(){ walker.stam = 0; keys["ShiftLeft"] = true; })()');
frame(2);
ok('an empty tank cannot be stutter-tapped (WALK_STAM_MIN)', E('walker.running') === false);
E('keys["ShiftLeft"] = false; keys["KeyW"] = false;');
E('walkUp.sprint = 5');
ok('the sprint track buys a bigger tank', E('walkStamMax()') > E('WALK_STAM'));

head('the repair rig');
E('(function(){ walker.hp = 10; walker.rep = 0; keys[WALK_REPAIR_KEY] = true; })()');
frame(60);
const hpRep = E('walker.hp');
ok('held, standing still, he patches himself', hpRep > 10, '10 -> ' + hpRep.toFixed(1));
ok('and the HUD knows it is running', E('walker.rep') > 0);
E('hurtWalker(1)');
ok('a hit breaks the repair', E('walker.rep') === 0);
E('(function(){ keys[WALK_REPAIR_KEY] = false; keys["KeyW"] = true; })()');
E('(function(){ walker.hp = 10; })()'); frame(30);
ok('it does not run while he is walking', E('walker.hp') === 10);
E('keys["KeyW"] = false');

head('his hull is no longer refilled by the car door');
// getting IN needs him beside the car ("WALK BACK TO THE CAR"), so put him there
// first - otherwise both toggles no-op and this whole block proves nothing
E(`(function(){ const me = cars[0]; me.speed = 0; me.vx = 0; me.vy = 0;
     walker.x = me.x + CAR_HW + WALK_R + 4; walker.y = me.y;
     walker.hp = 12; walker.stam = 1; })()`);
E('toggleOnFoot()'); frame(2);
ok('he actually got into the car', E('onFoot') === false, E('walkMsg'));
E('toggleOnFoot()'); frame(2);
ok('...and out again', E('onFoot') === true, E('walkMsg'));
ok('getting in and out keeps the damage (it used to be a free full heal)',
   E('walker.hp') <= 12.001, 'hp ' + E('walker.hp'));
ok('but the sprint tank does come back full (he has been sitting down)',
   Math.abs(E('walker.stam') - E('walkStamMax()')) < 0.001,
   E('walker.stam') + ' of ' + E('walkStamMax()'));

head('the Saints pay for a sentry, less than for a car');
const cash0 = E('cash');
E(`globalThis.__f = { x:cars[0].x + 40, y:cars[0].y, z:0, hp:1, key:'test:s0', a:0 }`);
E('foeDie(globalThis.__f, 0)');
const paid = E('cash') - cash0;
ok('a sentry you wrecked pays', paid === E('SAINTS.BOUNTY.sentry'), 'paid ' + paid);
ok('and it pays less than the cheapest car',
   E('SAINTS.BOUNTY.sentry') < Math.min(E('SAINTS.BOUNTY.batedor'), E('SAINTS.BOUNTY.soldado'), E('SAINTS.BOUNTY.tanque')));
const cash1 = E('cash');
E(`globalThis.__f2 = { x:cars[0].x + 40, y:cars[0].y, z:0, hp:1, key:'test:s1', a:0 }`);
E('foeDie(globalThis.__f2, -2)');
ok('a sentry somebody ELSE wrecked pays nobody', E('cash') === cash1);

head("the Saints' garage, deeper in the city");
ok('the run rolled a site for it', E('!!(questSites && questSites.saints)') === true);
ok('in its own depth band', E(`(function(){
     const m = (cityLimitY - questSites.saints.k*CITY_CH)/RUN.UNITS_PER_M;
     return m >= QUEST.SAINTS_M[0] - CITY_CH/RUN.UNITS_PER_M && m <= QUEST.SAINTS_M[1] + CITY_CH/RUN.UNITS_PER_M;
   })()`) === true);
ok('never the chunk the bunker or the yard took',
   E('questSites.saints.k') !== E('questSites.bunker.k') &&
   !(E('questSites.saints.k') === E('questSites.yard.k') && E('questSites.saints.side') === E('questSites.yard.side')));
ok('the lot has a forecourt and a counter to stand on',
   E('!!(questSaints() && questSaints().open && questSaints().x !== undefined)') === true);
ok('its shed is a real building, in the Saints\' colour',
   E(`cityChunk(questSites.saints.k, questSites.saints.side).bld.some(b => b.saints && b.col === QUEST.SAINTS_COL)`) === true);

head('standing in the forecourt opens the body shop - but only after the bunker');
E(`(function(){ quest.done = false; quest.atSaints = false; state = "play";
     const G = questSaints(); walker.x = G.x; walker.y = G.y; onFoot = true; })()`);
E('saintsTick()');
ok('before the bunker is sealed, nothing happens there', E('state') === 'play');
E('quest.done = true'); E('saintsTick()');
ok('once it is sealed, standing there opens the garage', E('state') === 'store');
ok('...on the HERO\'s rows, not the car\'s', E('storeMode') === 'foot');
ok('which are his five tracks plus the way out',
   E('storeRows().join(",")') === 'hull,sprint,pdmg,prate,repair,continue');
ok('every row prices and reads without throwing',
   E(`storeRows().every(r => typeof storeEffect(r) === 'string' && typeof storePrice(r) === 'number')`) === true);
E('closeStore()');
ok('leaving puts you back on the street', E('state') === 'play');
E('(function(){ const G = questSaints(); walker.x = G.x + QUEST.SAINTS_R*3; walker.y = G.y; })()');
E('saintsTick()');
ok('walking away re-arms it instead of reopening on the spot', E('quest.atSaints') === false && E('state') === 'play');
ok('and the map marks it once the quest is done',
   E(`(function(){ const got = [], f = ctx.fillText;
        ctx.fillText = s => got.push(String(s));
        mapOpen = true; drawMap(); mapOpen = false; ctx.fillText = f;
        return got.some(s => /SAINTS/.test(s)); })()`) === true);
E('onFoot = false');

// ---------------------------------------------------------------------------
// Losing focus must PAUSE a live run. The forced scroll needs no input, so an
// unattended leg 1 finishes itself in 70 s and opens the Saints' garage.
head('losing window focus pauses the run');
E('stage = "run"'); E('startMatch(1)'); frame(2);
ok('a fresh run is not paused', E('paused') === false && E('state') === 'play');
E('keys["KeyW"] = true');
E('pauseForBlur()');
ok('blur pauses it', E('paused') === true);
ok('and drops the held keys', E('!!keys["KeyW"]') === false);
const sB = E('camS');
frame(300);
ok('so the scroll stops dead while you are away', Math.abs(E('camS') - sB) < 1e-9,
   sB.toFixed(1) + ' -> ' + E('camS').toFixed(1));
ok('and the checkpoint cannot fire by itself', E('!!checkpoint') === false && E('state') === 'play');
E('paused = false'); frame(2);
ok('it never auto-resumes: you do that', E('paused') === false);
E('pauseForBlur()');
E('state = "title"'); E('paused = false'); E('pauseForBlur()');
ok('and it leaves the menus alone', E('paused') === false);
E('state = "play"');

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
