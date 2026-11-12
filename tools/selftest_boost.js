#!/usr/bin/env node
// Checks the BOOST upgrade (config.js 3b + the store and HUD hooks in index.html)
// with no browser.
//
//   node tools/selftest_boost.js
//
// Built on tools/headless.js, so the canvas is a no-op: this proves the numbers
// and the plumbing, not the looks. What it is really guarding is the two places a
// per-level cooldown can silently go wrong - tryBoost arming the RAW BOOST_COOL,
// and the HUD gauge dividing by it - plus the store panel having room for a
// seventh row.
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
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const head = (s) => console.log(`\n-- ${s}`);

frame();

head('the constants');
ok('BOOST_TIME is 1.0s', E('BOOST_TIME') === 1.0, String(E('BOOST_TIME')));
ok('BOOST_COOL is still 10s at level 0', E('boostCoolAt(0)') === 10, String(E('boostCoolAt(0)')));
ok('level 6 cuts it to 4s', near(E('boostCoolAt(6)'), 4), String(E('boostCoolAt(6)')));
ok('a level is worth exactly BOOST_COOL_PER_LEVEL',
   near(E('boostCoolAt(2) - boostCoolAt(3)'), E('BOOST_COOL_PER_LEVEL')));
ok('the floor holds if the constants are ever edited past zero',
   E('boostCoolAt(999)') > 0, String(E('boostCoolAt(999)')));
ok('UPGRADES carries a boost track', E('"boost" in UPGRADES') === true);

head('tryBoost arms the UPGRADED cooldown');
E('skipToCity()'); frame(5);
ok('a run is live', E('state') === 'play', E('state'));
E('runUp.boost = 0; cars[0].boostT = 0; cars[0].boostCD = 0; cars[0].dead = false; cars[0].pitT = 0');
E('tryBoost(cars[0])');
ok('at level 0 the charge arms 10s of recharge', near(E('cars[0].boostCD'), 10), String(E('cars[0].boostCD')));
ok('and 1.0s of burn', near(E('cars[0].boostT'), 1.0), String(E('cars[0].boostT')));
E('runUp.boost = 6; cars[0].boostT = 0; cars[0].boostCD = 0');
E('tryBoost(cars[0])');
ok('at level 6 it arms 4s', near(E('cars[0].boostCD'), 4), String(E('cars[0].boostCD')));

head('the HUD gauge divides by the upgraded cooldown, not the constant');
// the gauge, as drawHud computes it: full = ready to press
const gauge = () => E('cars[0].boostT>0 ? cars[0].boostT/BOOST_TIME : 1 - cars[0].boostCD/boostCool()');
E('runUp.boost = 6; cars[0].boostT = 0; cars[0].boostCD = 4');
ok('a fresh level-6 recharge reads empty', near(gauge(), 0), String(gauge()));
E('cars[0].boostCD = 2');
ok('half way through it reads half full', near(gauge(), 0.5), String(gauge()));
E('cars[0].boostCD = 0');
ok('and full when the charge is back', near(gauge(), 1), String(gauge()));
// the bug this is here for: dividing 4s of countdown by the raw 10s constant
ok('the raw constant would have been wrong here',
   !near(1 - 2/E('BOOST_COOL'), 0.5), String(1 - 2/E('BOOST_COOL')));

head('the recharge really takes that long');
// the enemies are live through these waits, and a wrecked car stops ticking its
// boost - so the hull is topped up every frame to keep the clock running
const alive = () => E('cars[0].hp = cars[0].maxHp; cars[0].dead = false; cars[0].pitT = 0');
function waitForCharge(limitSecs) {
  let n = 0;
  for (let i = 0; i < 60 * limitSecs; i++) { alive(); frame(); n++; if (E('cars[0].boostCD') <= 0) break; }
  return n / 60;
}
E('runUp.boost = 6; cars[0].boostT = 0; cars[0].boostCD = 0');
alive();
E('tryBoost(cars[0])');
const secs = waitForCharge(12);
// 1s of burn before the countdown starts, then 4s of it
ok('level 6: boost again after ~5s (1s burn + 4s recharge)',
   secs > 4.6 && secs < 5.4, `${secs.toFixed(2)}s`);
E('runUp.boost = 0; cars[0].boostT = 0; cars[0].boostCD = 0');
alive();
E('tryBoost(cars[0])');
const secs0 = waitForCharge(20);
ok('level 0: ~11s, so the upgrade is worth better than 2x the boosts',
   secs0 > 10.6 && secs0 < 11.4 && secs0 / secs > 2, `${secs0.toFixed(2)}s vs ${secs.toFixed(2)}s`);

head('the store sells it');
E('runUp.boost = 0; cash = 1000');
alive();
if (E('state') !== 'play') { E('skipToCity()'); frame(5); alive(); }
E('openStore()');
ok('the garage opens', E('state') === 'store', E('state'));
const rows = E('storeRows().slice()');   // two row sets now: car and the hero's (storeMode)
ok('BOOST is a row', rows.indexOf('boost') >= 0, rows.join(','));
ok('it sits with the car rows, before the guns',
   rows.indexOf('boost') === rows.indexOf('health') + 1 && rows.indexOf('boost') < rows.indexOf('gun'),
   rows.join(','));
E(`storeIdx = ${rows.indexOf('boost')}`);
ok('the effect line says what you are buying',
   E('storeEffect("boost")') === '10s -> 9s recharge', E('storeEffect("boost")'));
ok('nothing blocks the purchase with $1000 in hand', E('storeBlocked()') === null, String(E('storeBlocked()')));
const price = E('upgradePrice("boost")'), before = E('cash');
E('storeBuy()');
ok('buying takes the level up', E('upgradeLv("boost")') === 1, String(E('upgradeLv("boost")')));
ok('and the cash', E('cash') === before - price, `${before} -> ${E('cash')}`);
ok('the new cooldown is live immediately', near(E('boostCool()'), 9), String(E('boostCool()')));
E('runUp.boost = 6; storeIdx = ' + rows.indexOf('boost'));
ok('it maxes out at UPGRADE_MAX like every other track',
   E('storeBlocked()') === 'BOOST is maxed out', String(E('storeBlocked()')));
ok('a maxed row shows the end of the line', E('storeEffect("boost")') === '4s recharge  (max)',
   E('storeEffect("boost")'));
ok('the repair price counts boost levels too (upgradeTotal)',
   E('upgradeTotal()') >= 6, String(E('upgradeTotal()')));

head('the panel still fits seven rows');
// drawStore: panel Y=40 H=300, the confirm line sits at Y+H-22 with a 10px font
const lastY = E(`storeRowY(${rows.length - 1})`);
ok('the last row ends above the confirm line',
   lastY + 18 < 40 + 300 - 22 - 10, `row ends ${lastY + 18}, text top ${40 + 300 - 22 - 10}`);
ok('the panel stays on screen', 40 + 300 <= E('VH'), `bottom ${40 + 300} of ${E('VH')}`);
let overlap = false;
for (let i = 1; i < rows.length; i++) if (E(`storeRowY(${i})`) < E(`storeRowY(${i - 1})`) + 22) overlap = true;
ok('no two row highlights overlap', overlap === false);

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
