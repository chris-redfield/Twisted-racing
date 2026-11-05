#!/usr/bin/env node
// Regression oracle: a seeded, scripted bot drives a survival stage in two game
// files and compares their traces second by second. Same seed + same inputs =>
// the traces must match exactly if the logic didn't change.
//
//   node tools/oracle.js <old.html> <new.html> <stage> [seconds=60] [dev=1]
//   node tools/oracle.js scrapheap-madmax-city.html index.html convoy 60
//
// dev=1 runs with no damage (long traces), dev=0 with damage (exercises deaths).
'use strict';
const { load } = require('./headless.js');

function trace(file, stage, secs, dev){
  let seed = 12345;
  const realRandom = Math.random;
  Math.random = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
  try {
    const g = load(file); g.tick();
    g.E(`numPlayers=1; stage='${stage}'; startMatch(1); devMode=${dev}; cars[0].invuln=0;`);
    const hasRoad = g.E('typeof roadProject') === 'function';
    const K = (k, v) => g.E(`keys.${k}=${v}`);
    const out = []; let deadAt = null;
    g.run(secs, i => {
      const t = i/60;
      const me = g.E('({x:cars[0].x,y:cars[0].y,a:cars[0].angle,dead:cars[0].dead,hp:cars[0].hp})');
      let lat, axis;
      if(hasRoad){ const p = g.E(`roadProject(${me.x},${me.y})`); lat = p.lat; axis = Math.atan2(p.ty, p.tx); }
      else if(stage === 'convoy'){ lat = me.y; axis = 0; } else { lat = me.x; axis = -Math.PI/2; }
      const want = Math.sin(t*0.45)*110;                       // weave across the road
      const head = axis + Math.max(-0.5, Math.min(0.5, (want - lat)*0.01));
      let d = head - me.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      K('KeyA', d < -0.05); K('KeyD', d > 0.05); K('KeyW', (i % 240) < 150); K('ArrowUp', true);
      if(i % 60 === 0) out.push([t, +g.E('distance').toFixed(1), +me.x.toFixed(1), +me.y.toFixed(1),
                                 Math.round(me.hp), g.E('cars.length'), g.E('convoyKills')]);
      if(me.dead && deadAt == null) deadAt = t;
      if(g.E('state') !== 'play') return false;
    });
    return { out, deadAt };
  } finally { Math.random = realRandom; }
}

if(require.main === module){
  const [a, b, stage, secs = '60', dev = '1'] = process.argv.slice(2);
  if(!a || !b || !stage){ console.error('usage: oracle.js <old.html> <new.html> <stage> [secs] [dev]'); process.exit(2); }
  const A = trace(a, stage, +secs, dev === '1'), B = trace(b, stage, +secs, dev === '1');
  let diff = -1;
  for(let i=0;i<Math.max(A.out.length, B.out.length);i++)
    if(JSON.stringify(A.out[i]) !== JSON.stringify(B.out[i])){ diff = i; break; }
  console.log(`${stage} ${secs}s dev=${dev}: ` + (diff < 0 ? 'IDENTICAL' : `DIFFERS from second ${diff}`) +
    `  | end ${JSON.stringify(A.out.at(-1))} dead@${A.deadAt}` + (diff < 0 ? '' : `  vs ${JSON.stringify(B.out.at(-1))} dead@${B.deadAt}`));
  process.exit(diff < 0 ? 0 : 1);
}
module.exports = { trace };
