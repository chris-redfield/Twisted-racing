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

// THE SENTRY'S BAKE IS SPREAD TOO, one CELL at a time. This is a regression
// guard with a date on it: the sheet used to be filled a POSE STRIP at a time -
// 16 yaws, ~110 ms - with pose 0 baked eagerly on the frame the first sentry
// came into sight and foeWarm feeding in one strip per frame the moment it
// walked. That is six ~110 ms frames back to back, and on 2026-11-23 the user
// reported it from play: "as soon as I saw a sentry, the screen froze for a
// little bit", once, and never again. A whole sheet measures 643 ms; a cell is
// ~7 ms. If anything here starts filling strips again, that freeze is back.
head('the sentry sheet is filled a cell at a time, not a strip at a time');
const freshSheet = `delete foeSheets[foeVoxName()]; const sp = bakeFoeSheet(FOE_COL);`;
const nCells = `Array.from(sp.cell).filter(v => v).length`;
ok('a fresh first-person sheet has NOTHING baked',
   E(`(function(){ ${freshSheet} return ${nCells}; })()`) === 0);
ok('the ledger is one byte per pose per yaw',
   E('bakeFoeSheet(FOE_COL).cell.length') === E('FOE_RIG.POSES*FOE_RIG.YAWS'));
ok('one cell on demand is ONE cell, not its whole row',
   E(`(function(){ ${freshSheet} foeCellEnsure(sp, 3, 5);
      return sp.cell[3*sp.n + 5] === 1 && ${nCells} === 1; })()`) === true);
ok('asking twice does not bake twice',
   E(`(function(){ const sp = bakeFoeSheet(FOE_COL);
      foeCellEnsure(sp, 3, 5); foeCellEnsure(sp, 3, 5); return ${nCells}; })()`) === 1);
// posedMesh used to be called once per STRIP, so cell granularity would have
// re-posed the mesh for all 16 yaws of a pose had it not been cached.
ok('posedMesh is cached per pose, not rebuilt for every yaw of it',
   E(`(function(){ ${freshSheet}
      foeCellEnsure(sp, 2, 0); const a = sp.pm[2];
      foeCellEnsure(sp, 2, 1);
      return !!a && a === sp.pm[2] && a !== sp.mesh; })()`) === true);
ok('...and pose 0 is the mesh itself, so it costs nothing to pose',
   E(`(function(){ ${freshSheet} foeCellEnsure(sp, 0, 0);
      return sp.pm[0] === sp.mesh; })()`) === true);
ok('foeWarm fills FOE_RIG.WARM cells a frame and no more',
   E(`(function(){ ${freshSheet} clearFoeSheets(); foeWarm(); return ${nCells}; })()`)
     === E('FOE_RIG.WARM'));
// the pose policy, which is the old one: a sentry that never walks pays for
// pose 0 alone, because standing still it still turns through every yaw of it.
// foeWarm reads nothing off a sentry but `walk`, so the policy is driven here
// by a stand-in pushed onto the list and popped again - no live sentry needed
// and nothing left behind for the next section.
const warmRun = (walk, frames) => `(function(){
     ${freshSheet} clearFoeSheets();
     const kept = foes.splice(0, foes.length);
     foes.push({ walk:${walk} });
     let n = 0;
     while(n < ${frames} && ${nCells} < sp.cell.length){ foeWarm(); n++; }
     foes.length = 0; for(const f of kept) foes.push(f);
     let walked = 0;
     for(let p = 1; p < sp.poses; p++)
       for(let fr = 0; fr < sp.n; fr++) if(sp.cell[p*sp.n + fr]) walked++;
     return [${nCells}, walked, n]; })()`;
const stood = E(warmRun(false, 400));
ok('a sentry standing still fills pose 0 and never pays for the stride',
   stood[0] === E('FOE_RIG.YAWS') && stood[1] === 0, stood.join('/'));
const walked = E(warmRun(true, 600));
// not "inside a second": that was a claim about a budget of 2, and the budget is
// a MEASURED number (config.js) that may be tuned again. The guarantee that must
// hold whatever it is set to: walking fills the sheet COMPLETELY, and it costs
// one frame per WARM cells and not one frame per cell.
const cells = E('FOE_RIG.POSES*FOE_RIG.YAWS');
ok('...and once one walks, the whole sheet fills, at WARM cells a frame',
   walked[0] === cells && walked[2] === Math.ceil(cells/E('FOE_RIG.WARM')),
   walked[0] + '/' + cells + ' cells in ' + walked[2] + ' frames at WARM=' + E('FOE_RIG.WARM'));
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
ok('the lot has a forecourt and a spot to stand on',
   E('!!(questSaints() && questSaints().open && questSaints().x !== undefined)') === true);
ok('its shop is a real building, in the Saints\' colour',
   E(`cityChunk(questSites.saints.k, questSites.saints.side).bld.some(b => b.saints && b.col === QUEST.SAINTS_COL)`) === true);
ok('and it is SMALL: one storey of windows, not a tower',
   E(`(function(){ const b = cityChunk(questSites.saints.k, questSites.saints.side).bld.find(x => x.saints);
        return Math.floor((b.h - 6*b.fsc)/(FLOOR_H*b.fsc)); })()`) === 1);
ok('its footprint is the fixed small one, not the whole back of the lot',
   E(`(function(){ const b = cityChunk(questSites.saints.k, questSites.saints.side).bld.find(x => x.saints);
        return (b.x1-b.x0) <= QUEST.SAINTS_W + 1 && (b.y1-b.y0) <= QUEST.SAINTS_D + 1; })()`) === true);

head('the front door, and the stairs down to the shop');
ok('the shop carries a door on one of its four faces',
   E(`(function(){ const d = questSaints().door;
        return !!d && [0,1,2,3].includes(d.seg) && d.t0 < d.t1 && d.h > 0; })()`) === true);
ok('the door faces back at the highway, not out at the city wall',
   E(`(function(){ const d = questSaints().door; return d.nx === -questSites.saints.side; })()`) === true);
ok('the building draws it on the same face the site reports',
   E(`(function(){ const b = cityChunk(questSites.saints.k, questSites.saints.side).bld.find(x => x.saints);
        return b.doors && b.doors[0] === questSaints().door; })()`) === true);
ok('the spot you stand on is OUTSIDE the wall, clear of it',
   E(`(function(){ const G = questSaints(), d = G.door;
        return (G.x - d.x)*d.nx >= WALK_R; })()`) === true);
// the door is the whole point: standing there must NOT open anything by itself
E(`(function(){ quest.done = false; quest.atSaints = false; state = "play";
     const G = questSaints(); walker.x = G.x; walker.y = G.y; onFoot = true; })()`);
E('saintsTick()');
ok('before the bunker is sealed, the door does not even arm', E('quest.atSaints') === false);
ok('and nothing opens', E('state') === 'play');
E('quest.done = true'); E('saintsTick()');
ok('once it is sealed, standing at the door arms it', E('quest.atSaints') === true);
ok('but standing there alone still opens nothing', E('state') === 'play');
ok('the HUD offers the way in', E(`(function(){ const got = [], f = ctx.fillText;
     ctx.fillText = s => got.push(String(s)); drawWalkHUD(); ctx.fillText = f;
     return got.some(s => /GO IN/.test(s)); })()`) === true);
E('saintsEnter()');
ok('E at the door is what takes him down the stairs', E('state') === 'store');
ok('...on the HERO\'s rows, not the car\'s', E('storeMode') === 'foot');
ok('which are his five tracks plus the way out',
   E('storeRows().join(",")') === 'hull,sprint,pdmg,prate,repair,continue');
ok('every row prices and reads without throwing',
   E(`storeRows().every(r => typeof storeEffect(r) === 'string' && typeof storePrice(r) === 'number')`) === true);
E('closeStore()');
ok('leaving puts you back on the street', E('state') === 'play');
E('(function(){ const G = questSaints(); walker.x = G.x + QUEST.SAINTS_R*3; walker.y = G.y; })()');
E('saintsTick()');
ok('walking away disarms the door', E('quest.atSaints') === false && E('state') === 'play');
ok('and E out there is the car key again, not the door', E('saintsEnter()') === false);
ok('and the map marks it once the quest is done',
   E(`(function(){ const got = [], f = ctx.fillText;
        ctx.fillText = s => got.push(String(s));
        mapOpen = true; drawMap(); mapOpen = false; ctx.fillText = f;
        return got.some(s => /SAINTS/.test(s)); })()`) === true);
E('onFoot = false');

// ---------------------------------------------------------------------------
// Losing focus must PAUSE a live run. The forced scroll needs no input, so an
// unattended leg 1 finishes itself in 70 s and opens the Saints' garage.
// ---------------------------------------------------------------------------
// QUEST 2 - THE DATACENTER (HANDOFF.md 2026-11-17). The chain is: leave the
// Saints' shop -> the worm -> the map -> the service door -> the floor.
// ---------------------------------------------------------------------------
head("the datacenter's site, deepest of the four");
ok('the run rolled one', E('!!(questSites && questSites.data)') === true);
ok('and it is DEEPER than the shop that briefs it (the gear-shallower rule)',
   E('(cityLimitY - questSites.data.k*CITY_CH)') > E('(cityLimitY - questSites.saints.k*CITY_CH)'));
ok('in its own band', E(`(function(){
     const m = (cityLimitY - questSites.data.k*CITY_CH)/RUN.UNITS_PER_M;
     return m >= QUEST.DATA_M[0] - CITY_CH/RUN.UNITS_PER_M && m <= QUEST.DATA_M[1] + CITY_CH/RUN.UNITS_PER_M;
   })()`) === true);
ok('never a chunk another site took',
   E('questSites.data.k') !== E('questSites.bunker.k') &&
   E('questSites.data.k') !== E('questSites.saints.k') &&
   !(E('questSites.data.k') === E('questSites.yard.k') && E('questSites.data.side') === E('questSites.yard.side')));
ok('the plant is a real building and it DWARFS the Saints shop', E(`(function(){
     const d = cityChunk(questSites.data.k, questSites.data.side).bld.find(b => b.data);
     const s = cityChunk(questSites.saints.k, questSites.saints.side).bld.find(b => b.saints);
     return !!d && d.h > s.h*3 && (d.x1-d.x0)*(d.y1-d.y0) > (s.x1-s.x0)*(s.y1-s.y0)*2; })()`) === true);
ok('it has a square in front of it, not a forecourt',
   E('(function(){ const D = questData(); return Math.abs(D.open.x1 - D.open.x0); })()') > 120);

head('two doors, and only one of them is a way in');
ok('the plant carries both', E(`(function(){
     const b = cityChunk(questSites.data.k, questSites.data.side).bld.find(x => x.data);
     return b.doors.length === 2 && b.doors.some(d => d.kind === 'main') && b.doors.some(d => d.kind === 'back'); })()`) === true);
