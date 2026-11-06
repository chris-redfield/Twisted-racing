#!/usr/bin/env node
// Fingerprint of the generated city: hashes every road, block and building of a
// run of chunks, so a change to the generator can be proven not to move a thing.
//   node tools/cityprint.js [file=index.html]
'use strict';
const { load } = require('./headless.js');
const g = load(process.argv[2] || 'index.html'); g.tick();
const out = g.E(`(() => { let h = 0, n = 0;
  const mix = v => { h = (Math.imul(h ^ Math.round(v*1000), 2654435761) + 0x9e3779b9) | 0; n++; };
  for(let k=-20;k<=3;k++) for(const s of [-1,1]){ const c = makeCityChunk(k, s);
    for(const r of c.roads){ mix(r.x0); mix(r.x1); mix(r.y0); mix(r.y1); mix(r.w); }
    for(const b of c.blocks){ mix(b.x0); mix(b.x1); mix(b.y0); mix(b.y1); }
    for(const b of c.bld){ mix(b.x0); mix(b.x1); mix(b.y0); mix(b.y1); mix(b.h); mix(b.lit); }
    for(const q of c.gaps){ mix(q[0]); mix(q[1]); } }
  return (h >>> 0).toString(16) + ' over ' + n + ' numbers'; })()`);
console.log('city fingerprint:', out);
