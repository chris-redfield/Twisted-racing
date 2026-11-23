#!/usr/bin/env node
// The DATACENTER's floor generator (maze.js + DC in config.js).
//
//   node tools/selftest_maze.js
//
// The point of these is the BRAID. The generator this was ported from makes a
// spanning tree - one path between any two cells - which is survivable going
// down and lethal coming up (HANDOFF.md 2026-11-17). So the tests that matter
// are the ones counting CYCLES, not the ones counting walls.
'use strict';
const path = require('path');
const { load } = require('./headless.js');

const g = load(path.join(__dirname, '..', 'index.html'));
const E = g.E;
let fails = 0, total = 0;
function ok(name, cond, extra = ''){
  total++;
  if(cond) console.log(`  ok   ${name}`);
  else { fails++; console.log(`  FAIL ${name}${extra ? '  <- ' + extra : ''}`); }
}
const head = s => console.log(`\n-- ${s}`);

// read a floor back out of the sandbox as plain JSON
const gen = (i, seed) => E(`JSON.stringify((function(){
  const M = dcGenerate(${i}${seed === undefined ? '' : ', ' + seed});
  return { name:M.name, cols:M.cols, rows:M.rows, grid:M.grid, regions:M.regions,
           corridors:M.corridors, braided:M.braided, extra:M.extra };
})())`);

// --- graph helpers, computed HERE rather than trusted from the generator
const DIRS = [ {dx:0,dy:-1,w:'top'}, {dx:1,dy:0,w:'right'}, {dx:0,dy:1,w:'bottom'}, {dx:-1,dy:0,w:'left'} ];
const open = (M,x,y) => x>=0 && x<M.cols && y>=0 && y<M.rows &&
                        (M.grid[y][x].region >= 0 || M.grid[y][x].corridor >= 0);
function cells(M){
  const out = [];
  for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++) if(open(M,x,y)) out.push([x,y]);
  return out;
}
// undirected edges between open neighbours whose shared wall is down
function edges(M){
  let n = 0;
  for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++){
    if(!open(M,x,y)) continue;
    if(!M.grid[y][x].walls.right  && open(M,x+1,y)) n++;
    if(!M.grid[y][x].walls.bottom && open(M,x,y+1)) n++;
  }
  return n;
}
function reach(M, sx, sy){
  const seen = new Set([sx+','+sy]), q = [[sx,sy]];
  while(q.length){
    const [x,y] = q.pop();
    for(const d of DIRS){
      const nx=x+d.dx, ny=y+d.dy, k=nx+','+ny;
      if(M.grid[y][x].walls[d.w] || !open(M,nx,ny) || seen.has(k)) continue;
      seen.add(k); q.push([nx,ny]);
    }
  }
  return seen;
}
function deadEnds(M){
  let n = 0;
  for(const [x,y] of cells(M)){
    let e = 0;
    for(const d of DIRS) if(!M.grid[y][x].walls[d.w] && open(M,x+d.dx,y+d.dy)) e++;
    if(e <= 1) n++;
  }
  return n;
}
// walls are shared state: every down wall must be down on the other side too
function wallsAgree(M){
  for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++){
    if(!M.grid[y][x].walls.right  && x+1 < M.cols && M.grid[y][x+1].walls.left) return false;
    if(!M.grid[y][x].walls.bottom && y+1 < M.rows && M.grid[y+1][x].walls.top)  return false;
  }
  return true;
}
// the region graph: are the REGIONS themselves in a loop, or still a tree?
function regionCycles(M){
  const ids = new Set(M.regions.map(r => r.id));
  const seen = new Set();
  let e = 0;
  for(const c of M.corridors){
    if(!ids.has(c.a) || !ids.has(c.b) || c.a === c.b) continue;
    const k = c.a < c.b ? c.a+':'+c.b : c.b+':'+c.a;
    if(seen.has(k)) continue;
    seen.add(k); e++;
  }
  return e - (ids.size - 1);          // > 0 means the region graph has cycles
}

head('the generator is there and config carries three floors');
ok('maze.js loaded', E('typeof dcGenerate') === 'function');
ok('DC.FLOORS has three', E('DC.FLOORS.length') === 3);
ok('their names are the three fictions',
   E('DC.FLOORS.map(f=>f.name).join(",")') === 'OFFICES,SERVERS,PLANT');

const F = [0,1,2].map(i => JSON.parse(gen(i)));
const DC = { FLOORS_CFG: JSON.parse(E('JSON.stringify(DC.FLOORS)')) };