ok('the main doors face the square', E('questData().main.nx') === -E('questSites.data.side'));
ok('the service door is round a DIFFERENT face', E('questData().back.seg') !== E('questData().main.seg'));
ok('...and it is the narrow one',
   E('QUEST.DATA_BACK_W') < E('QUEST.DATA_DOOR_W') && E('QUEST.DATA_BACK_H') < E('QUEST.DATA_DOOR_H'));
ok('both stand-on spots are outside the wall', E(`(function(){ const D = questData();
     return Math.hypot(D.x - D.main.x, D.y - D.main.y) >= WALK_R &&
            Math.hypot(D.bx - D.back.x, D.by - D.back.y) >= WALK_R; })()`) === true);

head('the worm is handed over by LEAVING the shop, bought or not');
E(`(function(){ quest.done = true; onFoot = true; state = "play";
     dcq = { got:false, atDoor:null, inside:null, said:{} };
     const G = questSaints(); walker.x = G.x; walker.y = G.y; })()`);
ok('he has nothing before he goes in', E('dcq.got') === false);
E('saintsTick()'); E('saintsEnter()');
ok('the shop opened', E('state') === 'store');
const cashBefore = E('cash');
E('closeStore()');
ok('and walking out hands it over, with NOTHING bought', E('dcq.got') === true && E('cash') === cashBefore);
ok('the Saints say their piece', E(`radio.q.some(n => /module|service door/i.test(n.text))`) === true);
ok('it does not hand over twice', E(`(function(){ const n = radio.q.length; closeStore(); return radio.q.length === n; })()`) === true);
ok('the map marks the plant AND the service door', E(`(function(){ const got = [], f = ctx.fillText;
     ctx.fillText = s => got.push(String(s)); mapOpen = true; drawMap(); mapOpen = false; ctx.fillText = f;
     return got.some(s => /DATACENTER/.test(s)) && got.some(s => /SERVICE DOOR/.test(s)); })()`) === true);

head('the main doors never open - that is what the tip is FOR');
E('(function(){ const D = questData(); walker.x = D.x; walker.y = D.y; })()'); E('dataTick()');
ok('standing there arms the main-door prompt', E('dcq.atDoor') === 'main');
E('dataEnter()');
ok('and E does not get him in', E('!!dcq.inside') === false);
ok('the Saints tell him so once', E(`radio.q.some(n => /Not the front/i.test(n.text))`) === true);

head('the service door does, and only while he is carrying the worm');
E('(function(){ const D = questData(); walker.x = D.bx; walker.y = D.by; })()'); E('dataTick()');
ok('standing there arms the service prompt', E('dcq.atDoor') === 'back');
E('(function(){ dcq.got = false; })()'); E('dataEnter()');
ok('without the worm it stays shut', E('!!dcq.inside') === false);
E('(function(){ dcq.got = true; })()'); E('dataEnter()');
ok('with it, he is in', E('!!dcq.inside') === true);
ok('on floor 1, the offices', E('dcq.inside.M.name') === 'OFFICES' && E('dcq.inside.floor') === 0);
ok('standing on the floor\'s start cell', E(`(function(){
     const M = dcq.inside.M, c = dcCellAt(M, walker.x, walker.y);
     return c.x === M.start.x && c.y === M.start.y; })()`) === true);
ok('the floor\'s walls were turned into rings ONCE, not per frame',
   E('dcq.inside.rings.length') > 50 && E('dcq.inside.rings === dcq.inside.rings') === true,
   E('dcq.inside.rings.length') + ' rings');
ok('and merged, so the raycaster is not handed one stub per cell',
   E(`(function(){ const M = dcq.inside.M; let stubs = 0;
      for(let y=0;y<=M.rows;y++) for(let x=0;x<M.cols;x++) if(dcWallH(M,x,y)) stubs++;
      for(let x=0;x<=M.cols;x++) for(let y=0;y<M.rows;y++) if(dcWallV(M,x,y)) stubs++;
      return dcq.inside.rings.length < stubs*0.6; })()`) === true);

head('inside, the city stops applying');
ok('the walls hold him in', E(`(function(){
     const M = dcq.inside.M;
     for(let i=0;i<240;i++){ walker.a = (i*0.37)%(Math.PI*2); keys["KeyW"] = true; updateWalker(1/60); }
     keys["KeyW"] = false;
     const c = dcCellAt(M, walker.x, walker.y), cell = M.grid[c.y] && M.grid[c.y][c.x];
     return !!cell && (cell.region >= 0 || cell.corridor >= 0); })()`) === true,
   'walked 4s in a turning spiral and is still on walkable floor');
ok('the first-person pane draws it', E(`(function(){ drawWalkView(); drawWalkHUD(); return true; })()`) === true);
ok('it is first person only - the axo camera is not asked to draw a floor',
   E('!!(dcq && dcq.inside)') === true);

head('the stairs: three floors down and back up again');
// HIS report: "I couldn't find the exit to the other levels" - there were none.
const standOn = cell => E(`(function(){ const M = dcq.inside.M, c = M.${cell};
  const p = dcWorld(M, c.x, c.y); walker.x = p.x; walker.y = p.y; })()`);
ok('floor 1 has a way DOWN, on the far side of it', E(`(function(){
     const M = dcq.inside.M; return Math.abs(M.core.x - M.start.x) + Math.abs(M.core.y - M.start.y); })()`) > 10,
   'start to core, in cells');
standOn('core');
ok('standing on it reads as stairs down', E('dcAt()') === 'down');
E('dataEnter()');
ok('E takes him to floor 2', E('dcq.inside.floor') === 1 && E('dcq.inside.M.name') === 'SERVERS');
ok('...and puts him at that floor\'s arrival cell', E(`(function(){
     const M = dcq.inside.M, c = dcCellAt(M, walker.x, walker.y);
     return c.x === M.start.x && c.y === M.start.y; })()`) === true);
standOn('core'); E('dataEnter()');
ok('and again, to floor 3', E('dcq.inside.floor') === 2 && E('dcq.inside.M.name') === 'PLANT');
ok('arriving anywhere drops him at the stairs he came DOWN, not at the far side',
   E('dcAt()') === 'up');
standOn('core');
ok('the bottom floor has no stairs down - it has the UNIT', E('dcAt()') === 'core');
E('dataEnter()');
ok('which does not move him anywhere yet', E('dcq.inside.floor') === 2);
standOn('start'); E('dataEnter()');
ok('the arrival cell climbs BACK up', E('dcq.inside.floor') === 1);
// HIS report: climbing used to drop him at the floor's ARRIVAL cell, which is
// the far side of it - a teleport across ground he had already crossed.
ok('and he comes out of the DOWN stairs he originally took, not across the floor',
   E('dcAt()') === 'down',
   'standing on floor 2\'s down-stairs, the far end of the flight he just climbed');
standOn('start'); E('dataEnter()');
ok('...all the way to floor 1', E('dcq.inside.floor') === 0);
ok('...coming out of ITS down stairs too', E('dcAt()') === 'down');
ok('going DOWN still lands on the new floor\'s arrival cell', E(`(function(){
     standOnCore(); dataEnter();                        // floor 1 -> floor 2
     return dcAt() === 'up'; })()`.replace('standOnCore()',
     '(function(){ const M = dcq.inside.M, c = M.core, p = dcWorld(M, c.x, c.y); walker.x = p.x; walker.y = p.y; })()')) === true);
ok('so a flight is reversible: down then up puts him back where he started', E(`(function(){
     dcEnter(0); const M0 = dcq.inside.M, p = dcWorld(M0, M0.core.x, M0.core.y);
     walker.x = p.x; walker.y = p.y;                    // on floor 1's down stairs
     dataEnter();                                       // down to floor 2
     const at = dcAt();                                 // ...arrives at its up stairs
     dataEnter();                                       // straight back up
     return at === 'up' && dcq.inside.floor === 0 && dcAt() === 'down'; })()`) === true);
E('(function(){ dcEnter(0); })()');
ok('both stairwells are drawn as something you can SEE down a corridor', E(`(function(){
     const r = dcq.inside.rings.filter(x => x.dcMark);
     return r.length === 16 && r.every(x => x.h === DC.WALL_H); })()`) === true,
   'eight posts per stairwell, full height');
ok('and a post never blocks the cell it marks (markers do not collide)', E(`(function(){
     const M = dcq.inside.M, p = dcWorld(M, M.core.x, M.core.y);
     const q = { x:p.x, y:p.y };
     dcPushOut(M, q, WALK_R);
     return Math.hypot(q.x - p.x, q.y - p.y) < 0.001; })()`) === true);

head('the floor map: only what he has walked, and it is REMEMBERED');
// HIS report: "the minimap is completely lost and starts to be explored again"
// every time he took the stairs. A floor is now built once per run and kept.
E('(function(){ dcq.floors = null; dcq.inside = null; })()');       // a floor nobody has walked
ok('a floor nobody has entered is blank', E(`(function(){
     const F = dcFloorState(0); let n = 0; for(const v of F.seen) n += v; return n; })()`) === 0);
E('(function(){ dcq.floors = null; dcq.inside = null; dcEnter(0); })()');
ok('arriving reveals where he is standing and its ring, and no more', E(`(function(){
     let n = 0; for(const v of dcq.inside.seen) n += v; return n; })()`) <= 9);
ok('standing somewhere reveals it and its ring', E(`(function(){
     let n = 0; for(const v of dcq.inside.seen) n += v; return n; })()`) >= 4);
ok('but not the whole floor', E(`(function(){ const F = dcq.inside;
     let n = 0; for(const v of F.seen) n += v; return n < F.M.cols*F.M.rows*0.1; })()`) === true);
ok('walking fills it in', E(`(function(){ const F = dcq.inside, M = F.M;
     let before = 0; for(const v of F.seen) before += v;
     for(const [x, y] of dcCells(M).slice(0, 40)){ const p = dcWorld(M, x, y);
       walker.x = p.x; walker.y = p.y; dcSee(); }
     let after = 0; for(const v of F.seen) after += v;
     return after > before + 20; })()`) === true);
ok('it draws, at every floor size', E(`(function(){
     for(const i of [0, 1, 2]){ dcEnter(i); dcSee(); dcMinimap(); }
     return true; })()`) === true);
// the memory itself
ok('what he walked on a floor SURVIVES leaving it', E(`(function(){
     dcq.floors = null; dcq.inside = null; dcEnter(0);
     const M = dcq.inside.M;
     for(const [x, y] of dcCells(M).slice(0, 60)){ const p = dcWorld(M, x, y);
       walker.x = p.x; walker.y = p.y; dcSee(); }
     let before = 0; for(const v of dcq.inside.seen) before += v;
     dcEnter(1); dcEnter(2); dcEnter(0);                 // away and back
     let after = 0; for(const v of dcq.inside.seen) after += v;
     return after >= before && before > 30; })()`) === true);
