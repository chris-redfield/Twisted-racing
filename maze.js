// =============================================================================
// maze.js - THE DATACENTER's floors (quest 2). Design: HANDOFF.md 2026-11-17.
// =============================================================================
// Ported from /home/cmoryah/proj/maze-explorer3/src/campaignMaze.js: a BSP tree
// cuts the floor into regions, every region gets a recursive-backtracker maze,
// and corridors join the regions. Knobs are DC in config.js (section 3d).
//
// WHAT IS OURS, AND WHY (both of these are the whole point of the port):
//
//   1. BRAIDING. The original is a SPANNING TREE - a perfect maze inside every
//      leaf, and exactly one corridor per BSP join. Exactly one path between any
//      two cells, zero cycles. That is merely slow on the way down and lethal on
//      the way up: you can never loop round a pursuer, and every wrong turn is a
//      full backtrack while the building cooks. dcBraid() re-opens a share of the
//      dead ends; dcExtraCorridors() adds second ways between regions. Together
//      they are what makes the escape a chase instead of a corridor queue.
//
//   2. SIZE AND SPLITS ARE SEPARATE. The original derived both from one level
//      number (`baseSize = 15*1.25^(lv-1)`, `numSplits = lv-1`), so its smallest
//      floor had zero splits - no rooms at all. Our floor 1 is the offices and
//      wants the MOST rooms. Per-floor numbers, in config.
//
// NOT ported: their raycaster (ours is better and already has the fog, the LOD,
// ASCII mode, billboards and the gun), textures, colours, visibility tracking.
// This file produces a GRID; turning wall runs into rings for rcBuildingColumn
// is the next step and lives elsewhere.
//
// A cell: { walls:{top,right,bottom,left}, region, corridor }
//   region  >= 0  inside that BSP leaf's mini-maze
//   corridor>= 0  a carved corridor cell between regions
//   both -1       dead padding between regions; never walkable
// "Open" means region >= 0 || corridor >= 0. Walls are shared: opening one side
// always opens its neighbour's facing side, so the grid is never inconsistent.

const DC_DIRS = [
  { dx: 0, dy:-1, wall:'top',    opposite:'bottom' },
  { dx: 1, dy: 0, wall:'right',  opposite:'left'   },
  { dx: 0, dy: 1, wall:'bottom', opposite:'top'    },
  { dx:-1, dy: 0, wall:'left',   opposite:'right'  }
];