head('every floor is walkable, whole, and internally consistent');
for(const M of F){
  const cs = cells(M), r = reach(M, cs[0][0], cs[0][1]);
  ok(`${M.name}: has floor to walk on`, cs.length > 40, cs.length + ' cells');
  ok(`${M.name}: every open cell is reachable from every other`, r.size === cs.length,
     r.size + ' of ' + cs.length);
  ok(`${M.name}: no wall is down on one side only`, wallsAgree(M));
}

head('THE BRAID: the floors have cycles, which the port did not');
// A spanning tree has exactly cells-1 edges. Anything above that IS a cycle.
for(const M of F){
  const c = cells(M).length, e = edges(M), extra = e - (c - 1);
  ok(`${M.name}: more edges than a tree could have (${extra} independent loops)`,
     extra > 0, `${e} edges, ${c} cells`);
  ok(`${M.name}: and enough of them to run a chase through`, extra >= 8, extra + ' loops');
}

head('...and that it is the BRAID doing it, not luck');
// braid 0 must give back a perfect maze INSIDE the regions. Corridors still add
// their own loops, so compare dead ends rather than asserting zero cycles.
const bare = JSON.parse(E(`JSON.stringify((function(){
  const keep = DC.FLOORS[1].braid; DC.FLOORS[1].braid = 0;
  const M = dcGenerate(1); DC.FLOORS[1].braid = keep;
  return { name:M.name, cols:M.cols, rows:M.rows, grid:M.grid, regions:M.regions,
           corridors:M.corridors, braided:M.braided, extra:M.extra };
})())`));
ok('braid 0 opens nothing', bare.braided === 0);
ok('braid 0.40 opens walls', F[1].braided > 0, F[1].braided + ' dead ends opened');
ok('and that cuts the dead ends right down',
   deadEnds(F[1]) < deadEnds(bare)*0.75,
   `${deadEnds(bare)} unbraided -> ${deadEnds(F[1])} braided`);
ok('an unbraided floor has far fewer loops than a braided one',
   (edges(F[1]) - cells(F[1]).length) > (edges(bare) - cells(bare).length),
   `${edges(bare)-cells(bare).length+1} -> ${edges(F[1])-cells(F[1]).length+1}`);

head('the regions loop too - braiding alone could never do that');
for(const M of F){
  if(M.regions.length < 3) { ok(`${M.name}: too few regions to need a loop (${M.regions.length})`, true); continue; }
  ok(`${M.name}: the region graph is not a tree`, regionCycles(M) > 0,
     M.regions.length + ' regions, ' + M.corridors.length + ' corridors');
}
ok('extra corridors were actually cut somewhere',
   F.reduce((n,M) => n + M.extra, 0) > 0,
   F.map(M => M.name + ':' + M.extra).join(' '));

head('NO CHOKEPOINTS: cut any one corridor and the floor still hangs together');
// The sharpest guarantee the escape needs. A corridor whose removal splits the
// floor in two is a pursuer you cannot avoid - the exact failure braiding was
// brought in to prevent, and the shape the port shipped with.
for(const M of F){
  let worst = null;
  for(const c of M.corridors){
    // a copy of the floor with THIS corridor's cells sealed off
    const cut = JSON.parse(JSON.stringify(M));
    for(let y=0;y<cut.rows;y++) for(let x=0;x<cut.cols;x++)
      if(cut.grid[y][x].corridor === c.id && cut.grid[y][x].region < 0){
        cut.grid[y][x].corridor = -1;
        cut.grid[y][x].walls = { top:true, right:true, bottom:true, left:true };
        for(const d of DIRS){
          const nx=x+d.dx, ny=y+d.dy;
          if(nx>=0&&nx<cut.cols&&ny>=0&&ny<cut.rows)
            cut.grid[ny][nx].walls[{top:'bottom',right:'left',bottom:'top',left:'right'}[d.w]] = true;
        }
      }
    const cs = cells(cut);
    if(!cs.length) continue;
    if(reach(cut, cs[0][0], cs[0][1]).size !== cs.length){ worst = c.id; break; }
  }
  ok(`${M.name}: no corridor is the only way across`, worst === null,
     worst === null ? '' : 'corridor ' + worst + ' splits the floor');
}
for(const M of F) ok(`${M.name}: has more than one corridor to begin with`,
                     M.corridors.length >= 2, M.corridors.length + ' corridors');