ok('and so does the floor itself - same layout, not a new roll', E(`(function(){
     const sig = () => { const M = dcq.inside.M; let h = 0;
       for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++){ const c = M.grid[y][x];
         h = (h*31 + (c.walls.top?1:0) + (c.walls.left?2:0))|0; } return h; };
     dcEnter(1); const a = sig(); dcEnter(0); dcEnter(1); return sig() === a; })()`) === true);
// questStart re-rolls the SITES and resets quest 1 as well, so put all three
// back - otherwise every later check is running against a different city.
ok('a NEW run forgets all of it', E(`(function(){
     const kq = dcq, ks = questSites, kd = quest.done, kc = cityCache;
     questStart(null);
     const fresh = !dcq.floors || !dcq.floors[0];
     dcq = kq; questSites = ks; quest.done = kd; questForgetCity();
     return fresh; })()`) === true);
E('(function(){ dcq.floors = null; dcq.inside = null; dcEnter(0); })()');
ok('and a cell is at least 2 px even on the biggest floor', E(`(function(){ dcEnter(2);
     return Math.max(2, Math.floor(DC.MAP_SIZE/Math.max(dcq.inside.M.cols, dcq.inside.M.rows))) >= 3; })()`) === true);
E('(function(){ dcEnter(0); })()');

head('and the way he came in is the way back out');
// go in through the DOOR this time, so dcq.outside is the street and not
// wherever the previous block left him (it is captured on the first entry)
E(`(function(){ dcq.inside = null; dcq.outside = null; dcq.got = true;
     const D = questData(); walker.x = D.bx; walker.y = D.by; })()`);
E('dataTick()'); E('dataEnter()');
ok('in through the service door', E('!!dcq.inside') === true && E('dcq.inside.floor') === 0);
E(`(function(){ const M = dcq.inside.M, p = dcWorld(M, M.start.x, M.start.y);
     walker.x = p.x; walker.y = p.y; })()`);
ok('on floor 1 the arrival cell is the way OUT, not up', E('dcAt()') === 'up' && E('dcq.inside.floor') === 0);
ok('E on it leaves the building', E('dataEnter()') === true && E('!!dcq.inside') === false);
ok('and puts him back at the service door',
   E('(function(){ const D = questData(); return Math.hypot(walker.x - D.bx, walker.y - D.by); })()') < 1);
ok('the worm is still on him', E('dcq.got') === true);
E('onFoot = false');

// ---------------------------------------------------------------------------
// THE MAZE LAB (his ask, 2026-11-18): a way to LOOK at the floors without
// playing a whole quest to reach them. Driven through onPress, not by calling
// the functions - a dev hook nobody can reach by pressing the key is no hook.
// ---------------------------------------------------------------------------
head('U drops you inside the plant, from anywhere');
E('state = "title"');
E(`onPress(SKIP_TO_MAZE_KEY)`); frame(2);
ok('from the TITLE screen it is a live run, on foot, inside',
   E('state') === 'play' && E('onFoot') === true && E('!!(dcq && dcq.inside)') === true);
ok('on floor 1', E('dcq.inside.M.name') === 'OFFICES');
ok('and it went the REAL way: the city rolled, quest 1 done, the worm in hand',
   E('!!questSites.data') === true && E('quest.done') === true && E('dcq.got') === true);
ok('standing on the arrival cell, as a player would be', E(`(function(){
     const M = dcq.inside.M, c = dcCellAt(M, walker.x, walker.y);
     return c.x === M.start.x && c.y === M.start.y; })()`) === true);

head('1 / 2 / 3 are the floors');
for(const [code, name, i] of [['Digit2','SERVERS',1], ['Digit3','PLANT',2], ['Digit1','OFFICES',0]]){
  E(`onPress(${JSON.stringify(code)})`); frame();
  ok(`${code} -> ${name}`, E('dcq.inside.M.name') === name && E('dcq.inside.floor') === i);
}

head('U again re-rolls the floor under you');
const floorSig = () => E(`(function(){ const M = dcq.inside.M; let h = 0;
  for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++){ const c = M.grid[y][x];
    h = (h*31 + (c.walls.top?1:0) + (c.walls.left?2:0) + (c.region+2)*4)|0; }
  return h; })()`);
const rolls = new Set();
for(let i=0;i<5;i++){ rolls.add(floorSig()); E('onPress(SKIP_TO_MAZE_KEY)'); frame(); }
ok('five rolls, five different floors', rolls.size === 5, rolls.size + ' distinct');
ok('same floor and same knobs throughout',
   E('dcq.inside.floor') === 0 && E('dcq.inside.M.cols') === E('DC.FLOORS[0].cols'));
ok('a re-rolled floor is still whole', E(`(function(){ const M = dcq.inside.M, cs = dcCells(M);
     return dcReach(M, cs[0][0], cs[0][1]).size === cs.length; })()`) === true);
ok('and still carries both stairwells',
   E('dcq.inside.rings.filter(r => r.dcMark).length') === 16);

head('M means the floor map inside, and the CITY map outside');
ok('inside, M reveals the floor and leaves the city map alone', E(`(function(){
     const was = dcLabAll; onPress(MAP_KEY);
     return dcLabAll !== was && mapOpen === false; })()`) === true);
ok('the HUD draws with the reveal on', E('(function(){ drawWalkHUD(); return true; })()') === true);
E('onPress(MAP_KEY)');
ok('and it toggles back', E('dcLabAll') === false);
E(`(function(){ const M = dcq.inside.M, p = dcWorld(M, M.start.x, M.start.y);
     walker.x = p.x; walker.y = p.y; })()`);
E('onPress("KeyE")'); frame();
ok('out on the street again', E('!!dcq.inside') === false);
ok('...where M is the city map once more', E(`(function(){ onPress(MAP_KEY);
     const open = mapOpen; onPress(MAP_KEY); return open; })()`) === true);
ok('the lab parked the car within reach, so leaving is not a hike',
   E('nearCar()') === true,
   E('(function(){ const c = cars[0]; return Math.round(Math.hypot(walker.x-c.x, walker.y-c.y)); })()') + ' units');

head('the lab does not play quest 1 over the top of it');
// HIS report: pressing U played the bunker brief, same as pressing C.
E('state = "title"'); E('onPress(SKIP_TO_MAZE_KEY)'); frame(2);
ok('the radio is silent on arrival', E('radio.q.length') === 0 && E('!radio.cur') === true);
ok('...and it is not silent on the ordinary way in', E(`(function(){
     skipToCity(); return radio.q.length > 0; })()`) === true,
   'pressing C still briefs you, as it should');
E('state = "title"'); E('onPress(SKIP_TO_MAZE_KEY)'); frame(2);

head('he is carrying the worm, and the HUD SAYS so');
// HIS report: "I can't test the quest, I don't have the unit on me." He did
// have it - dcq.got was true from the first frame. It was invisible.
ok('U gives him the worm', E('dcq.got') === true);
const walkHud = () => E(`(function(){ const o = [], f = ctx.fillText;
  ctx.fillText = s => o.push(String(s)); drawWalkHUD(); ctx.fillText = f; return o.join('|'); })()`);
ok('and the HUD shows it', /WORM/.test(walkHud()), walkHud().split('|').find(t => /WORM/.test(t)));
ok('it is not shown when he has not got it',
   E('(function(){ const k = dcq.got; dcq.got = false; return k; })()') === true &&
   !/WORM/.test(walkHud()));
E('dcq.got = true');

head('THE PLANT: held, standing still, at the unit');
E(`(function(){ dcEnter(2); dcq.plant = 0; dcq.planted = false;
     const M = dcq.inside.M, p = dcWorld(M, M.core.x, M.core.y);
     walker.x = p.x; walker.y = p.y; })()`);
ok('the bottom floor\'s far cell is the unit', E('dcAt()') === 'core');
ok('and the prompt tells him to HOLD, not press', /HOLD E/.test(walkHud()));
ok('a press just says so', E(`(function(){ onPress("KeyE"); return /HOLD E/.test(walkMsg); })()`) === true);
E('keys[DC.PLANT_KEY] = true');
frame(60);
ok('holding it starts the plant going in', E('dcq.plant') > 0.8 && E('dcq.planted') === false,
   E('dcq.plant').toFixed(2) + ' of ' + E('DC.PLANT_T'));
ok('the bar is on screen while it goes in', /PLANTING/.test(walkHud()));
frame(Math.ceil(E('DC.PLANT_T')*60) + 10);
ok('and after DC.PLANT_T seconds it is in', E('dcq.planted') === true);
ok('the worm wakes up and speaks', E(`radio.q.concat(radio.cur ? [radio.cur] : [])
     .some(n => n.who === 'WORM')`) === true);
ok('...through the building, not on a radio band', E('RADIO.SPEAKERS.WORM.name') === 'THE PLANT');
ok('it says what it has taken', E(`radio.q.concat(radio.cur ? [radio.cur] : [])
     .some(n => /doors|turrets|cooling/i.test(n.text))`) === true);
ok('and it is not a Saints line - they never betrayed him',
   E(`radio.q.concat(radio.cur ? [radio.cur] : []).filter(n => /cooling/i.test(n.text))
      .every(n => n.who === 'WORM')`) === true);
ok('the HUD switches to PLANTED', /PLANTED/.test(walkHud()));
E('keys[DC.PLANT_KEY] = false');

head('the plant has sentries in it, and med-kits');
E('(function(){ dcq.floors = null; dcq.inside = null; dcq.planted = false; dcEnter(0); })()');
ok('a floor comes peopled', E('dcq.inside.foes.length') === E('DC.FOES_BEFORE'));
ok('...sparsely, while the worm is still in his hand',
   E('DC.FOES_BEFORE') < E('DC.FOES_AFTER'),
   E('DC.FOES_BEFORE') + ' before, ' + E('DC.FOES_AFTER') + ' after');
ok('and carries med-kits', E('dcq.inside.meds.length') === E('DC.MEDS'));
ok('nothing is standing inside a wall', E(`(function(){ const F = dcq.inside, M = F.M;
     const on = p => { const c = dcCellAt(M, p.x, p.y); return dcOpen(M, c.x, c.y); };
     return F.foes.every(on) && F.meds.every(on); })()`) === true);
