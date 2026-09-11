#!/usr/bin/env node
// Runs one of the game HTML files with no browser, so a session can check that a
// change still loads, still steps, and still renders without opening anything.
//
//   node tools/headless.js scrapheap-loop-alpha.html            # 60s smoke test
//   node tools/headless.js scrapheap-circuit-alpha.html 30 arena 2
//
// The canvas is stubbed out: every draw call is a no-op, so this proves the code
// runs, not that it looks right. Use `sandbox.__e('expr')` to read or poke any
// top-level binding - `let`/`const` live in script scope, so that hatch is the
// only way in.
'use strict';
const fs = require('fs'), vm = require('vm'), pathmod = require('path');

const noop = () => {};
class Path2D {
  moveTo(){} lineTo(){} closePath(){} arc(){} ellipse(){} rect(){}
  quadraticCurveTo(){} addPath(){}
}

function makeCtx(){
  const c = {};
  for(const m of ['save','restore','translate','scale','rotate','beginPath','moveTo','lineTo',
      'closePath','fill','stroke','fillRect','strokeRect','clearRect','clip','arc','ellipse',
      'rect','quadraticCurveTo','setLineDash','fillText','strokeText','setTransform','drawImage',
      'putImageData','resetTransform','transform','arcTo','bezierCurveTo']) c[m] = noop;
  c.createImageData = (w,h) => ({ width:w, height:h, data:new Uint8ClampedArray(w*h*4) });
  c.getImageData    = (x,y,w,h) => ({ width:w, height:h, data:new Uint8ClampedArray(w*h*4) });
  c.createPattern = () => ({});
  c.createLinearGradient = () => ({ addColorStop:noop });
  c.measureText = t => ({ width:(t||'').length*6 });
  return c;
}
function makeCanvas(){
  const cv = { width:300, height:150, style:{},
    getContext(){ if(!cv._c){ cv._c = makeCtx(); cv._c.canvas = cv; } return cv._c; },
    addEventListener: noop,
    getBoundingClientRect: () => ({ left:0, top:0, width:cv.width, height:cv.height }) };
  return cv;
}

function load(file){
  const canvas = makeCanvas();
  let rafCb = null;
  const store = {};
  const sandbox = {
    document: { getElementById: () => canvas, createElement: () => makeCanvas() },
    addEventListener: noop, removeEventListener: noop,
    innerWidth: 1920, innerHeight: 1080,
    performance: { now: () => Date.now() },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    localStorage: { getItem: k => store[k] || null, setItem: (k,v) => { store[k] = String(v); } },
    setTimeout: () => 0,
    Path2D, Math, Date, console, JSON,
    Uint8ClampedArray, Float32Array, Object, Array, String, Number,
    parseInt, parseFloat, isNaN
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;

  const html = fs.readFileSync(file, 'utf8');
  const code = /<script>\n([\s\S]*)\n<\/script>/.exec(html)[1];
  vm.createContext(sandbox);
  // top-level let/const stay in script scope, so open an eval hatch into it
  vm.runInContext(code + '\n;globalThis.__e = s => eval(s);', sandbox, { filename: pathmod.basename(file) });

  let t = 0;
  return {
    sandbox,
    E: sandbox.__e,
    tick(){ t += 1000/60; rafCb(t); },
    run(seconds, onFrame){
      const n = Math.round(seconds*60);
      for(let i=0;i<n;i++){ this.tick(); if(onFrame && onFrame(i) === false) return i; }
      return n;
    }
  };
}

module.exports = { load };

if(require.main === module){
  const file = process.argv[2];
  if(!file){ console.error('usage: node tools/headless.js <game.html> [seconds] [mode] [level]'); process.exit(2); }
  const secs = +(process.argv[3] || 60);
  const g = load(file);
  g.tick();
  console.log('loaded %s  state=%s', pathmod.basename(file), g.E('state'));

  if(g.E("typeof startRun") === 'function'){
    g.E('startRun()');
  } else {
    const mode = process.argv[4] || 'race', lvl = +(process.argv[5] || 1);
    g.E(`startMatch('${mode}',${lvl})`);
  }

  let err = null;
  try { g.run(secs); } catch(e){ err = e; }
  console.log('after %ss: state=%s cars=%d shots=%d fx=%d fps-loop ok',
    secs, g.E('state'), g.E('cars.length'), g.E('shots.length'), g.E('fx.length'));
  if(g.E("typeof scrap") !== 'undefined')
    console.log('  loop: lap=%d heat=%d purse=%d earned=%d kills=%d parts=%d',
      g.E('lapNo')-1, g.E('heat'), Math.floor(g.E('scrap')), g.E('earned'), g.E('kills'), g.E('placed'));
  if(err){ console.error('RUNTIME ERROR:\n' + err.stack); process.exit(1); }
  console.log('no runtime errors');
}