head('the no-chokepoint guarantee holds across SEEDS, not just this one');
// dcBridgeFix read M.regions, which is not filled in until after the corridor
// passes - so it silently answered "no bridges" on every floor ever generated,
// and the single-seed test above passed on luck. At 2 regions the luck held; at
// 4 it stopped (his report). This sweeps it.
{
  let worst = null, checked = 0;
  for(const fi of [0, 1, 2]){
    for(let sd = 0; sd < 6 && !worst; sd++){
      const M = JSON.parse(gen(fi, 3000 + sd*577));
      checked++;
      for(const c of M.corridors){
        const cut = JSON.parse(JSON.stringify(M));
        for(let y=0;y<cut.rows;y++) for(let x=0;x<cut.cols;x++)
          if(cut.grid[y][x].corridor === c.id && cut.grid[y][x].region < 0){
            cut.grid[y][x].corridor = -1;
            cut.grid[y][x].walls = { top:true, right:true, bottom:true, left:true };
            for(const d of DIRS){
              const nx=x+d.dx, ny=y+d.dy;
              if(nx>=0&&nx<cut.cols&&ny>=0&&ny<cut.rows)
                cut.grid[ny][nx].walls[{top:'bottom',right:'left',bottom:'top',left:'right'}[d.w]] = true;
            }
          }
        const cs = cells(cut);
        if(cs.length && reach(cut, cs[0][0], cs[0][1]).size !== cs.length){
          worst = `${M.name} seed ${3000 + sd*577}, corridor ${c.id} (${c.a}-${c.b})`;
          break;
        }
      }
    }
  }
  ok('no corridor is the only way across, on any floor, on any seed', worst === null,
     worst || `${checked} floors swept`);
}
// THE CANARY, and it needs a wide sweep. dcFindBridge spent a whole session
// silently answering "no bridges" on every floor ever generated (it read
// M.regions, which is not filled until after the corridor passes) and a
// single-seed test passed on luck. So this asserts the fixer actually FIRES
// somewhere - but bridges are rare: with the shipped 2/3/4 regions it is about
// 6 floors in 90, and an 18-floor sweep found none at all and failed for the
// wrong reason. 30 seeds a floor is the width that makes it a canary rather
// than a coin toss.
ok('and the fixer reports the ones it had to add', E(`(function(){
     let any = 0;
     for(const fi of [0,1,2]) for(let s=0;s<30;s++) any += dcGenerate(fi, 3000+s*577).fixed;
     return any; })()`) > 0, 'bridges found and cut a second way across');

head('SIZE and REGIONS are separate knobs, and REGIONS is exact');
ok('floor 3 is the biggest', F[2].cols > F[1].cols && F[1].cols > F[0].cols,
   F.map(M => M.cols + 'x' + M.rows).join('  '));
ok('...but only somewhat - not a different order of size',
   F[2].cols <= F[0].cols*1.8, F[0].cols + ' -> ' + F[2].cols);
// REGIONS is an exact count now, not a round of binary splits. His report: the
// PLANT came out with 2 sectors and he wanted 3 or 4, and a round-based BSP
// could only ever give him powers of two.
ok('every floor gets EXACTLY the number of sectors it asks for',
   F.every((M, i) => M.regions.length === DC.FLOORS_CFG[i].regions),
   F.map((M, i) => M.name + ' asked ' + DC.FLOORS_CFG[i].regions + ' got ' + M.regions.length).join('  '));
ok('the PLANT is cut into more than two', F[2].regions.length >= 3,
   F[2].regions.length + ' sectors');
// HIS RULE (2026-11-18): the sectors RAMP, and FOUR belongs to the bottom floor
// alone. It was 4 / 2 / 4, which made the floor he walks in through as divided
// as the one the worm lives on - "I wanted only level 3 have 4 regions".
ok('the sectors ramp: each floor down is cut one more time',
   F[1].regions.length > F[0].regions.length && F[2].regions.length > F[1].regions.length,
   F.map(M => M.name + ' ' + M.regions.length).join('  '));
ok('...and four sectors belongs to the PLANT alone',
   F[2].regions.length === 4 && F[0].regions.length < 4 && F[1].regions.length < 4);
ok('every floor still has more than one sector', F.every(M => M.regions.length >= 2));
ok('an odd number works, which a round-based BSP could never do', E(`(function(){
     const f = DC.FLOORS[2], k = f.regions; f.regions = 3;
     const n = dcGenerate(2).regions.length; f.regions = k; return n; })()`) === 3);
ok('asking for more than a floor can hold degrades, it does not hang', E(`(function(){
     const f = DC.FLOORS[0], k = f.regions; f.regions = 40;
     const M = dcGenerate(0); f.regions = k;
     const cs = dcCells(M);
     return M.regions.length > 1 && M.regions.length <= 40 &&
            dcReach(M, cs[0][0], cs[0][1]).size === cs.length; })()`) === true,
   'still a whole, walkable floor');
ok('and every sector is big enough to hold a maze',
   F.every(M => M.regions.every(r => r.w >= 3 && r.h >= 3)),
   'smallest side: ' + Math.min(...F.flatMap(M => M.regions.flatMap(r => [r.w, r.h]))));