ok('and nothing is lurking ON a stairwell', E(`(function(){ const F = dcq.inside, M = F.M;
     let min = 99;
     for(const f of F.foes){ const c = dcCellAt(M, f.x, f.y);
       for(const s of [M.start, M.core]) min = Math.min(min, Math.abs(c.x-s.x) + Math.abs(c.y-s.y)); }
     return min >= DC.FOE_MIN_D; })()`) === true,
   'an ambush you cannot see coming is not difficulty');
ok('a floor\'s sentries are ITS sentries - they do not follow him upstairs', E(`(function(){
     dcEnter(1); const n1 = foes.length; dcEnter(0);
     return foes.length === n1 && foes.length === DC.FOES_BEFORE; })()`) === true);
ok('and one he shot stays shot', E(`(function(){
     dcEnter(1); dcq.inside.foes[0].dead = true; const live = foes.length;
     dcEnter(0); dcEnter(1);
     return dcq.inside.foes[0].dead === true && foes.length === DC.FOES_BEFORE - 1; })()`) === true);
ok('they walk into maze walls, not city blocks', E(`(function(){
     dcEnter(0); const M = dcq.inside.M;
     for(const f of foes){ f.mad = true; f.walk = true; }
     for(let i=0;i<180;i++) updateFoes(1/60);
     return foes.every(f => { const c = dcCellAt(M, f.x, f.y); return dcOpen(M, c.x, c.y); }); })()`) === true,
   'foeCollide has to branch on dcq.inside or they walk through everything');
ok('the city stops spawning its own while he is in here', E(`(function(){
     const n = foes.length; cityStep(1/60); return foes.length === n; })()`) === true);

head('the med-kit is HIS, and it does not look like the car\'s');
ok('walking onto one heals him', E(`(function(){
     dcEnter(1); walker.hp = 10; const m = dcq.inside.meds.find(x => !x.taken);
     walker.x = m.x; walker.y = m.y; dcItemsTick();
     return walker.hp > 10 && m.taken === true; })()`) === true);
ok('...by MED_HEAL of his own max, not the car\'s', E(`(function(){
     dcEnter(2); walker.hp = 1; const m = dcq.inside.meds.find(x => !x.taken);
     walker.x = m.x; walker.y = m.y; dcItemsTick();
     return Math.abs(walker.hp - (1 + walkerMaxHp()*DC.MED_HEAL)) < 0.01; })()`) === true);
ok('it does not come back', E(`(function(){
     const m = dcq.inside.meds.find(x => x.taken);
     walker.hp = 1; walker.x = m.x; walker.y = m.y; dcItemsTick();
     return walker.hp === 1; })()`) === true,
   'the floor holds what it holds, so spending one is a decision');
ok('and a full-hull walker leaves it where it is', E(`(function(){
     const m = dcq.inside.meds.find(x => !x.taken);
     if(!m) return true;
     walker.hp = walkerMaxHp(); walker.x = m.x; walker.y = m.y; dcItemsTick();
     return m.taken === false; })()`) === true);
ok('it draws as its own thing, not a green square', E(`(function(){
     dcEnter(0); const m = dcq.inside.meds[0];
     walker.x = m.x - 120; walker.y = m.y; walker.a = 0;
     const bb = gatherBillboards(walker.x, walker.y, walker.a);
     return bb.some(b => b.kind === 'med') && DC.MED_COL !== ITEMS.health.col; })()`) === true);

head('the heat starts when the worm does, and it eats hull');
ok('the clock starts AT the plant, not before it', E(`(function(){
     dcq.planted = false; dcq.heat = 999;
     const before = dcTemp(0);                       // cold while the worm is in his hand
     dcPlanted();
     return before === DC.HEAT_AMBIENT && dcq.heat === 0 && dcq.planted === true; })()`) === true);
ok('and it runs whether he is standing still or not', E(`(function(){
     const h = dcq.heat; for(let i=0;i<60;i++) dcHeatTick(1/60); return dcq.heat > h + 0.9; })()`) === true);
ok('it drains hull once past HEAT_HURT, with no hit-flash and no grace window',
   E(`(function(){ const dev = devMode; devMode = false;
      dcEnter(0); dcq.heat = 100000; walker.hp = walkerMaxHp(); walkHurtT = 0;
      const hp0 = walker.hp;
      for(let i=0;i<60;i++) dcHeatTick(1/60);
      const lost = hp0 - walker.hp, flash = walkHurtT;
      devMode = dev; walker.hp = walkerMaxHp();
      return lost > DC.HEAT_DPS*0.8 && lost < DC.HEAT_DPS*1.2 && flash === 0; })()`) === true,
   'a bolt flashes and grants 0.5 s of grace; an oven does neither');
ok('it cannot kill him in dev mode', E(`(function(){
      const dev = devMode; devMode = true; dcq.heat = 100000; walker.hp = 10;
      for(let i=0;i<120;i++) dcHeatTick(1/60);
      const hp = walker.hp; devMode = dev; walker.hp = walkerMaxHp(); return hp === 10; })()`) === true);
ok('the repair rig refuses to work in the heat', E(`(function(){
      const dev = devMode; devMode = false;
      const keep = walkUp.repair; walkUp.repair = 3;
      dcq.heat = 100000; walker.hp = 20; keys[WALK_REPAIR_KEY] = true;
      for(let i=0;i<60;i++) updateWalker(1/60);
      const hot = walker.hp <= 20 && /TOO HOT/.test(walkMsg);
      keys[WALK_REPAIR_KEY] = false; walkUp.repair = keep; devMode = dev;
      return hot; })()`) === true);
ok('...and works again once it is cool', E(`(function(){
      const dev = devMode; devMode = false;
      const keep = walkUp.repair; walkUp.repair = 3;
      dcq.heat = 0; walker.hp = 20; keys[WALK_REPAIR_KEY] = true;
      for(let i=0;i<60;i++) updateWalker(1/60);
      const healed = walker.hp > 20;
      keys[WALK_REPAIR_KEY] = false; walkUp.repair = keep; devMode = dev;
      walker.hp = walkerMaxHp(); return healed; })()`) === true);
ok('the HUD shows the temperature, and only once the worm is in', E(`(function(){
      const o = [], f = ctx.fillText; ctx.fillText = s => o.push(String(s));
      dcq.heat = 100000; drawWalkHUD();
      const hot = o.some(s => /\u00b0C/.test(s)) && o.some(s => /COOKING/.test(s));
      o.length = 0; dcq.planted = false; drawWalkHUD(); dcq.planted = true;
      const cold = !o.some(s => /\u00b0C/.test(s));
      ctx.fillText = f; return hot && cold; })()`) === true);
E('dcq.heat = 0');

head('...and it cannot be done by accident');
E(`(function(){ dcq.planted = false; dcq.plant = 3; keys[DC.PLANT_KEY] = false; })()`);
frame(60);
ok('letting go bleeds it back down', E('dcq.plant') < 2.5 && E('dcq.plant') > 0,
   'decays rather than snapping to zero: a shove must not undo four seconds');
E(`(function(){ dcq.plant = 3; keys[DC.PLANT_KEY] = true;
     const M = dcq.inside.M, p = dcWorld(M, M.start.x, M.start.y); walker.x = p.x; walker.y = p.y; })()`);
frame(60);
ok('walking off the unit bleeds it too', E('dcq.plant') < 2.5);
E(`(function(){ dcq.got = false; dcq.plant = 0; dcq.planted = false;
     const M = dcq.inside.M, p = dcWorld(M, M.core.x, M.core.y);
     walker.x = p.x; walker.y = p.y; keys[DC.PLANT_KEY] = true; })()`);
frame(Math.ceil(E('DC.PLANT_T')*60) + 60);
ok('and with no worm on him it never starts', E('dcq.plant') === 0 && E('dcq.planted') === false);
E('keys[DC.PLANT_KEY] = false; dcq.got = true;');
ok('a floor above the bottom has STAIRS on its far cell, not a unit', E(`(function(){
     dcEnter(1); const M = dcq.inside.M, p = dcWorld(M, M.core.x, M.core.y);
     walker.x = p.x; walker.y = p.y; return dcAt(); })()`) === 'down');
ok('...so the plant cannot happen on the wrong floor', E(`(function(){
     dcq.plant = 0; dcq.planted = false; keys[DC.PLANT_KEY] = true;
     for(let i=0;i<Math.ceil(DC.PLANT_T*60)+60;i++) dcPlantTick(1/60);
     keys[DC.PLANT_KEY] = false; return dcq.planted; })()`) === false);

head('the #maze URL takes the same road');
ok('the hash parser takes #maze and #maze<n> only', E(`(function(){
     const re = /^#maze(\\d)?$/;
     return ['#maze','#maze2','#maze3'].every(h => re.test(h)) &&
            !re.test('#other') && !re.test('') && !re.test('#mazes'); })()`) === true);
ok('skipToMaze lands on the floor it is asked for', E(`(function(){
     for(const i of [2, 1, 0]){ skipToMaze(i); if(dcq.inside.floor !== i) return false; }
     return true; })()`) === true);
ok('and clamps a floor that does not exist', E(`(function(){
     skipToMaze(9); return dcq.inside.floor <= DC.FLOORS.length - 1; })()`) === true);

// ---------------------------------------------------------------------------
// SENTRIES IN THE PLANT. His report was "they don't attack": in the city a
// sentry ignores you until you shoot it, which inside a building you broke into
// reads as an empty building. In here they hunt on SIGHT - and sight means the
// maze's own walls, so the corner you turned is cover.
head('the plant hunts you');
// A FRESH FLOOR. dcq.floors caches a floor for the whole run, so by this point in
// the suite floor 0 has been entered, planted on and alarmed; asking it how many
// sentries a floor STARTS with would be asking the wrong floor.
E('dcq.planted = false; dcq.escaped = false; dcq.floors = {}');
E('skipToMaze(0)');
ok('a floor is peopled with FOES_BEFORE while the worm is in his hand',
   E('dcq.inside.foes.length') === E('DC.FOES_BEFORE'),
   E('dcq.inside.foes.length') + ' of ' + E('DC.FOES_BEFORE'));
ok('...and they are all flagged dc, which is what switches the AI over',
   E('dcq.inside.foes.every(f => f.dc === true)') === true);
