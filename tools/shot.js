#!/usr/bin/env node
// Real-browser screenshots of a game file, for the things tools/headless.js
// can't see (it stubs the canvas, so it proves code runs, not how it looks).
//
// Uses the Windows Chrome install from WSL in its one-shot headless modes. The
// game file is never touched: a temporary copy gets a second <script> appended
// that runs your setup JS (top-level let/const of the game are reachable by
// name, since classic scripts share one global lexical scope), and
// --virtual-time-budget lets the game run that many seconds before the capture.
//
//   node tools/shot.js <file.html> <out.png> "<setup js>" [seconds] ["<probe js>"]
//   node tools/shot.js scrapheap-madmax-ascii.html /tmp/a.png "stage='convoy';startMatch(2)" 3
//
// With a probe expression, a second, separate run dumps the DOM and prints the
// probe's value as it was at the end of that run (JSON). Note virtual time: the
// clock does not advance while JS runs, so performance.now() can't time code here.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const [file, out, setup = '', secs = '2', probe = ''] = process.argv.slice(2);
if(!file || !out){ console.error('usage: shot.js <file.html> <out.png> [setupJS] [seconds] [probeJS]'); process.exit(1); }

const CHROME = ['/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
                '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if(!CHROME) throw new Error('no Windows Chrome/Edge found');
const win = p => execFileSync('wslpath', ['-w', path.resolve(p)]).toString().trim();

const budget = Math.round((parseFloat(secs) + 0.5)*1000);
const html = fs.readFileSync(file, 'utf8');
// the probe only goes into the copy used for the DOM dump, so it can't disturb the picture
const script = withProbe => `<script>
setTimeout(() => { ${setup} }, 200);
${withProbe ? `setTimeout(() => { const d=document.createElement('pre'); d.id='__probe';
  d.textContent = JSON.stringify((() => ${probe})()); document.body.appendChild(d); }, ${budget - 150});` : ''}
</script>`;
const dir = path.dirname(path.resolve(file));
const tmp  = path.join(dir, '.shot-' + process.pid + '.html');
const tmpP = path.join(dir, '.shot-' + process.pid + '-probe.html');
fs.writeFileSync(tmp,  html.replace(/<\/body>/, script(false) + '\n</body>'));
if(probe) fs.writeFileSync(tmpP, html.replace(/<\/body>/, script(true) + '\n</body>'));

const base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,720',
  '--run-all-compositor-stages-before-draw', '--virtual-time-budget=' + budget,
  '--user-data-dir=C:\\Temp\\shot-profile'];
try {
  const outDir = path.dirname(path.resolve(out));
  const winOut = win(outDir) + '\\' + path.basename(out);
  execFileSync(CHROME, [...base, '--screenshot=' + winOut, win(tmp)], { stdio:'ignore', timeout:60000 });
  console.log('wrote', out);
  if(probe){
    const dom = execFileSync(CHROME, [...base, '--dump-dom', win(tmpP)], { timeout:60000 }).toString();
    const m = /<pre id="__probe">([\s\S]*?)<\/pre>/.exec(dom);
    console.log(m ? m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&') : '(no probe output)');
  }
} finally {
  for(const f of [tmp, tmpP]) if(fs.existsSync(f)) fs.unlinkSync(f);
}