head('deterministic: a floor is never saved, so it must regenerate identically');
ok('same floor, same seed, same grid', gen(1) === gen(1));
ok('a different seed is a different floor', gen(1, 12345) !== gen(1, 999));
ok('and floors differ from each other', gen(0) !== gen(1));
ok('a seed change still yields a whole, walkable floor', (function(){
  const M = JSON.parse(gen(2, 4242)), cs = cells(M);
  return reach(M, cs[0][0], cs[0][1]).size === cs.length && cs.length > 40;
})());

head('the floor fits the world the walker lives in');
ok('a cell is wider than the walker', E('DC.CELL') > E('WALK_R')*2);
ok('and wide enough for a sentry to come down it', E('DC.CELL') > E('FOE.R || 12')*2);
ok('walls stand taller than eye height', E('DC.WALL_H') > E('WALK_EYE'));

head('THE HEAT (step 6): the timer is a temperature, and it is survivable');
// These numbers are the BALANCE, and they are measured rather than asserted by
// feel. If someone changes a floor's size, DC.CELL, WALK_SPD or any HEAT_*, the
// escape silently becomes a death sentence or a stroll - and this is what says so.
const legs = JSON.parse(E(`JSON.stringify([0,1,2].map(i => {
  const M = dcGenerate(i), D = {}, q = [[M.core.x, M.core.y, 0]];
  D[M.core.x + ',' + M.core.y] = 0;
  while(q.length){
    const [x, y, d] = q.shift();
    for(const dir of DC_DIRS){
      const nx = x + dir.dx, ny = y + dir.dy, k = nx + ',' + ny;
      if(M.grid[y][x].walls[dir.wall] || !dcOpen(M, nx, ny) || k in D) continue;
      D[k] = d + 1; q.push([nx, ny, d + 1]);
    }
  }
  return D[M.start.x + ',' + M.start.y];
}))`));
const CELL = E('DC.CELL'), WSPD = E('WALK_SPD');
const AMB = E('DC.HEAT_AMBIENT'), HMAX = E('DC.HEAT_MAX'), HURT = E('DC.HEAT_HURT');
const HT = E('DC.HEAT_T'), HLAG = E('DC.HEAT_LAG'), HDPS = E('DC.HEAT_DPS');
// walk the escape at `mult` times the shortest route and total the hull lost
function escape(mult){
  const temp = (f, t) => AMB + (HMAX - AMB)*Math.min(1, Math.max(0, t - f*HLAG)/HT);
  let t = 0, lost = 0;
  for(const f of [2, 1, 0]){
    const secs = legs[f]*mult*CELL/WSPD;
    for(let s = 0; s < secs; s += 0.1){
      lost += HDPS*Math.max(0, Math.min(1, (temp(f, t) - HURT)/(HMAX - HURT)))*0.1;
      t += 0.1;
    }
  }
  return { lost, t };
}
const E1 = escape(1), E13 = escape(1.3), E16 = escape(1.6), E20 = escape(2);
ok('a floor is not hot until the worm is in', E('dcTemp(0)') === AMB);
ok('the TOP floor cooks first, so climbing runs INTO the heat', E(`(function(){
     const k = dcq; dcq = { planted:true, heat:150 };
     const hot = dcTemp(0) > dcTemp(1) && dcTemp(1) > dcTemp(2);
     dcq = k; return hot; })()`) === true);
ok('the escape is long - this is the figure the balance hangs on',
   E1.t > 200, Math.round(E1.t) + ' s of walking on the OPTIMAL route');
ok('the optimal route is survivable on base hull', E1.lost < E('WALK_HP'),
   `loses ${E1.lost.toFixed(0)} of ${E('WALK_HP')}`);
ok('...but not comfortably - it has to cost something', E1.lost > E('WALK_HP')*0.4,
   E1.lost.toFixed(0) + ' hull');
ok('wandering 30% costs about double', E13.lost > E1.lost*1.6,
   `${E1.lost.toFixed(0)} -> ${E13.lost.toFixed(0)}`);
ok('wandering badly kills him even fully upgraded',
   E20.lost > E('walkerHpAt(WALK_UP_MAX)'),
   `2x the route loses ${E20.lost.toFixed(0)}, max hull is ${E('walkerHpAt(WALK_UP_MAX)')}`);
ok('so knowing the building is worth real hull',
   E16.lost - E1.lost > 60, `${(E16.lost - E1.lost).toFixed(0)} hull between a good route and a bad one`);
ok('and it is a DRAIN, not a cliff: no single second is fatal',
   HDPS < E('WALK_HP')*0.1, HDPS + ' hull/s at the maximum');

console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
