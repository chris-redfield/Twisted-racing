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

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
