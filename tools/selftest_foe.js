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
E('clearFoes(); const w = walker; const f = spawnFoe(w.x + 300, w.y, 0); f.mad = true');
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
const nFoe = E('foes.filter(f => f.ck).length');
ok('the city has placed some', nFoe > 0, String(nFoe));
ok('every one is standing on a PAVEMENT (cityGround 2)',
   E('foes.filter(f => f.ck).every(f => cityGround(f.x, f.y) === 2)') === true);
ok('each one that has a body is in the live index',
   E('foes.filter(f => f.key).every(f => foeLive.has(f.key))') === true);
// DROP, not KEEP. KEEP is where a sentry is GIVEN a body; it keeps it until
// DROP, so the band between the two is legitimately occupied once you have moved
// at all. (Asserting KEEP here passed only while the city was thin enough that
// the band usually happened to be empty - one density knob away from failing.)
ok('and every one with a body is inside DROP',
   E('foes.filter(f => f.key).every(f => Math.hypot(f.x - walker.x, f.y - walker.y) <= FOE_POP.DROP)') === true);
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
const nearest = E('Math.min(...foes.filter(f => f.key).map(f => Math.hypot(f.x - walker.x, f.y - walker.y)))');
ok('and one is close enough to the road to READ when you get out of the car',
   nearest < 400, `nearest is ${Math.round(nearest)} units (22 units tall; past ~600 it is a speck)`);
ok('...while the live set is still only what is near you, not a whole chunk',
   E('foes.filter(f => f.key).length') < E('(() => { let n = 0; for(const v of foePlans.values()) n += v.length; return n; })()'),
   `${E('foes.filter(f => f.key).length')} with a body of ${E('(() => { let n = 0; for(const v of foePlans.values()) n += v.length; return n; })()')} planned`);

head('the same city gives the same sentries back (nothing is saved)');
// Compared over the ones inside KEEP only: cityFoesOff takes away everything
// with a key, including any sitting out in the KEEP..DROP band, and coming back
// only re-bodies what is inside KEEP. The band is therefore expected to differ,
// and the determinism claim is about the inside-KEEP set.
const snap = '(() => foes.filter(f => f.key && Math.hypot(f.x - walker.x, f.y - walker.y) <= FOE_POP.KEEP)' +
             '.map(f => f.key + "@" + Math.round(f.x) + "," + Math.round(f.y)).sort().join("|"))()';
const before = E(snap);
E('cityFoesOff()');
ok('cityFoesOff takes the city’s away', E('foes.filter(f => f.ck).length') === 0);
frame(40);
ok('and they come back in exactly the same places',
   E(snap) === before, `${before.split('|').length} sentries compared`);

head('...but a sentry you WRECKED stays wrecked');
E('const f = foes.find(x => x.ck); globalThis.__k = f.key; f.hp = 1; foeDamage(f, 50, 0)');
ok('the kill is remembered by key', E('foeKilled.has(__k)') === true);
E('walker.y -= 12000'); frame(40);
ok('walking right out of the city drops them', E('foes.filter(f => f.ck && f.ck.startsWith("-11")).length') === 0);
E('walker.y += 12000'); frame(40);
ok('coming back brings the others', E('foes.filter(f => f.ck).length') > 0);
ok('...and leaves the one you killed lying where it fell',
   E('foes.some(f => f.key === __k)') === false);

head('a sentry dropped by hand (Z) is never culled by the spawner');
E('clearFoes(); const w = walker; spawnFoe(w.x + 100, w.y, 0)');
ok('it has no chunk', E('foes[0].ck') === null);
E('walker.y -= 12000'); frame(40);
ok('and it survives being left 12000 units behind', E('foes.some(f => !f.ck)') === true);

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

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
