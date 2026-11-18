#!/usr/bin/env node
// Prints a DATACENTER floor as ASCII, so a floor can be LOOKED at.
//   node tools/mazeprint.js [floor 0-2] [seed]
// Region cells are shaded by region id, corridor cells are '+', dead padding is
// blank. Use it to eyeball what a braid number actually does to a floor.
'use strict';
const path = require('path');
const { load } = require('./headless.js');
const g = load(path.join(__dirname, '..', 'index.html'));
const floor = parseInt(process.argv[2] || '0', 10);
const seed  = process.argv[3] ? ', ' + parseInt(process.argv[3], 10) : '';
const M = JSON.parse(g.E(`JSON.stringify((function(){
  const M = dcGenerate(${floor}${seed});
  return { name:M.name, cols:M.cols, rows:M.rows, grid:M.grid, regions:M.regions,
           corridors:M.corridors, braided:M.braided, extra:M.extra };
})())`));
const SH = ['░', '▒', '▓', '█'];
const open = (x,y) => x>=0 && x<M.cols && y>=0 && y<M.rows &&
                      (M.grid[y][x].region>=0 || M.grid[y][x].corridor>=0);
let out = '';
for(let y=0; y<M.rows; y++){
  let top = '', mid = '';
  for(let x=0; x<M.cols; x++){
    const c = M.grid[y][x], o = open(x,y);
    top += '·' + (o && !c.walls.top ? '  ' : '──');
    const face = !o ? ' ' : c.corridor>=0 ? '+' : SH[c.region % SH.length];
    mid += (o && !c.walls.left ? ' ' : '│') + face + face;
  }
  out += top + '·\n' + mid + '│\n';
}
out += '·' + '──·'.repeat(M.cols) + '\n';
console.log(out);
let cells=0, edges=0, dead=0;
for(let y=0;y<M.rows;y++) for(let x=0;x<M.cols;x++){
  if(!open(x,y)) continue;
  cells++;
  if(!M.grid[y][x].walls.right  && open(x+1,y)) edges++;
  if(!M.grid[y][x].walls.bottom && open(x,y+1)) edges++;
  let e=0;
  if(!M.grid[y][x].walls.top    && open(x,y-1)) e++;
  if(!M.grid[y][x].walls.right  && open(x+1,y)) e++;
  if(!M.grid[y][x].walls.bottom && open(x,y+1)) e++;
  if(!M.grid[y][x].walls.left   && open(x-1,y)) e++;
  if(e<=1) dead++;
}
console.log(`${M.name}  ${M.cols}x${M.rows}  regions ${M.regions.length}  corridors ${M.corridors.length} (${M.extra} extra)`);
console.log(`walkable ${cells}  loops ${edges-cells+1}  dead ends ${dead}  braid opened ${M.braided}`);