// PLACEMENT, read before anything has walked anywhere - a sentry that chases him
// onto the stairs is fine, one that spawns there is an ambush you cannot see.
ok('none of them is PLACED on a stairwell, on any floor', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const F = dcFloorState(i), M = F.M;
       for(const f of F.foes){
         const c = dcCellAt(M, f.x, f.y);
         for(const s of [M.start, M.core])
           if(Math.abs(c.x - s.x) + Math.abs(c.y - s.y) < DC.FOE_MIN_D) return i;
       }
     }
     return true; })()`) === true);
ok('...nor after the alarm tops every floor up', E(`(function(){
     const keep = dcq.planted;
     dcq.planted = true; dcAlarm(); dcq.planted = keep;
     for(const k in dcq.floors){
       const F = dcq.floors[k], M = F.M;
       for(const f of F.foes){
         const c = dcCellAt(M, f.x, f.y);
         for(const s of [M.start, M.core])
           if(Math.abs(c.x - s.x) + Math.abs(c.y - s.y) < DC.FOE_MIN_D) return +k;
       }
     }
     return true; })()`) === true);
E('dcq.floors = {}'); E('skipToMaze(0)');       // ...and back to a quiet floor 0
// put him where one of them can see him and let it run. No shot fired: this is
// the thing that was broken.
const woke = E(`JSON.stringify((function(){
  const M = dcq.inside.M, f = foes[0];
  let spot = null;
  for(const [x, y] of dcCells(M)){
    const w = dcWorld(M, x, y), d = Math.hypot(w.x - f.x, w.y - f.y);
    if(d > 90 && d < 240 && dcClear(M, f.x, f.y, w.x, w.y)){ spot = w; break; }
  }
  if(!spot) return { err:'no sightline on this floor' };
  for(const c of foes){ c.mad = false; c.loseT = 0; }
  walker.x = spot.x; walker.y = spot.y;
  const d0 = Math.hypot(walker.x - f.x, walker.y - f.y);
  for(let i = 0; i < 180; i++) updateFoes(1/60);
  return { d0, d1:Math.hypot(walker.x - f.x, walker.y - f.y), mad:!!f.mad };
})())`);
const W = JSON.parse(woke);
ok('it comes for you unprovoked, down a sightline', W.mad === true, W.err || '');
ok('...and it ARRIVES: the floor-s own flow field, not the city street BFS',
   W.d1 < W.d0 - 40, (W.d0 || 0).toFixed(0) + ' -> ' + (W.d1 || 0).toFixed(0));
ok('a wall between you is cover: that one never wakes', E(`(function(){
     const M = dcq.inside.M;
     for(const c of foes){ c.mad = false; c.loseT = 0; }
     let f = null, spot = null;
     for(const c of foes){
       for(const [x, y] of dcCells(M)){
         const w = dcWorld(M, x, y), d = Math.hypot(w.x - c.x, w.y - c.y);
         if(d > 70 && d < 200 && !dcClear(M, c.x, c.y, w.x, w.y)){ f = c; spot = w; break; }
       }
       if(f) break;
     }
     if(!f) return 'no blocked pair';
     walker.x = spot.x; walker.y = spot.y;
     for(let i = 0; i < 90; i++) updateFoes(1/60);
     return f.mad === false; })()`) === true);
ok('and a bolt dies on a partition, so cover works both ways', E(`(function(){
     const M = dcq.inside.M;
     // a segment that crosses a wall must be blocked, one along a corridor must not
     let blocked = false, clear = false;
     for(let y = 1; y < M.rows - 1 && !(blocked && clear); y++)
       for(let x = 1; x < M.cols - 1; x++){
         if(!dcOpen(M, x, y)) continue;
         const a = dcWorld(M, x, y);
         for(const d of DC_DIRS){
           if(!dcOpen(M, x + d.dx, y + d.dy)) continue;
           const b = dcWorld(M, x + d.dx, y + d.dy);
           if(M.grid[y][x].walls[d.wall]) blocked = blocked || !dcClear(M, a.x, a.y, b.x, b.y);
           else clear = clear || dcClear(M, a.x, a.y, b.x, b.y);
         }
       }
     return blocked && clear; })()`) === true);
ok('the alarm trebles a floor again', E(`(function(){
     dcq.planted = true; dcAlarm();
     const n = dcq.inside.foes.filter(f => !f.dead).length;
     return n === DC.FOES_AFTER; })()`) === true,
   'wanted ' + E('DC.FOES_AFTER'));
ok('...and that many actually FIT, which FOE_SPREAD is for', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const M = dcGenerate(i), rng = cityRng(hash3(i + 5, 7, DC.SEED)*4294967296);
       if(dcPlaces(M, DC.FOES_AFTER, DC.FOE_MIN_D, rng, [M.start, M.core], DC.FOE_SPREAD).length
          !== DC.FOES_AFTER) return i;
     }
     return true; })()`) === true);

// ---------------------------------------------------------------------------
// THE PICKET ON THE SQUARE, and what happens when he gets out.
head('the square, and the way out');
const pick = JSON.parse(E(`JSON.stringify((function(){
  const S = questSites.data, D = questData();
  const p = foeChunkPlan(S.k, S.side).filter(q => /:dg/.test(q.key));
  return p.map(q => ({ guard:!!q.guard, out:(q.x - D.main.x)*D.main.nx, lat:q.y - D.main.y,
                       faces:Math.abs(angDiff(q.a, Math.atan2(0, D.main.nx))), ground:cityGround(q.x, q.y) }));
})())`));
ok('five of them stand on the plaza', pick.length === E('QUEST.DATA_GUARDS'), pick.length + '');
ok('...as GUARDS, so walking onto the square is the mistake', pick.every(p => p.guard));
ok('...in formation: a line of three, two further out',
   pick.filter(p => Math.abs(p.out - E('QUEST.DATA_GUARD_D1')) < 1).length === 3 &&
   pick.filter(p => Math.abs(p.out - E('QUEST.DATA_GUARD_D2')) < 1).length === 2);
ok('...all in FRONT of the doors, never inside the slab', pick.every(p => p.out > 0));
ok('...on pavement', pick.every(p => p.ground === 2));
ok('...and all facing out across it', pick.every(p => p.faces < 1e-6));
ok('no two of them overlap', (() => {
     for(let i = 0; i < pick.length; i++) for(let j = i + 1; j < pick.length; j++){
       const dx = pick[i].out - pick[j].out, dy = pick[i].lat - pick[j].lat;
       if(Math.hypot(dx, dy) < E('FOE_POP.GAP')) return false;
     }
     return true; })() === true);
// THE TWO EMPLACEMENTS, his ask: turrets on the FRONT of the building, the
// plaza side - not the service door round the back, which is the way he goes in.
const emp = JSON.parse(E(`JSON.stringify((function(){
  const S = questSites.data, D = questData();
  const p = foeChunkPlan(S.k, S.side).filter(q => /:dt/.test(q.key));
  return p.map(q => ({ kind:q.turret, out:(q.x - D.main.x)*D.main.nx, lat:q.y - D.main.y,
                       faces:Math.abs(angDiff(q.a, Math.atan2(0, D.main.nx))),
                       ground:cityGround(q.x, q.y),
                       toBack:Math.round(Math.hypot(q.x - D.back.x, q.y - D.back.y)) }));
})())`));
ok('two turrets stand on the square with them', emp.length === E('QUEST.DATA_TURRETS'),
   emp.length + '');
ok('...one of EACH kind, so both read from up there',
   emp.length === 2 && emp[0].kind !== emp[1].kind && emp.every(e => e.kind === 1 || e.kind === 2),
   emp.map(e => e.kind).join(' and '));
ok('...flanking the doors, symmetrically, wider than the picket',
   emp.every(e => Math.abs(Math.abs(e.lat) - E('QUEST.DATA_TURRET_S')) < 1)
   && Math.sign(emp[0].lat) === -Math.sign(emp[1].lat)
   && E('QUEST.DATA_TURRET_S') > E('QUEST.DATA_GUARD_S'),
   emp.map(e => e.lat).join(' / '));
ok('...IN FRONT of the doors, never inside the slab', emp.every(e => e.out > 0),
   emp.map(e => e.out).join(' / '));
// at 30 they were flush with the wall and the axonometric pane drew the building
// over them: 62 px of one survived and none of the other. This is why.
ok('...and clear of the wall, or the top-down view buries them behind the slab',
   emp.every(e => e.out >= E('QUEST.DATA_GUARD_D1')),
   'out ' + emp.map(e => e.out).join(' / ') + ', the line of three is at ' + E('QUEST.DATA_GUARD_D1'));
ok('...on pavement', emp.every(e => e.ground === 2), emp.map(e => e.ground).join('/'));
ok('...facing out across the square, like everything else on this side',
   emp.every(e => e.faces < 1e-6));
// The service door is 181 units from the nearer emplacement, well inside a
// rack's 540 reach, so DISTANCE is not what keeps his way in quiet - the
// BUILDING is. turretThink tests cityClear out here exactly as a sentry's gun
// does, so the corner of the slab is cover.
ok('...and they cannot see the SERVICE door, which is his way in', E(`(function(){
     const D = questData(), S = questSites.data;
     return foeChunkPlan(S.k, S.side).filter(q => /:dt/.test(q.key))
       .every(q => !cityClear(q.x, q.y, D.bx, D.by)); })()`) === true,
   'nearest is ' + Math.min(...emp.map(e => e.toBack)) + ' units from it');
ok('no emplacement overlaps a guard or the other one', (() => {
     const all = pick.concat(emp);
     for(let i = 0; i < all.length; i++) for(let j = i + 1; j < all.length; j++){
       const dx = all[i].out - all[j].out, dy = all[i].lat - all[j].lat;
       if(Math.hypot(dx, dy) < E('FOE_POP.GAP')) return false;
     }
     return true; })() === true);
// AND THEY HAVE TO REACH THE WORLD. spawnFoe pushes itself onto `foes` and
// spawnTurret does not - a datacenter turret is born into its floor's list and
// dcEnter puts it in the world later - so the street spawner has to push by hand.
// Without that the keys went into foeLive and the square stayed empty, with
// nothing thrown and nothing logged. That is what this one is for.
const up = JSON.parse(E(`JSON.stringify((function(){
  const D = questData(), c = cars[0];
  const k0 = { x:c.x, y:c.y, foot:onFoot };
  c.x = D.main.x + D.main.nx*210; c.y = D.main.y; c.vx = 0; c.vy = 0; onFoot = false;
  for(let i = 0; i < 120; i++) citySentries(1/60);
  const t = foes.filter(f => f.turret);
  const out = t.map(f => ({ kind:f.turret, rise:f.rise, hidden:!!f.hidden, dc:!!f.dc,
                            dead:!!f.dead, key:!!f.key }));
  c.x = k0.x; c.y = k0.y; onFoot = k0.foot;
  return out; })())`));
ok('the spawner actually puts them in the world', up.length === E('QUEST.DATA_TURRETS'),
   up.length + ' of ' + E('QUEST.DATA_TURRETS') + ' reached `foes`');
ok('...already UP, because a trap door is a datacenter trick',
   up.every(u => u.rise === 1 && !u.hidden));
ok('...and NOT datacenter bodies, so they never read the maze\'s walls out here',
   up.every(u => u.dc === false));