function dcFloorCfg(i){ return DC.FLOORS[Math.max(0, Math.min(DC.FLOORS.length - 1, i|0))]; }
function dcIn(M, x, y){ return x >= 0 && x < M.cols && y >= 0 && y < M.rows; }
function dcCell(M, x, y){ return dcIn(M, x, y) ? M.grid[y][x] : null; }
function dcOpen(M, x, y){ const c = dcCell(M, x, y); return !!c && (c.region >= 0 || c.corridor >= 0); }
// how many ways out a cell has (only counting neighbours that exist and are open)
function dcExits(M, x, y){
  let n = 0;
  for(const d of DC_DIRS) if(!M.grid[y][x].walls[d.wall] && dcOpen(M, x + d.dx, y + d.dy)) n++;
  return n;
}
// drop the wall between two orthogonally adjacent cells, both sides
function dcJoin(M, ax, ay, bx, by){
  for(const d of DC_DIRS){
    if(ax + d.dx !== bx || ay + d.dy !== by) continue;
    M.grid[ay][ax].walls[d.wall] = false;
    M.grid[by][bx].walls[d.opposite] = false;
    return true;
  }
  return false;
}
function dcShuffle(arr, rng){
  for(let i = arr.length - 1; i > 0; i--){
    const j = (rng.next()*(i + 1))|0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// ---- the BSP tree -----------------------------------------------------------
function dcNode(x, y, w, h){ return { x, y, w, h, leaf:true, left:null, right:null, id:-1, inner:null }; }
function dcSplit(n, rng, minSize){
  if(!n.leaf) return false;
  // split across the long axis, so regions stay roughly square
  let horiz;
  if(n.w/n.h >= 1.25)      horiz = false;
  else if(n.h/n.w >= 1.25) horiz = true;
  else                     horiz = rng.next() > 0.5;
  const span = horiz ? n.h : n.w;
  const max = span - minSize;
  if(max <= minSize) return false;                 // cannot fit two legal halves
  const at = Math.floor(rng.next()*(max - minSize)) + minSize;
  if(horiz){
    n.left  = dcNode(n.x, n.y, n.w, at);
    n.right = dcNode(n.x, n.y + at, n.w, n.h - at);
  } else {
    n.left  = dcNode(n.x, n.y, at, n.h);
    n.right = dcNode(n.x + at, n.y, n.w - at, n.h);
  }
  n.leaf = false;
  return true;
}
function dcLeaves(n){ return n.leaf ? [n] : dcLeaves(n.left).concat(dcLeaves(n.right)); }

// ---- the mini-maze inside one leaf -----------------------------------------
// The leaf keeps a 1-cell pad on every side, so two adjacent leaves always have
// TWO dead cells between their inner mazes - which is the lane dcCorridor carves
// through. The port spent a THIRD cell on that lane explicitly; it is redundant,
// and at these floor sizes one cell per leaf is worth having. The port also
// clamped a too-small inner area UP to 3, which can overflow the leaf it belongs
// to; we clamp DOWN to what the leaf actually has.
function dcInner(leaf){
  const pad = 1;
  return { x:leaf.x + pad, y:leaf.y + pad,
           w:Math.max(1, leaf.w - pad*2), h:Math.max(1, leaf.h - pad*2) };
}
function dcMiniMaze(M, leaf, id, rng){
  const R = dcInner(leaf);
  leaf.inner = R; leaf.id = id;
  for(let y = R.y; y < R.y + R.h; y++)
    for(let x = R.x; x < R.x + R.w; x++)
      if(dcIn(M, x, y)){ M.grid[y][x].region = id; M.grid[y][x].seen = false; }
  // iterative recursive-backtracker, bounded to the inner rect
  const stack = [[R.x, R.y]];
  while(stack.length){
    const [cx, cy] = stack[stack.length - 1];
    M.grid[cy][cx].seen = true;
    let moved = false;
    for(const d of dcShuffle(DC_DIRS.slice(), rng)){
      const nx = cx + d.dx, ny = cy + d.dy;
      if(nx < R.x || nx >= R.x + R.w || ny < R.y || ny >= R.y + R.h) continue;
      if(!dcIn(M, nx, ny) || M.grid[ny][nx].seen) continue;
      dcJoin(M, cx, cy, nx, ny);
      stack.push([nx, ny]);
      moved = true;
      break;
    }
    if(!moved) stack.pop();
  }
}

// ---- corridors --------------------------------------------------------------
// Walk a straight line from a cell inside region A to a cell inside region B,
// marking the dead cells between them as corridor and opening every wall on the
// way. Straight-only is deliberate: an L-bend would need a turn cell and this
// gap is one lane wide by construction.
// Returns how many DEAD cells this run claimed for itself. 0 means the lane was
// already another corridor's, so this one has no cells of its own - it looks
// like a second way across but removing the first still cuts the floor. The
// bridge hunt below needs to tell those apart.
function dcCorridor(M, ax, ay, bx, by, cid){
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  if(dx !== 0 && dy !== 0) return 0;                      // not a straight run
  let x = ax, y = ay, prev = null, claimed = 0, guard = M.cols + M.rows + 8;
  while(guard-- > 0){
    if(!dcIn(M, x, y)) return 0;
    const c = M.grid[y][x];
    if(c.region < 0 && c.corridor < 0){ c.corridor = cid; claimed++; }   // never overwrite a room
    if(prev) dcJoin(M, prev[0], prev[1], x, y);
    prev = [x, y];
    if(x === bx && y === by) return claimed;
    x += dx; y += dy;
  }
  return 0;
}
// the two regions' facing edges, and a lane they both span
function dcJoinRegions(M, A, B, cid, rng){
  const a = A.inner, b = B.inner;
  const horiz = Math.abs((a.x + a.w/2) - (b.x + b.w/2)) >= Math.abs((a.y + a.h/2) - (b.y + b.h/2));
  if(horiz){
    const L = a.x < b.x ? a : b, R = a.x < b.x ? b : a;
    const o0 = Math.max(L.y, R.y), o1 = Math.min(L.y + L.h, R.y + R.h);
    if(o1 <= o0) return 0;
    const lane = o0 + ((rng.next()*(o1 - o0))|0);
    return dcCorridor(M, L.x + L.w - 1, lane, R.x, lane, cid);
  }
  const T = a.y < b.y ? a : b, Bo = a.y < b.y ? b : a;
  const o0 = Math.max(T.x, Bo.x), o1 = Math.min(T.x + T.w, Bo.x + Bo.w);
  if(o1 <= o0) return 0;
  const lane = o0 + ((rng.next()*(o1 - o0))|0);
  return dcCorridor(M, lane, T.y + T.h - 1, lane, Bo.y, cid);
}
// the tree pass: one corridor per BSP node, nearest pair of leaves across it.
// This alone is what makes the floor a spanning tree - see dcExtraCorridors.
function dcTreeCorridors(M, node, rng, state){
  if(node.leaf) return;
  const A = dcLeaves(node.left), B = dcLeaves(node.right);
  let best = null, bestD = Infinity;
  for(const la of A) for(const lb of B){
    const d = Math.abs((la.x + la.w/2) - (lb.x + lb.w/2)) + Math.abs((la.y + la.h/2) - (lb.y + lb.h/2));
    if(d < bestD){ bestD = d; best = [la, lb]; }
  }
  if(best && dcJoinRegions(M, best[0], best[1], state.cid, rng) > 0){
    M.corridors.push({ a:best[0].id, b:best[1].id, id:state.cid++, tree:true });
  }
  dcTreeCorridors(M, node.left, rng, state);
  dcTreeCorridors(M, node.right, rng, state);
}
// LOOPS BETWEEN REGIONS. Braiding only ever makes cycles inside one region (the
// padding between regions is dead cells, and braid refuses to open into them),
// so without this pass the region graph is still a tree however hard we braid.
function dcExtraCorridors(M, leaves, rng, state){
  const key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  const count = new Map();
  for(const c of M.corridors) count.set(key(c.a, c.b), (count.get(key(c.a, c.b)) || 0) + 1);
  const pairs = [];
  for(let i = 0; i < leaves.length; i++) for(let j = i + 1; j < leaves.length; j++){
    const A = leaves[i].inner, B = leaves[j].inner;
    // edge-to-edge gap on each axis; neighbours overlap on one and are close on the other
    const gx = Math.max(A.x - (B.x + B.w), B.x - (A.x + A.w));
    const gy = Math.max(A.y - (B.y + B.h), B.y - (A.y + A.h));
    if((gx <= DC.GAP_MAX && gy < 0) || (gy <= DC.GAP_MAX && gx < 0)) pairs.push([leaves[i], leaves[j]]);
  }
  dcShuffle(pairs, rng);
  // An ALREADY-JOINED pair is still a candidate, and on the big floors it is the
  // important one. A floor with two regions has a single tree corridor between
  // them, which is a chokepoint: the one way across the floor, where a pursuer on
  // the escape cannot be avoided. A second corridor at a different lane is what
  // stops that. DC.PAIR_MAX is the cap, so a pair never turns into a colonnade.
  const want = Math.max(1, Math.round(pairs.length*DC.EXTRA_CORR));
  let made = 0;
  for(const [A, B] of pairs){
    if(made >= want) break;
    const k = key(A.id, B.id);
    if((count.get(k) || 0) >= DC.PAIR_MAX) continue;      // caps THIS pass; dcBridgeFix ignores it
    if(dcJoinRegions(M, A, B, state.cid, rng) > 0){
      M.corridors.push({ a:A.id, b:B.id, id:state.cid++, tree:false });
      count.set(k, (count.get(k) || 0) + 1);
      made++;
    }
  }
  return made;
}

// A corridor whose removal splits the region graph in two is a CHOKEPOINT: the
// one way across the floor, where a pursuer on the escape cannot be avoided.
// Returns one such corridor, or null.
// `ids` is passed in rather than read off M.regions, which is not filled in until
// AFTER the corridor passes have run - reading it here made this silently answer
// "no bridges" on every floor, every time.
function dcFindBridge(M, ids){
  if(!ids || ids.length < 2) return null;
  for(const cut of M.corridors){
    const seen = new Set([ids[0]]), q = [ids[0]];
    while(q.length){
      const n = q.pop();
      for(const e of M.corridors){
        if(e === cut) continue;
        const o = e.a === n ? e.b : e.b === n ? e.a : null;
        if(o == null || seen.has(o)) continue;
        seen.add(o); q.push(o);
      }
    }
    if(seen.size < ids.length) return cut;
  }
  return null;
}
// ...so hunt them down and cut a SECOND way across each. The random extra pass
// above does not guarantee this - it only takes a share of the neighbour pairs,
// and whether that share happens to include the pair that matters is luck. It
// was luck for two regions and stopped being luck at four (his report: the
// PLANT at 4 sectors had a bridge again). A pair that already has one corridor
// is adjacent by definition, so a parallel corridor at a different lane is
// always available, and `claimed` is what tells a real one from a duplicate lane.
function dcBridgeFix(M, leaves, rng, state){
  const byId = new Map(leaves.map(l => [l.id, l]));
  const ids = leaves.map(l => l.id);
  let made = 0;
  for(let guard = 0; guard < 24; guard++){
    const b = dcFindBridge(M, ids);
    if(!b) break;
    const A = byId.get(b.a), B = byId.get(b.b);
    if(!A || !B) break;
    if(dcJoinRegions(M, A, B, state.cid, rng) > 0){
      M.corridors.push({ a:A.id, b:B.id, id:state.cid++, tree:false, fix:true });
      made++;
    }
    // a duplicate lane claimed nothing: loop and let the rng pick another
  }
  return made;
}

// ---- braiding ---------------------------------------------------------------
// Re-open a share of the dead ends. `share` 0 leaves the perfect maze alone, 1
// opens every dead end it legally can. Opening is refused into dead padding, so
// braiding never punches a hole into the gap between regions - that is what the
// corridor passes are for. A cell can stop being a dead end because a NEIGHBOUR
// was braided first, so each is re-checked at the moment it comes up.
function dcBraid(M, share, rng){
  if(share <= 0) return 0;
  const dead = [];
  for(let y = 0; y < M.rows; y++) for(let x = 0; x < M.cols; x++)
    if(dcOpen(M, x, y) && dcExits(M, x, y) <= 1) dead.push([x, y]);
  dcShuffle(dead, rng);                       // spread the opening over the floor
  const want = Math.round(dead.length*share);
  let made = 0;
  for(const [x, y] of dead){
    if(made >= want) break;
    if(dcExits(M, x, y) > 1) continue;        // a neighbour's braid already opened it
    const cand = DC_DIRS.filter(d =>
      M.grid[y][x].walls[d.wall] && dcOpen(M, x + d.dx, y + d.dy));
    if(!cand.length) continue;
    const d = cand[(rng.next()*cand.length)|0];
    dcJoin(M, x, y, x + d.dx, y + d.dy);
    made++;
  }
  return made;
}

// ---- the floor --------------------------------------------------------------
// Deterministic: the same (floor, seed) is always the same floor, which is how
// the rest of the game gets away with never saving one.
function dcGenerate(floorIdx, seed){
  const F = dcFloorCfg(floorIdx);
  const rng = cityRng(hash3(floorIdx + 1, 7, (seed === undefined ? DC.SEED : seed))*4294967296);
  const M = {
    floor:floorIdx, name:F.name, cols:F.cols, rows:F.rows, cell:DC.CELL,
    grid:[], regions:[], corridors:[], braided:0, extra:0
  };
  for(let y = 0; y < M.rows; y++){
    M.grid[y] = [];
    for(let x = 0; x < M.cols; x++)
      M.grid[y][x] = { walls:{ top:true, right:true, bottom:true, left:true },
                       region:-1, corridor:-1, seen:false };
  }
  // BSP, cut to an EXACT REGION COUNT. The port split every leaf once per round,
  // which only ever yields powers of two - 2, 4, 8 - so "three sectors" was not
  // a thing you could ask for (his report: floor 3 came out with 2 and he wanted
  // 3 or 4). Splitting the BIGGEST leaf one at a time instead makes any count
  // reachable, and taking the biggest each time keeps the floor evenly cut
  // rather than leaving one huge region beside a row of slivers.
  // It is still a TARGET, not a promise: a leaf too small for two legal halves
  // of MIN_REGION is set aside, and if every leaf is stuck the floor stops there.
  const root = dcNode(0, 0, M.cols, M.rows);
  const want = Math.max(1, F.regions|0);
  let live = [root];
  const stuck = [];
  while(live.length + stuck.length < want && live.length){
    let bi = 0;
    for(let j = 1; j < live.length; j++)
      if(live[j].w*live[j].h > live[bi].w*live[bi].h) bi = j;
    const n = live[bi];
    if(dcSplit(n, rng, DC.MIN_REGION)) live.splice(bi, 1, n.left, n.right);
    else { stuck.push(n); live.splice(bi, 1); }
  }
  const leaves = dcLeaves(root);
  leaves.forEach((leaf, i) => dcMiniMaze(M, leaf, i, rng));
  const state = { cid:0 };
  dcTreeCorridors(M, root, rng, state);
  M.extra   = dcExtraCorridors(M, leaves, rng, state);
  M.fixed   = dcBridgeFix(M, leaves, rng, state);     // no corridor may be the only way across
  M.braided = dcBraid(M, F.braid, rng);
  M.regions = leaves.map(l => ({ id:l.id, x:l.inner.x, y:l.inner.y, w:l.inner.w, h:l.inner.h }));
  // START is the walkable cell nearest the floor's near corner, CORE the one
  // nearest the far corner - so the stairs and the thing you came for are always
  // a floor apart, and you cross the whole floor to get between them.
  const walk = dcCells(M);
  let best = Infinity, far = -Infinity;
  for(const [x, y] of walk){
    const near = x + y, away = x + y;
    if(near < best){ best = near; M.start = { x, y }; }
    if(away > far){ far = away; M.core = { x, y }; }
  }
  for(let y = 0; y < M.rows; y++) for(let x = 0; x < M.cols; x++) delete M.grid[y][x].seen;
  return M;
}

// ---- who and what is standing on a floor ------------------------------------
// Picks walkable cells that are far enough from the stairwells and from each
// other. Deterministic off the floor's own seed, so a floor is always populated
// the same way - the same contract the city has, where nothing is saved.
// minD is the clearance from everything in `avoid`; `spread` is the clearance
// from each other, and defaults to minD. They are two numbers because a crowd
// wants to pack tighter than it wants to stand near the stairs - at 30 sentries
// a shared figure of 5 ran out of floor and silently placed 16 of them.
//
// An `avoid` entry may carry its own `d` to override minD, which is how the alarm
// keeps its 5 cells off the stairwells while packing in among the sentries that
// are already standing there.
function dcPlaces(M, n, minD, rng, avoid, spread){
  if(spread === undefined) spread = minD;
  const cells = dcCells(M).filter(([x, y]) => {
    for(const a of avoid) if(Math.abs(x - a.x) + Math.abs(y - a.y) < (a.d === undefined ? minD : a.d)) return false;
    return true;
  });
  dcShuffle(cells, rng);
  const out = [];
  for(const [x, y] of cells){
    if(out.length >= n) break;
    let ok = true;
    for(const p of out) if(Math.abs(x - p.x) + Math.abs(y - p.y) < spread){ ok = false; break; }
    if(ok) out.push({ x, y });
  }
  return out;
}
// ---- what the rest of the game asks a floor --------------------------------
// every walkable cell, as [x, y]
function dcCells(M){
  const out = [];
  for(let y = 0; y < M.rows; y++) for(let x = 0; x < M.cols; x++) if(dcOpen(M, x, y)) out.push([x, y]);
  return out;
}
// flood from one cell: how much of the floor can actually be walked to
function dcReach(M, sx, sy){
  const seen = new Set(), q = [[sx, sy]];
  seen.add(sx + ',' + sy);
  while(q.length){
    const [x, y] = q.pop();
    for(const d of DC_DIRS){
      const nx = x + d.dx, ny = y + d.dy, k = nx + ',' + ny;
      if(M.grid[y][x].walls[d.wall] || !dcOpen(M, nx, ny) || seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
// cell centre -> world units, so the raycaster and the walker agree
function dcWorld(M, x, y){ return { x:(x + 0.5)*M.cell, y:(y + 0.5)*M.cell }; }
function dcCellAt(M, wx, wy){ return { x:Math.floor(wx/M.cell), y:Math.floor(wy/M.cell) }; }

// ---- walls, for the raycaster and for collision -----------------------------
// A wall exists on a cell boundary when the boundary is solid AND at least one
// of the two cells is walkable - a boundary buried in dead padding is never seen
// and never walked into, so emitting it would be thousands of rings for nothing.
function dcWallH(M, x, y){            // boundary between (x, y-1) and (x, y)
  const a = dcCell(M, x, y - 1), b = dcCell(M, x, y);
  const openA = !!a && (a.region >= 0 || a.corridor >= 0);
  const openB = !!b && (b.region >= 0 || b.corridor >= 0);
  if(!openA && !openB) return false;
  return b ? b.walls.top : a.walls.bottom;
}
function dcWallV(M, x, y){            // boundary between (x-1, y) and (x, y)
  const a = dcCell(M, x - 1, y), b = dcCell(M, x, y);
  const openA = !!a && (a.region >= 0 || a.corridor >= 0);
  const openB = !!b && (b.region >= 0 || b.corridor >= 0);
  if(!openA && !openB) return false;
  return b ? b.walls.left : a.walls.right;
}
// THE RAYCASTER'S VIEW OF A FLOOR. Collinear runs are merged into one segment,
// so a 27x27 floor hands over a few hundred long walls instead of a few thousand
// one-cell stubs - the thing HANDOFF.md 2026-11-17 warns about. Each run is a
// 2-point OPEN ring, which is what rcWalls draws for anything with no `bldg`.
// Each run carries what the shading needs: which way it runs (dcNS), how long it
// is in WORLD units (dcLen, so panel joints can be spaced in metres rather than
// in ring-fractions), and which region it belongs to (dcReg, so a wing can tint
// its own walls). Without these every wall in the plant is the same flat colour
// and the floor is unreadable - which is exactly how the first cut played.
function dcRegionNear(M, x, y){
  for(const d of [[0,0],[-1,0],[0,-1],[1,0],[0,1]]){
    const c = dcCell(M, x + d[0], y + d[1]);
    if(c && c.region >= 0) return c.region;
  }
  return 0;
}
function dcRings(M, out){
  const C = M.cell, H = DC.WALL_H, P = DC.REGION_COLS;
  const push = (x0, y0, x1, y1, ns, reg) => out.push({
    pts:[{ x:x0, y:y0 }, { x:x1, y:y1 }], h:H, open:true, u0:0,
    col:P[((reg % P.length) + P.length) % P.length], top:DC.COL_TOP,
    dc:true, dcNS:ns, dcLen:Math.hypot(x1 - x0, y1 - y0), dcReg:reg });
  for(let y = 0; y <= M.rows; y++){           // horizontal runs (east-west), merged along x
    let run = -1;
    for(let x = 0; x <= M.cols; x++){
      const on = x < M.cols && dcWallH(M, x, y);
      if(on && run < 0) run = x;
      else if(!on && run >= 0){ push(run*C, y*C, x*C, y*C, true, dcRegionNear(M, run, y)); run = -1; }
    }
  }
  for(let x = 0; x <= M.cols; x++){           // vertical runs (north-south), merged along y
    let run = -1;
    for(let y = 0; y <= M.rows; y++){
      const on = y < M.rows && dcWallV(M, x, y);
      if(on && run < 0) run = y;
      else if(!on && run >= 0){ push(x*C, run*C, x*C, y*C, false, dcRegionNear(M, x, run)); run = -1; }
    }
  }
  return out;
}
// A stairwell, as eight full-height posts on the CORNERS of one cell. Not a
// wall - markers never collide - and not a closed box either: a box swallows the
// camera the moment he stands in it, and standing in it is the whole point. Open
// corners let him walk in from any side and still see the frame around him, and
// full height is what makes it visible from the far end of a corridor, which is
// the thing the first cut got wrong (HIS report: "couldn't find the exit").
function dcMarkerRings(M, out, cx, cy, col, h){
  const C = M.cell, in0 = C*0.20, arm = C*0.17;
  const x0 = cx*C + in0, x1 = (cx+1)*C - in0;
  const y0 = cy*C + in0, y1 = (cy+1)*C - in0;
  const seg = (ax, ay, bx, by, ns) => out.push({
    pts:[{ x:ax, y:ay }, { x:bx, y:by }], h, open:true, u0:0, col, top:col,
    dc:true, dcMark:true, dcNS:ns, dcLen:Math.hypot(bx-ax, by-ay), dcReg:0 });
  for(const [px, py, sx, sy] of [[x0,y0,1,1], [x1,y0,-1,1], [x1,y1,-1,-1], [x0,y1,1,-1]]){
    seg(px, py, px + sx*arm, py, true);      // the two arms of one corner
    seg(px, py, px, py + sy*arm, false);
  }
  return out;
}
// Collision: shove a point out of any wall within `r`. The walker never leaves
// its cell by more than one step a frame, so only the cell it is in and the ring
// around it can possibly touch - no need to look at the whole floor.
function dcPushOut(M, p, r){
  const C = M.cell, c = dcCellAt(M, p.x, p.y);
  let hit = false;
  for(let y = c.y - 1; y <= c.y + 1; y++) for(let x = c.x - 1; x <= c.x + 1; x++){
    if(dcWallH(M, x, y)     && dcSegPush(p, x*C, y*C, (x+1)*C, y*C, r))     hit = true;
    if(dcWallH(M, x, y + 1) && dcSegPush(p, x*C, (y+1)*C, (x+1)*C, (y+1)*C, r)) hit = true;
    if(dcWallV(M, x, y)     && dcSegPush(p, x*C, y*C, x*C, (y+1)*C, r))     hit = true;
    if(dcWallV(M, x + 1, y) && dcSegPush(p, (x+1)*C, y*C, (x+1)*C, (y+1)*C, r)) hit = true;
  }
  return hit;
}
function dcSegPush(p, x0, y0, x1, y1, r){
  const dx = x1 - x0, dy = y1 - y0, L2 = dx*dx + dy*dy;
  let t = L2 ? ((p.x - x0)*dx + (p.y - y0)*dy)/L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x0 + dx*t, qy = y0 + dy*t;
  let ox = p.x - qx, oy = p.y - qy;
  const d = Math.hypot(ox, oy);
  if(d >= r) return false;
  if(d < 1e-6){ ox = -dy; oy = dx; }           // dead centre: shove along the normal
  const k = (r - d)/(d < 1e-6 ? Math.hypot(ox, oy) || 1 : d);
  p.x += ox*k; p.y += oy*k;
  return true;
}

// ---- seeing, and hunting ----------------------------------------------------
// LINE OF SIGHT between two world points, through the maze's walls. A DDA: step
// cell to cell in the order the boundaries actually come, and check the one
// boundary each step crosses - so this is a handful of lookups down a long
// corridor, not a sample march.
//
// This is what makes a corner cover. cityClear does the same job for the city,
// and foeThink/foeGun fall back to "no walls anywhere" off the street grid,
// which inside a labyrinth means shooting you through four walls.
function dcClear(M, x0, y0, x1, y1){
  const C = M.cell, dx = x1 - x0, dy = y1 - y0;
  const c = dcCellAt(M, x0, y0), e = dcCellAt(M, x1, y1);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  // t of the next boundary on each axis, in [0,1] along the segment
  let tx = dx === 0 ? Infinity : (((dx > 0 ? c.x + 1 : c.x)*C) - x0)/dx;
  let ty = dy === 0 ? Infinity : (((dy > 0 ? c.y + 1 : c.y)*C) - y0)/dy;
  const stx = dx === 0 ? Infinity : Math.abs(C/dx);
  const sty = dy === 0 ? Infinity : Math.abs(C/dy);
  for(let i = 0; i < 512; i++){
    if(c.x === e.x && c.y === e.y) return true;
    if(tx < ty){
      if(tx > 1) return true;                                   // ran out of segment
      if(dcWallV(M, sx > 0 ? c.x + 1 : c.x, c.y)) return false;
      c.x += sx; tx += stx;
    } else {
      if(ty > 1) return true;
      if(dcWallH(M, c.x, sy > 0 ? c.y + 1 : c.y)) return false;
      c.y += sy; ty += sty;
    }
  }
  return false;
}
// THE HUNTERS' FLOW FIELD, the maze's answer to FLOW in index.html: a BFS of
// step counts filled outward from wherever he is standing. One field serves
// every sentry on the floor, so thirty of them cost one BFS a cell he moves.
//
// Without this a sentry aims straight at him and grinds along the wall in
// between, which in a labyrinth means it never arrives - it sits in the dead
// end next door pressing against the partition.
function dcFlow(M, sx, sy){
  const d = new Int32Array(M.cols*M.rows).fill(-1);
  if(!dcOpen(M, sx, sy)) return d;
  const q = [sx + sy*M.cols];
  d[q[0]] = 0;
  for(let head = 0; head < q.length; head++){
    const k = q[head], x = k % M.cols, y = (k - x)/M.cols;
    for(const dir of DC_DIRS){
      const nx = x + dir.dx, ny = y + dir.dy;
      if(M.grid[y][x].walls[dir.wall] || !dcOpen(M, nx, ny)) continue;
      const nk = nx + ny*M.cols;
      if(d[nk] >= 0) continue;
      d[nk] = d[k] + 1;
      q.push(nk);
    }
  }
  return d;
}
// the next cell CENTRE to walk toward, downhill on the field. null when it is
// already in his cell (go straight at him), off the grid, or walled off.
function dcFlowNext(M, field, wx, wy){
  const c = dcCellAt(M, wx, wy);
  if(!dcIn(M, c.x, c.y)) return null;
  const here = field[c.x + c.y*M.cols];
  if(here <= 0) return null;
  let best = null, bd = here;
  for(const dir of DC_DIRS){
    const nx = c.x + dir.dx, ny = c.y + dir.dy;
    if(M.grid[c.y][c.x].walls[dir.wall] || !dcOpen(M, nx, ny)) continue;
    const v = field[nx + ny*M.cols];
    if(v >= 0 && v < bd){ bd = v; best = { x:nx, y:ny }; }
  }
  return best ? dcWorld(M, best.x, best.y) : null;
}
// how far he is from a sentry THROUGH THE MAZE, in world units, for a give-up
// test that does not measure through walls. -1 when there is no path at all.
function dcFlowDist(M, field, wx, wy){
  const c = dcCellAt(M, wx, wy);
  if(!dcIn(M, c.x, c.y)) return -1;
  const v = field[c.x + c.y*M.cols];
  return v < 0 ? -1 : v*M.cell;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { dcGenerate, dcCells, dcReach, dcRings, dcPushOut, dcPlaces, dcClear, dcFlow, dcFlowNext, dcFlowDist };
