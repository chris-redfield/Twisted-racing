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
ok('baking 32 frames does not throw', bakeErr === null, bakeErr && bakeErr.message);
ok('the sheet has 32 frames', E('bakeFoeSheet(FOE_COL).n') === 32);
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
ok('32 frames here as well', E('bakeFoe2D(FOE_COL).n') === 32);
ok('it is baked at the current S, so the zoom ease can scale it',
   E('bakeFoe2D(FOE_COL).S') === E('S'));
ok('a rescale drops it (same hook that clears CAR2D)',
   E('clearFoeSheets(); Object.keys(foeSheets2D).length') === 0);
let drawErr = null;
try { frame(20); } catch (e) { drawErr = e; }
ok('20 frames driving past a sentry, no runtime error', drawErr === null, drawErr && drawErr.message);
ok('and it is still there', E('foes.length') === 1);
E('clearFoes()');

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