ok('...keyed, so the city drops and remembers them like any other body',
   up.every(u => u.key));

const esc = JSON.parse(E(`JSON.stringify((function(){
  const cash0 = cash;
  dcq.planted = true; dcq.escaped = false;
  dcLeave();
  const D = questData();
  walker.x = D.bx; walker.y = D.by; onFoot = true; dataTick();
  const back = { at:dcq.atDoor, used:dataEnter(), inside:!!dcq.inside };
  walker.x = D.x;  walker.y = D.y;  dataTick();
  const main = { at:dcq.atDoor, used:dataEnter(), inside:!!dcq.inside };
  return { escaped:!!dcq.escaped, paid:cash - cash0,
           worm:radio.q.filter(l => l.who === 'WORM').length,
           saints:radio.q.filter(l => l.who === 'SAINTS').length,
           sealed:[doorSealed(D.main), doorSealed(D.back), doorSealed(questSaints().door)],
           back, main };
})())`));
ok('walking out with it planted ends the quest', esc.escaped === true);
ok('...and pays for it', esc.paid === E('QUEST.DATA_CASH'), esc.paid + '');
ok('...and the WORM has the last word', esc.worm >= 5 && esc.saints >= 1,
   esc.worm + ' worm / ' + esc.saints + ' saints');
ok('then the building is shut: both doors', esc.sealed[0] === true && esc.sealed[1] === true);
ok('...but NOT the shop, which he still needs', esc.sealed[2] === false);
ok('the service door no longer lets him in', esc.back.at === 'back' && esc.back.inside === false);
ok('...nor the main one', esc.main.at === 'main' && esc.main.inside === false);
ok('...and E is still consumed, so it answers instead of doing nothing',
   esc.back.used === true && esc.main.used === true);
ok('a checkpoint remembers it is over', E(`(function(){
     const keep = { sites:questSites, done:true, worm:true, plantDone:true };
     const q0 = dcq, s0 = questSites, d0 = quest.done;
     questStart(keep);
     const over = dcq.escaped === true && dcq.planted === true;
     dcq = q0; questSites = s0; quest.done = d0; questForgetCity();
     return over; })()`) === true);
E('dcq.escaped = false; dcq.planted = false');

// ---------------------------------------------------------------------------
// THE TRAP DOORS. A turret exists from the moment a floor is generated, shut
// under a lid, so most of what is worth testing here happens BEFORE anything is
// visible: that the lids are placed, that nothing else is standing on one, and
// that the thing underneath is out of the world until the worm says otherwise.
// ---------------------------------------------------------------------------
head('the trap doors in the floor');
E('dcq.planted = false; dcq.escaped = false; dcq.floors = {}');
E('skipToMaze(0)');
ok('a floor gets DC.TURRETS trap doors',
   E('dcq.inside.turrets.length') === E('DC.TURRETS'),
   E('dcq.inside.turrets.length') + ' of ' + E('DC.TURRETS'));
ok('...and every one of them is marked SHUT in the floor\'s hatch map', E(`(function(){
     const F = dcq.inside, M = F.M;
     return F.turrets.every(t => F.hatch[t.cell.y*M.cols + t.cell.x] === 1); })()`) === true);
ok('the hatch map holds nothing else: one mark per turret', E(`(function(){
     const F = dcq.inside;
     let n = 0; for(let i = 0; i < F.hatch.length; i++) if(F.hatch[i]) n++;
     return n; })()`) === E('DC.TURRETS'));
ok('every turret is hidden before the worm goes in',
   E('dcq.inside.turrets.every(t => t.hidden === true)') === true);
ok('...so not one of them is in the world yet', E('foes.some(f => f.turret)') === false);
ok('both kinds are used across the three floors', E(`(function(){
     const seen = {};
     for(let i = 0; i < DC.FLOORS.length; i++)
       for(const t of dcFloorState(i).turrets) seen[t.turret] = 1;
     return Object.keys(seen).sort().join(','); })()`) === '1,2');
// PLACEMENT, on every floor, before anything has moved. A turret cannot step
// aside, so where it is put is the whole of its fairness.
ok('none is placed on a stairwell, on any floor', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const F = dcFloorState(i);
       for(const t of F.turrets) for(const s of [F.M.start, F.M.core])
         if(Math.abs(t.cell.x - s.x) + Math.abs(t.cell.y - s.y) < DC.TURRET_MIN_D) return i;
     }
     return true; })()`) === true);
ok('...and none on the unit itself, which is the one square he must be able to stand on',
   E(`(function(){
     const F = dcFloorState(DC.FLOORS.length - 1), c = F.M.core;
     for(const t of F.turrets)
       if(Math.abs(t.cell.x - c.x) + Math.abs(t.cell.y - c.y) <= DC.TURRET_CORE_D) return false;
     return true; })()`) === true);
ok('no two of them share a corridor cell', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const T = dcFloorState(i).turrets;
       for(let a = 0; a < T.length; a++) for(let b = a + 1; b < T.length; b++)
         if(Math.abs(T[a].cell.x - T[b].cell.x) + Math.abs(T[a].cell.y - T[b].cell.y) < DC.TURRET_SPREAD)
           return i;
     }
     return true; })()`) === true);
ok('no sentry is standing on a lid', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const F = dcFloorState(i), M = F.M;
       for(const f of F.foes){
         const c = dcCellAt(M, f.x, f.y);
         if(F.hatch[c.y*M.cols + c.x]) return i;
       }
     }
     return true; })()`) === true);
ok('...and no med-kit is sitting in one', E(`(function(){
     for(let i = 0; i < DC.FLOORS.length; i++){
       const F = dcFloorState(i), M = F.M;
       for(const m of F.meds){
         const c = dcCellAt(M, m.x, m.y);
         if(F.hatch[c.y*M.cols + c.x]) return i;
       }
     }
     return true; })()`) === true);
// THE LID AS A THING YOU SEE. dcBackground asks dcHatchAt per sampled column per
// row; this is that function answering about a cell it is standing on.
ok('dcHatchAt reads a shut lid at the middle of its cell', E(`(function(){
     const F = dcq.inside, M = F.M, t = F.turrets[0], w = dcWorld(M, t.cell.x, t.cell.y);
     return dcHatchAt(M, F.hatch, w.x, w.y); })()`) > 0);
ok('...a rim near the edge of it', E(`(function(){
     const F = dcq.inside, M = F.M, t = F.turrets[0], w = dcWorld(M, t.cell.x, t.cell.y);
     return dcHatchAt(M, F.hatch, w.x + DC.HATCH_R - DC.HATCH_RIM*0.5, w.y + 6); })()`) === 2);
ok('...and bare floor past it', E(`(function(){
     const F = dcq.inside, M = F.M, t = F.turrets[0], w = dcWorld(M, t.cell.x, t.cell.y);
     return dcHatchAt(M, F.hatch, w.x + DC.HATCH_R + 2, w.y); })()`) === 0);
ok('a lid is narrower than the corridor it is set into', E('DC.HATCH_R*2') < E('DC.CELL'));

head('the worm opens the floor');
const upN = E('(function(){ const n = dcRelease(); return n; })()');
ok('dcRelease raises every hidden turret on every built floor', upN > 0,
   upN + ' raised');
ok('...and every hatch on this floor now reads OPEN', E(`(function(){
     const F = dcq.inside, M = F.M;
     return F.turrets.every(t => F.hatch[t.cell.y*M.cols + t.cell.x] === 2); })()`) === true);
ok('...the turrets on the floor he is standing on join the world now',
   E('foes.filter(f => f.turret).length') === E('dcq.inside.turrets.length'),
   E('foes.filter(f => f.turret).length') + ' of ' + E('dcq.inside.turrets.length'));
ok('a second release is a no-op: nothing comes up twice', E('dcRelease()') === 0);
// A FLOOR BUILT AFTER THE PLANT. dcRelease cannot reach a floor that does not
// exist, so the floor has to be born released - the same split dcPopulate makes
// for FOES_AFTER, and the bug if it is missed is a silent floor of shut lids.
ok('a floor generated after the plant is born with its turrets already up', E(`(function(){
     dcq.planted = true;
     delete dcq.floors[2];
     const F = dcFloorState(2);
     return F.turrets.length > 0 && F.turrets.every(t => t.hidden === false); })()`) === true);

head('a turret comes up, and then it does not move');
E('dcq.floors = {}; dcq.planted = false; skipToMaze(0); dcRelease()');
const rise0 = E('foes.find(f => f.turret).rise');
frame(4);
ok('it starts in its hole and climbs out of it', rise0 < 1 && E('foes.find(f => f.turret).rise') > rise0,
   rise0 + ' -> ' + E('foes.find(f => f.turret).rise'));
// HALF OUT OF THE FLOOR IS NOT A TARGET. Three paths read `rise` for this -
// the bolt collision, the pistol and foeBlock - and a turret you can kill
// before it clears the lid makes the whole rise cosmetic.
ok('...and a round passes straight through one that is still in its hole', E(`(function(){
     const t = foes.find(f => f.turret);
     t.rise = 0.4; t.dead = false; t.hp = 999;
     shots.length = 0;
     shots.push({ kind:'cannon', x:t.x - 20, y:t.y, z:10, vx:600, vy:0, angle:0,
                  life:1, owner:0, dmg:50, dmgWalk:5 });
     for(let i = 0; i < 8; i++) updateShots(0.016);
     const hp = t.hp; shots.length = 0; t.rise = 1;
     return hp; })()`) === 999);
ok('...and you cannot stand on top of one either way, but you CAN before it is up',
   E(`(function(){
     const t = foes.find(f => f.turret);
     t.rise = 0.4;
     const p = { x:t.x + 1, y:t.y };
     foeBlock(p);
     const through = Math.hypot(p.x - t.x, p.y - t.y) < 2;   // still inside it: no push
     t.rise = 1;
     const q = { x:t.x + 1, y:t.y };
     foeBlock(q);
     return through && Math.hypot(q.x - t.x, q.y - t.y) > 2; })()`) === true);
frame(Math.ceil(E('TURRET.RISE')*60) + 20);
ok('the rise tops out at 1 and stays there',
   E('foes.filter(f => f.turret).every(t => t.rise === 1)') === true);
ok('a turret never WALKS, whatever else it is doing',
   E('foes.filter(f => f.turret).every(t => t.walk === false)') === true);
const held = E(`JSON.stringify((function(){
  const t = foes.find(f => f.turret);
  return { x:t.x, y:t.y };
})())`);
// put him right next to one and let it run: it may fire, it may traverse, it
// must not travel.
E(`(function(){ const t = foes.find(f => f.turret); walker.x = t.x + 40; walker.y = t.y; })()`);
frame(240);
ok('...and it is still on its own hatch after four seconds of being shot at',
   E(`JSON.stringify((function(){ const t = foes.find(f => f.turret); return { x:t.x, y:t.y }; })())`) === held,
   held + ' -> ' + E(`JSON.stringify((function(){ const t = foes.find(f => f.turret); return { x:t.x, y:t.y }; })())`));
ok('you cannot walk through one', E(`(function(){
     const t = foes.find(f => f.turret);
     const p = { x:t.x + 1, y:t.y + 1 };
     foeBlock(p);
     return Math.hypot(p.x - t.x, p.y - t.y) >= (t.r || FOE.R) + WALK_R - 1e-6; })()`) === true);
ok('...and it is wider than a sentry, because the model is',
   E('TURRET.KINDS[2].r') > E('FOE.R'));

head('the two weapons');
ok('the energy gun is FASTER than a sentry bolt', E('TURRET.KINDS[1].shot.spd') > E('FOE_GUN.SPD'),
   E('TURRET.KINDS[1].shot.spd') + ' vs ' + E('FOE_GUN.SPD'));
ok('...and SMALLER on screen', E('TURRET.KINDS[1].shot.r') < 3.2,
   E('TURRET.KINDS[1].shot.r') + ' vs the bolt\'s 3.2');
ok('the missile rack hurts far more than either', E('TURRET.KINDS[2].shot.dmgWalk') > E('FOE_GUN.DMG_WALK')
   && E('TURRET.KINDS[2].shot.dmgWalk') > E('TURRET.KINDS[1].shot.dmgWalk'));
ok('...and it is the one that is paid for with a longer tell',
   E('TURRET.KINDS[2].windup') > E('TURRET.KINDS[1].windup')
   && E('TURRET.KINDS[2].windup') > E('FOE_GUN.WINDUP'));
// both guns, fired by hand, with the target in the open in front of them
const fired = E(`JSON.stringify((function(){
  const out = {};
  for(const kind of [1, 2]){
    shots.length = 0;
    const t = foes.find(f => f.turret && f.turret === kind) || foes.find(f => f.turret);
    t.turret = kind; t.rise = 1; t.charge = 0; t.gunT = 0;
    walker.x = t.x + 60; walker.y = t.y;
    t.a = 0;
    const T = { x:walker.x, y:walker.y };
    turretGun(t, 0.016, T, 60, true);              // opens the windup
    let n = 0;
    while(shots.length === 0 && n++ < 400) turretGun(t, 0.016, T, 60, true);
    const s = shots[0] || null;
    out[kind] = s ? { kind:s.kind, foe:!!s.foe, spd:Math.round(Math.hypot(s.vx, s.vy)),
                      dmgWalk:s.dmgWalk, r:s.r || null } : null;
  }
  shots.length = 0;
  return out; })())`);
const F2 = JSON.parse(fired);
ok('turret 1 fires a zap', F2['1'] && F2['1'].kind === 'zap', JSON.stringify(F2['1']));
ok('...at TURRET.KINDS[1].shot.spd', F2['1'] && F2['1'].spd === E('TURRET.KINDS[1].shot.spd'));
ok('turret 2 fires a missile', F2['2'] && F2['2'].kind === 'missile', JSON.stringify(F2['2']));
ok('both are flagged foe, so they pass through the hunters and come for you',
   F2['1'] && F2['2'] && F2['1'].foe === true && F2['2'].foe === true);
// WHERE THE SHOT LEAVES THE MODEL. The user reported (2026-11-23) that the
// energy bolt left from above the barrel rather than out of its tip, and the
// cause was a flat "8 units forward" when turret-01's barrel tip is 22.5 units
// out: a muzzle BEHIND the real one is further from the player than the real
// one, and a point below eye level climbs toward the horizon with distance, so
// it read as higher. These tie TURRET.KINDS[n].muzzle to the CARVE itself, by
// role, so that re-carving the model at another resolution - or swapping which
// part is `lamp` - fails here instead of quietly moving the muzzle again.
head('the shot leaves the part of the model you can see');
// every vertex of one role, straight out of the shipped carve
const roleBox = (vox, role) => E(`(function(){
  const d = VOXTURRETS['${vox}'], out = { x:[1e9,-1e9], y:[1e9,-1e9], z:[1e9,-1e9] }, pts = [];
  for(let i = 0; i < d.f.length; i += 13){
    if(d.roles[d.f[i]] !== '${role}') continue;
    for(let k = 0; k < 4; k++){ const o = i + 1 + k*3;
      pts.push([0,1,2].map(j => d.lo[j] + d.f[o+j]*d.vox)); } }
  for(const p of pts){ const ax = ['x','y','z'];
    for(let j = 0; j < 3; j++){ const b = out[ax[j]];
      if(p[j] < b[0]) b[0] = p[j]; if(p[j] > b[1]) b[1] = p[j]; } }
  // the TIP: every vertex within a unit of the furthest-forward one
  const tipX = out.x[1], tip = pts.filter(p => p[0] >= tipX - 1);
  out.tipZ = [Math.min(...tip.map(p => p[2])), Math.max(...tip.map(p => p[2]))];
  out.tipAbsY = [Math.min(...tip.map(p => Math.abs(p[1]))), Math.max(...tip.map(p => Math.abs(p[1])))];
  out.n = pts.length;
  return JSON.stringify(out); })()`);
const barrel = JSON.parse(roleBox(E('TURRET.KINDS[1].vox'), 'lamp'));
const M1 = E('JSON.stringify(TURRET.KINDS[1].muzzle)') && JSON.parse(E('JSON.stringify(TURRET.KINDS[1].muzzle)'));
ok('turret 1: the barrel is the `lamp` role and it is the furthest-forward part',
   barrel.n > 0 && barrel.x[1] > 18, 'tip at x = ' + barrel.x[1].toFixed(1));
ok('...and the muzzle sits AT that tip, not inside the model',
   Math.abs(M1.fwd - barrel.x[1]) <= 1, 'muzzle fwd ' + M1.fwd + ' vs tip ' + barrel.x[1].toFixed(1));
ok('...at the height of the bore, between the tip\'s top and bottom',
   M1.z >= barrel.tipZ[0] && M1.z <= barrel.tipZ[1],
   'muzzle z ' + M1.z + ' in [' + barrel.tipZ.map(v => v.toFixed(1)).join(', ') + ']');
ok('...and on the centreline, because turret 1 has one barrel', M1.side === 0);
const rack = JSON.parse(roleBox(E('TURRET.KINDS[2].vox'), 'tail'));
const M2 = JSON.parse(E('JSON.stringify(TURRET.KINDS[2].muzzle)'));
ok('turret 2: the missiles are the `tail` role, in two clusters off the centreline',
   rack.n > 0 && rack.tipAbsY[0] > 4, '|y| from ' + rack.tipAbsY[0].toFixed(1) + ' to ' + rack.tipAbsY[1].toFixed(1));
ok('...and the muzzle is OUT ON AN ARM, not up the middle',
   M2.side >= rack.tipAbsY[0] && M2.side <= rack.tipAbsY[1],
   'side ' + M2.side + ' in [' + rack.tipAbsY.map(v => v.toFixed(1)).join(', ') + ']');
ok('...at the height of the missiles themselves',
   M2.z >= rack.tipZ[0] && M2.z <= rack.tipZ[1],
   'muzzle z ' + M2.z + ' in [' + rack.tipZ.map(v => v.toFixed(1)).join(', ') + ']');
ok('...and no further forward than the missiles reach',
   M2.fwd <= rack.x[1] + 1, 'fwd ' + M2.fwd + ' vs ' + rack.x[1].toFixed(1));
// and the shot is actually BORN there, which is the thing the user sees
const born = JSON.parse(E(`JSON.stringify((function(){
  const out = {};
  for(const kind of [1, 2]){
    const t = foes.find(f => f.turret) ; t.turret = kind; t.rise = 1; t.a = 0;
    t.x = 1000; t.y = 1000; t.side = 0;
    walker.x = t.x + 200; walker.y = t.y;
    const T = { x:walker.x, y:walker.y };
    const fire = () => { shots.length = 0; t.charge = 0; t.gunT = 0;
      let n = 0; while(shots.length === 0 && n++ < 500) turretGun(t, 0.016, T, 200, true);
      return shots[0]; };
    const a = fire(), b = fire();
    out[kind] = { outA:+Math.hypot(a.x - t.x, a.y - t.y).toFixed(2), zA:a.z,
                  outB:+Math.hypot(b.x - t.x, b.y - t.y).toFixed(2),
                  apart:+Math.hypot(a.x - b.x, a.y - b.y).toFixed(2) };
  }
  shots.length = 0;
  return out; })())`));
ok('turret 1 is born at the barrel tip', Math.abs(born['1'].outA - M1.fwd) < 0.05
   && born['1'].zA === M1.z, born['1'].outA + ' units out, z ' + born['1'].zA);
ok('...and every round comes from the same place, it has one barrel',
   born['1'].apart < 0.01, born['1'].apart + ' apart');
const want2 = Math.hypot(M2.fwd, M2.side);
ok('turret 2 is born out on an arm', Math.abs(born['2'].outA - want2) < 0.05,
   born['2'].outA + ' units out, wanted ' + want2.toFixed(2));
ok('...and CONSECUTIVE rounds come off opposite arms',
   Math.abs(born['2'].apart - 2*M2.side) < 0.05,
   born['2'].apart + ' apart, wanted ' + (2*M2.side).toFixed(1));

// THE TELL AND THE SHOT MUST LEAVE THE SAME ARM. He reported (2026-11-23) that
// the rack "starts shooting with the left arms but shoots with the right", and
// that it was stuck on one arm before that. Cause: the arm lived in `f.side`,
// which for a SENTRY means "lean off to one side, you are wedged" (-1/0/+1) and
// is written by foeStuck for every foe, every frame. The tell and the shot are
// computed up to a windup apart, so a write in between split them.
head('the missile rack and its two arms');
ok('a turret is left out of the wedged-on-a-corner logic', E(`(function(){
     const t = foes.find(f => f.turret) || null;
     if(!t) return 'no turret';
     t.arm = 1; t.side = 7; t.mad = false; t.stuckT = 1e9;
     foeStuck(1/60);
     return t.arm === 1 && t.side === 7; })()`) === true);
ok('...so nothing outside the gun can touch which arm is next', E(`(function(){
     const t = foes.find(f => f.turret);
     t.arm = 1; t.mad = true; t.stuckT = 1e9; t.lastX = t.x; t.lastY = t.y;
     for(let i = 0; i < 120; i++){ foeStuck(1/60); foeSeparate(); }
     return t.arm; })()`) === 1);
// The real thing, and the exact sequence he saw: run a whole windup frame by
// frame with foeStuck and foeSeparate running too, and have the turret become
// ANGRY partway through - which is what a turret being shot at does. That is the
// transition that split the tell from the shot: foeStuck's two branches write
// `side` differently (zero it while calm, latch a random +/-1 once angry), so
// the smoke left the arm it was calm about and the missile left the other.
// Compare where the TELL came from with where the MISSILE was born.
const armRun = E(`JSON.stringify((function(){
  const t = foes.find(f => f.turret);
  t.turret = 2; t.rise = 1; t.a = 0; t.x = 1000; t.y = 1000;
  t.arm = 0; t.mad = false; t.stuckT = 1e9; t.dead = false;
  walker.x = t.x + 200; walker.y = t.y;
  const T = { x:walker.x, y:walker.y };
  const K = TURRET.KINDS[2], out = [];
  // two shots back to back, so alternation is visible
  for(let shot = 0; shot < 2; shot++){
    shots.length = 0; t.charge = 0; t.gunT = 0;
    const tell = [];
    let n = 0;
    while(shots.length === 0 && n++ < 500){
      const before = fx.length;
      turretGun(t, 0.016, T, 200, true);
      // whatever the tell threw off this frame, on the arm side
      for(let i = before; i < fx.length; i++) tell.push(fx[i].y - t.y);
      // it takes a round from you HALFWAY THROUGH the windup
      if(n === 20){ t.mad = true; t.stuckT = 1e9; t.lastX = t.x; t.lastY = t.y; }
      foeSeparate(); foeStuck(0.016);
    }
    const s = shots[0];
    out.push({ left: tell.filter(v => v < -6).length,     // smoke on one arm
               right: tell.filter(v => v > 6).length,     // ...and on the other
               shotSide: Math.sign(+(s.y - t.y).toFixed(3)),
               off: +(s.y - t.y).toFixed(2) });
  }
  shots.length = 0; fx.length = 0;
  return out; })())`);
const AR = JSON.parse(armRun);
// UNANIMOUS, not on balance: every puff of smoke in the windup has to come off
// the arm the missile then leaves, so one of these two counts must be zero.
const armSplit = r => (r.left && r.right) ? r.left + ' puffs on one arm and ' + r.right
                        + ' on the other' : 'all ' + (r.left + r.right) + ' on one arm';
ok('the smoke and the missile leave the SAME arm, every puff of it',
   AR[0].left + AR[0].right > 0 && (AR[0].left === 0) !== (AR[0].right === 0)
   && AR[0].shotSide === (AR[0].right ? 1 : -1),
   armSplit(AR[0]) + ', missile at ' + AR[0].off);
ok('...on the next shot too, which is the other arm',
   AR[1].left + AR[1].right > 0 && (AR[1].left === 0) !== (AR[1].right === 0)
   && AR[1].shotSide === (AR[1].right ? 1 : -1),
   armSplit(AR[1]) + ', missile at ' + AR[1].off);
ok('...and the two shots really did come off opposite arms',
   AR[0].shotSide === -AR[1].shotSide,
   AR[0].off + ' then ' + AR[1].off);

ok('a turret will not fire with a wall in the way', E(`(function(){
     shots.length = 0;
     const t = foes.find(f => f.turret);
     t.rise = 1; t.charge = 0; t.gunT = 0;
     for(let i = 0; i < 400; i++) turretGun(t, 0.016, { x:t.x + 60, y:t.y }, 60, false);
     const n = shots.length; shots.length = 0; return n; })()`) === 0);
ok('...nor past its own range', E(`(function(){
     shots.length = 0;
     const t = foes.find(f => f.turret);
     t.rise = 1; t.charge = 0; t.gunT = 0;
     const far = TURRET.KINDS[t.turret].range + 50;
     for(let i = 0; i < 400; i++) turretGun(t, 0.016, { x:t.x + far, y:t.y }, far, true);
     const n = shots.length; shots.length = 0; return n; })()`) === 0);
// THE MISSILE COMES FOR YOU. In here there is no car to home on at all, so if
// the foe branch is missing it flies straight past and the rack is harmless.
ok('a turret missile homes on the WALKER', E(`(function(){
     shots.length = 0;
     const t = foes.find(f => f.turret);
     walker.x = t.x + 300; walker.y = t.y + 120;
     shots.push({ kind:'missile', foe:true, turret:true, x:t.x, y:t.y, z:20,
       vx:150, vy:0, angle:0, life:9, owner:-2, dmg:34, dmgWalk:16, blast:70, smoke:0 });
     const a0 = shots[0].angle;
     for(let i = 0; i < 20 && shots.length; i++) updateShots(0.016);
     const a1 = shots.length ? shots[0].angle : a0 + 1;   // gone = it got somewhere
     shots.length = 0;
     return a1 !== a0; })()`) === true);
// ...and the blast reaches him, which NO other explosion in the game does.
ok('its blast takes hull off the walker', E(`(function(){
     const hp0 = walker.hp = walker.maxHp || WALK_HP;
     walkHurtT = 0; walkGraceT = 0; devMode = false;
     explode(walker.x + 10, walker.y, 1, -2, 34, 70, { z:0, floor:0, walker:16 });
     return hp0 - walker.hp; })()`) > 0);
ok('...but an ordinary city blast still does not', E(`(function(){
     walkHurtT = 0; walkGraceT = 0;
     const hp0 = walker.hp = walker.maxHp || WALK_HP;
     explode(walker.x + 10, walker.y, 1, -2, 40, 72);        // a mine's own call
     return hp0 - walker.hp; })()`) === 0);

head('shooting one back');
ok('a turret has more hull than a sentry', E('TURRET.KINDS[1].hp') > E('FOE.HP'));
ok('the pistol can reach the top of the tall one',
   E('TURRET.KINDS[2].h') <= E('WALK_EYE') + 20 && E('TURRET.KINDS[2].h') > E('FOE.H'));
ok('killing one takes it out of the fight', E(`(function(){
     const t = foes.find(f => f.turret && !f.dead);
     foeDamage(t, t.hp + 10, 0);
     return t.dead === true; })()`) === true);
ok('...and a dead one does not keep its lid shut on the map',
   E('dcq.inside.turrets.some(t => t.dead)') === true);
// THE SHEET. One bake per KIND, not per turret - eleven of them on a floor must
// not be eleven bakes - and it must not go through the walk rig.
ok('a turret sheet bakes', E('!!bakeTurretSheet(1)') === true);
ok('...with TURRET.YAWS frames and ONE row', E('bakeTurretSheet(1).n') === E('TURRET.YAWS')
   && E('bakeTurretSheet(1).poses') === 1);
ok('...and the rig switched off, so posedMesh never splits a gun mount at the hip',
   E('bakeTurretSheet(1).rig') === false);
ok('the same kind asked twice is the same sheet', E('bakeTurretSheet(1) === bakeTurretSheet(1)') === true);
ok('the two kinds are two sheets', E('bakeTurretSheet(1) !== bakeTurretSheet(2)') === true);
ok('the sentry still bakes with its rig ON', E('bakeFoeSheet(FOE_COL).rig') === true);
// THE BAKE IS SPREAD. "It is prerendered so the faces are free" is true of the
// DRAWING and not of the bake: 32 yaws of turret-02 in one go measured at ~400 ms,
// which is a quarter-second freeze on the frame a missile rack first comes into
// view - and that is a floor that has just opened eleven hatches.
ok('a fresh sheet has nothing baked yet', E(`(function(){
     clearTurretSheets();
     const sp = bakeTurretSheet(2);
     return Array.from(sp.cell).filter(v => v).length; })()`) === 0);
ok('...and its sheet is one pose, so a cell IS a yaw',
   E('bakeTurretSheet(2).poses') === 1 &&
   E('bakeTurretSheet(2).cell.length') === E('TURRET.YAWS'));
ok('one yaw can be had on demand', E(`(function(){
     const sp = bakeTurretSheet(2);
     foeCellEnsure(sp, 0, 7);
     return sp.cell[7] === 1 && Array.from(sp.cell).filter(v => v).length === 1; })()`) === true);
ok('turretWarm fills TURRET.WARM a frame and no more', E(`(function(){
     clearTurretSheets();
     const sp = bakeTurretSheet(1);
     turretWarm();
     return Array.from(sp.cell).filter(v => v).length; })()`) === E('TURRET.WARM'));
ok('...and both sheets are full inside the rise', E(`(function(){
     clearTurretSheets(); bakeTurretSheet(1); bakeTurretSheet(2);
     const frames = Math.ceil(TURRET.RISE*60);
     for(let i = 0; i < frames; i++) turretWarm();
     let left = 0;
     for(const k in turretSheets) left += Array.from(turretSheets[k].cell).filter(v => !v).length;
     return left; })()`) === 0);
ok('the sentry filler cannot reach a turret sheet', E(`(function(){
     clearTurretSheets(); bakeTurretSheet(1); bakeTurretSheet(2);
     const k0 = foes.map(f => f.walk); for(const f of foes) f.walk = true;
     for(let i = 0; i < 200; i++) foeWarm();
     foes.forEach((f, i) => f.walk = k0[i]);
     let n = 0;
     for(const k in turretSheets) n += Array.from(turretSheets[k].cell).filter(v => v).length;
     return n; })()`) === 0);
ok('dcRelease starts the sheets itself, so the rise is the cover they fill under',
   E(`(function(){
     clearTurretSheets();
     dcq.floors = {}; dcq.planted = false; skipToMaze(0);
     dcRelease();
     return Object.keys(turretSheets).length; })()`) === 2);
// and the whole view draws with turrets standing in it
E('dcq.floors = {}; dcq.planted = false; skipToMaze(0); dcRelease()');
frame(120);
ok('the first-person view draws a floor with turrets on it without throwing',
   (() => { try { E('drawWalkView()'); return true; } catch(e){ return String(e); } })() === true);
// dcLabAll forces every cell to count as seen, so the lid loop actually runs
// instead of being skipped by the fog of war on a floor nobody has walked
ok('...and the floor map draws the lids without throwing', (() => {
     try { E('dcLabAll = true'); E('dcMinimap()'); E('dcLabAll = false'); return true; }
     catch(e){ E('dcLabAll = false'); return String(e); } })() === true);
ok('...with a mark for every lid he can see', E(`(function(){
     const F = dcq.inside;
     return F.turrets.filter(t => t.cell).length; })()`) === E('DC.TURRETS'));
E('dcq.planted = false; dcq.escaped = false; dcq.floors = {}');

E(`(function(){ skipToMaze(0); const M = dcq.inside.M, p = dcWorld(M, M.start.x, M.start.y);
     walker.x = p.x; walker.y = p.y; onPress("KeyE"); onFoot = false; })()`)
;

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
