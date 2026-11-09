// fpsgun.js - the on-foot pistol (in the game since 2026-11-08; WALK_ARMED in config.js): hit-scan fire, recoil, muzzle flash, and the
// gun in your hands (the "viewmodel"), drawn by interchangeable METHODS so they
// can be compared side by side (V cycles them) with their draw cost measured.
//
// Loaded as a classic script before the game's own: it only DEFINES things, and
// everything it touches in the game (rcCtx, RC_W, walker, cars...) is looked up
// when its functions run, not when this file loads.
//
// The viewmodel is drawn into the raycaster's canvas (rcCtx), after the world and
// before the frame is blitted - so the ASCII pass (G) converts it like everything else.
// rcCtx is the half-res offscreen (RC_W x RC_H, ~320x180): chunky on purpose.

// ---------------------------------------------------------------- knobs
const PISTOL = {
  DMG:      18,     // per hit (machine gun bullet: 7, missile: 34)
  RATE:     0.30,   // seconds between shots (hold to keep firing at this rate)
  RANGE:    1600,   // world units
  HIT_R:    14,     // how far off the line of fire a car still counts as hit (car is 38 x 20)
  KICK:     0.16,   // recoil, seconds
  FLASH:    0.05,   // muzzle flash, seconds
};
// 2D image method: GUN_IMAGES (assets/guns/guns-2d.js, made by tools/gun_images.py)
// holds full-frame 16:9 pictures; this colour is keyed out to transparent.
const GUN_KEY = { G_MIN:150, RB_MAX:120 };          // "green": g >= G_MIN, r and b <= RB_MAX
// Where things are on the picture, as fractions of its width/height (measured on
// idle.png): the flash and the ejected casing are animated in code at these points.
// A drawn flash/casing frozen in a 'fire' picture just blinks, so the fire frame is
// off by default; the picture only supplies the gun.
const GUN_IMG = { MUZZLE:[0.512, 0.511], EJECT:[0.556, 0.565], USE_FIRE_FRAME:false,
                  FLASH_SCALE:1.3, CASING_SCALE:2,     // flash and brass size against this picture
                  SIGHT_GAP:5 };                       // front sight this many RC px under the crosshair
const CASING = { VX:[70, 110], VY:[-140, -100], G:520, LIFE:0.7 };   // RC px/s, px/s^2, s

// ---------------------------------------------------------------- state
const GUN_METHODS = ['code', 'image'];               // 'mesh' (3D, via rasterCar) comes next
let gunMethod = -1,                                   // -1: pick on first draw (pictures if there are any)
    gunCool = 0, gunKick = 0, gunFlash = 0;
let gunImpact = null;                                // { t, d, hit } the last shot's puff
let gunMarkT = 0;                                    // hit marker on the crosshair
const gunMs = {};                                    // smoothed draw cost per method, ms
let gunShots = 0, gunHits = 0;
const casings = [];                                  // brass in flight, RC pixel coords
let casingPending = false;                           // fired: spawn one at this frame's ejection port

function gunCycleMethod(){ gunMethod = (Math.max(0, gunMethod) + 1) % GUN_METHODS.length; }

function gunTick(dt){
  gunCool = Math.max(0, gunCool - dt);
  gunKick = Math.max(0, gunKick - dt);
  gunFlash = Math.max(0, gunFlash - dt);
  gunMarkT = Math.max(0, gunMarkT - dt);
  if(gunImpact){ gunImpact.t -= dt; if(gunImpact.t <= 0) gunImpact = null; }
  for(let i = casings.length - 1; i >= 0; i--){
    const c = casings[i];
    c.t -= dt; c.vy += CASING.G*c.k*dt; c.x += c.vx*dt; c.y += c.vy*dt; c.rot += c.spin*dt;
    if(c.t <= 0 || c.y > RC_H + 4) casings.splice(i, 1);
  }
}

// ---------------------------------------------------------------- firing
// Hit-scan along where you face: the nearest enemy whose centre passes within a
// hit radius of the line, unless a wall (the raycaster's depth down the centre
// column) is nearer. Your own car (cars[0]) is never a target.
//
// Cars and sentries are two passes over one running nearest-hit, so whichever is
// in front takes the round - and each uses its own radius, because PISTOL.HIT_R
// is 14 for a car 38 x 20 and a sentry is about 12 wide (FOE.HIT_R).
function gunFire(){
  if(gunCool > 0) return;
  gunCool = PISTOL.RATE; gunKick = PISTOL.KICK; gunFlash = PISTOL.FLASH; gunShots++; casingPending = true;
  if(typeof Snd !== 'undefined') Snd.shot();
  const w = walker, fx = Math.cos(w.a), fy = Math.sin(w.a);
  const wall = (typeof rcZ !== 'undefined' && rcZ && RC_W) ? rcZ[RC_W >> 1] : PISTOL.RANGE;
  let best = null, bestFoe = null, bd = Math.min(PISTOL.RANGE, wall || PISTOL.RANGE);
  for(let i = 1; i < cars.length; i++){
    const c = cars[i];
    if(c.dead) continue;
    const dx = c.x - w.x, dy = c.y - w.y;
    const along = dx*fx + dy*fy, lat = Math.abs(-dx*fy + dy*fx);
    if(along > 0 && along < bd && lat < PISTOL.HIT_R){ best = c; bestFoe = null; bd = along; }
  }
  if(typeof foes !== 'undefined') for(const f of foes){
    if(f.dead) continue;
    const dx = f.x - w.x, dy = f.y - w.y;
    const along = dx*fx + dy*fy, lat = Math.abs(-dx*fy + dy*fx);
    if(along > 0 && along < bd && lat < FOE.HIT_R){ bestFoe = f; best = null; bd = along; }
  }
  if(best || bestFoe){
    // five of these kills a sentry, which is the number FOE.HP is set from
    if(best) damage(best, PISTOL.DMG, 0);
    else     foeDamage(bestFoe, PISTOL.DMG, 0);
    gunHits++; gunMarkT = 0.15;
    if(typeof Snd !== 'undefined') Snd.hit();
  }
  gunImpact = { t:0.14, d:bd, hit:!!(best || bestFoe) };
}

// ---------------------------------------------------------------- drawing
// Where the gun sits this frame: walking bob, and recoil kicking it down.
function gunPose(w){
  const k = RC_H/180;                                // all shapes are designed at 180 tall
  const bob = w.moving ? 1 : 0;
  const kick = gunKick/PISTOL.KICK;                  // 1 just fired -> 0
  return {
    k,
    x: RC_W/2 + 14*k + Math.sin(w.bob*0.5)*3*k*bob,
    y: RC_H + 2*k + Math.abs(Math.cos(w.bob*0.5))*3*k*bob + kick*kick*9*k,
    kick
  };
}

function gunDraw(w){
  const t0 = performance.now();
  if(gunMethod < 0) gunMethod = (typeof GUN_IMAGES !== 'undefined' && GUN_IMAGES && GUN_IMAGES.idle) ? GUN_METHODS.indexOf('image') : 0;
  const g = rcCtx, m = GUN_METHODS[gunMethod];
  g.save();
  drawGunImpact(g);
  let A = null;                                      // { mx, my, ex, ey, k }: muzzle and ejection port this frame
  if(m === 'code') A = drawGunCode(g, gunPose(w));
  else if(m === 'image') A = drawGunImage(g, gunPose(w));
  if(A && casingPending){
    casings.push({ x:A.ex, y:A.ey, k:A.ck || A.k, t:CASING.LIFE, rot:0, spin:(18 + Math.random()*10),
                   vx:(CASING.VX[0] + Math.random()*(CASING.VX[1] - CASING.VX[0]))*A.k,
                   vy:(CASING.VY[0] + Math.random()*(CASING.VY[1] - CASING.VY[0]))*A.k });
  }
  casingPending = false;
  drawCasings(g);
  g.restore();
  const ms = performance.now() - t0;
  gunMs[m] = gunMs[m] == null ? ms : gunMs[m] + (ms - gunMs[m])*0.05;
}

// the shot landing, at the crosshair: sparks on a car, dust on a wall
function drawGunImpact(g){
  if(!gunImpact) return;
  const cx = RC_W/2, cy = RC_H/2, a = gunImpact.t/0.14;
  const r = Math.max(1.5, 220/Math.max(40, gunImpact.d))*(1.4 - a*0.4);
  g.globalAlpha = a;
  g.fillStyle = gunImpact.hit ? '#ffb347' : '#b8aeb8';
  for(let i = 0; i < 6; i++){
    const ang = i*1.047 + gunImpact.d, rr = r*(0.6 + 0.4*((i*7) % 3)/2);
    g.fillRect(Math.round(cx + Math.cos(ang)*rr), Math.round(cy + Math.sin(ang)*rr), 1, 1);
  }
  g.globalAlpha = 1;
}

// ---- method 1: drawn in code - flat polygons, no assets
function poly(g, col, x, y, k, pts){
  g.fillStyle = col; g.beginPath();
  g.moveTo(Math.round(x + pts[0]*k), Math.round(y + pts[1]*k));
  for(let i = 2; i < pts.length; i += 2) g.lineTo(Math.round(x + pts[i]*k), Math.round(y + pts[i+1]*k));
  g.closePath(); g.fill();
}
// the muzzle flash: a star just past the front sight, a new size and twist every frame
function drawMuzzleFlash(g, mx, my, k){
  if(gunFlash <= 0) return;
  const s = k*(0.8 + Math.random()*0.5), tw = (Math.random() - 0.5)*3;
  poly(g, '#ff9a3c', mx, my, s, [0,4, 8+tw,-2, 2,-1, tw,-12, -2,-1, -8+tw,-2]);
  poly(g, '#ffe7a0', mx, my, s, [0,2, 3,-2, 0,-6, -3,-2]);
}
// brass: a 3x1 / 2x2 / 1x3 pixel shape by its spin, with a glint
function drawCasings(g){
  for(const c of casings){
    const ph = ((c.rot % 3) + 3) % 3, k = Math.max(1, Math.round(c.k));
    const [w, h] = ph < 1 ? [3, 1] : ph < 2 ? [2, 2] : [1, 3];
    g.globalAlpha = Math.min(1, c.t*4);
    g.fillStyle = '#c8902c'; g.fillRect(Math.round(c.x), Math.round(c.y), w*k, h*k);
    g.fillStyle = '#ffe08a'; g.fillRect(Math.round(c.x), Math.round(c.y), k, k);
  }
  g.globalAlpha = 1;
}
function drawGunCode(g, P){
  const { x, y, k } = P;
  drawMuzzleFlash(g, x, y - 90*k, k);                 // first, so the slide sits in front of its base
  poly(g, '#55456a', x, y, k, [16,4, 70,4, 46,-26, 14,-32]);            // sleeve, from bottom right
  poly(g, '#7a6690', x, y, k, [16,4, 24,4, 18,-30, 14,-32]);            // its lit edge
  poly(g, '#4e4058', x, y, k, [-12,-20, 22,-22, 26,-46, -8,-48]);       // gloved hand round the grip
  poly(g, '#7a6684', x, y, k, [-12,-20, -6,-20, -4,-47, -8,-48]);       // knuckle light
  poly(g, '#4a4c58', x, y, k, [-10,-46, 12,-46, 9,-72, -7,-72]);        // slide, back face
  poly(g, '#8a909e', x, y, k, [-7,-72, 9,-72, 6,-80, -4,-80]);          // slide top, receding
  poly(g, '#d8c8a0', x, y, k, [-7,-72, -5,-72, -3,-80, -4,-80]);        // top edge catching the light
  poly(g, '#b0905c', x, y, k, [10,-46, 12,-46, 9,-72, 8,-72]);        // amber rim light, right edge
  poly(g, '#33343e', x, y, k, [-9,-60, 11,-60, 11,-58, -9,-58]);        // serrations
  poly(g, '#33343e', x, y, k, [-9,-55, 11,-55, 11,-53, -9,-53]);
  poly(g, '#c8c8d0', x, y, k, [-5,-80, -2,-80, -2,-84, -5,-84]);        // rear sight, two posts
  poly(g, '#c8c8d0', x, y, k, [3,-80, 6,-80, 6,-84, 3,-84]);
  poly(g, '#e8b860', x, y, k, [0,-82, 1,-82, 1,-86, 0,-86]);            // front sight dot, between them
  poly(g, '#5c4c68', x, y, k, [-14,-36, -8,-34, -6,-50, -12,-52]);      // thumb along the frame
  return { mx:x, my:y - 90*k, ex:x + 11*k, ey:y - 64*k, k };
}

// ---- method 2: a picture (yours), keyed and scaled to the raycaster's size
// Each GUN_IMAGES entry becomes a canvas at RC size once it has loaded; redone if RC size changes.
const gunImg = { key:'', frames:{}, loading:false, status:'' };
function gunImagesReady(){
  if(typeof GUN_IMAGES === 'undefined' || !GUN_IMAGES || !Object.keys(GUN_IMAGES).length){
    gunImg.status = 'no images: put PNGs in assets/guns/, run tools/gun_images.py'; return false;
  }
  const key = RC_W + 'x' + RC_H;
  if(gunImg.key === key) return Object.keys(gunImg.frames).length > 0;
  if(gunImg.loading) return false;
  gunImg.loading = true; gunImg.status = 'loading...';
  const names = Object.keys(GUN_IMAGES), frames = {};
  let left = names.length;
  for(const n of names){
    const im = new Image();
    im.onload = () => { frames[n] = keyAndScale(im); if(--left === 0) done(); };
    im.onerror = () => { if(--left === 0) done(); };
    im.src = GUN_IMAGES[n];
  }
  function done(){ gunImg.frames = frames; gunImg.key = key; gunImg.loading = false;
                   gunImg.status = Object.keys(frames).join(', '); }
  return false;
}
function keyAndScale(im){
  // key the green out at full size, then shrink to the raycaster's frame
  const W = im.naturalWidth, H = im.naturalHeight;
  const a = document.createElement('canvas'); a.width = W; a.height = H;
  const ac = a.getContext('2d'); ac.drawImage(im, 0, 0);
  const d = ac.getImageData(0, 0, W, H), p = d.data;
  for(let i = 0; i < p.length; i += 4){
    const r = p[i], gg = p[i+1], b = p[i+2];
    if(gg >= GUN_KEY.G_MIN && r <= GUN_KEY.RB_MAX && b <= GUN_KEY.RB_MAX) p[i+3] = 0;
    else if(gg > r && gg > b) p[i+1] = Math.max(r, b);   // de-spill: no green fringe
  }
  ac.putImageData(d, 0, 0);
  // fit the picture's width to the frame, bottom-aligned (it's a full-frame composition)
  const s = RC_W / W, h = Math.round(H*s);
  const o = document.createElement('canvas'); o.width = RC_W; o.height = h;
  const oc = o.getContext('2d'); oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
  oc.drawImage(a, 0, 0, W, H, 0, 0, RC_W, h);
  return o;
}
function drawGunImage(g, P){
  if(!gunImagesReady()) return null;
  const f = gunImg.frames;
  const fr = (GUN_IMG.USE_FIRE_FRAME && gunFlash > 0 && f.fire) ? f.fire : (f.idle || f[Object.keys(f)[0]]);
  if(!fr) return null;
  // placed by its FRONT SIGHT, not its frame: in the crosshair's column (where the
  // shot goes - the screen's centre), SIGHT_GAP under it; bob and recoil move it from there
  const ox = P.x - (RC_W/2 + 14*P.k), oy = P.y - (RC_H + 2*P.k);   // gunPose's bob + kick
  const dx = Math.round(RC_W/2 - GUN_IMG.MUZZLE[0]*fr.width + ox);
  const dy = Math.round(RC_H/2 + GUN_IMG.SIGHT_GAP*P.k - GUN_IMG.MUZZLE[1]*fr.height + oy);
  const mx = dx + GUN_IMG.MUZZLE[0]*fr.width, my = dy + GUN_IMG.MUZZLE[1]*fr.height;
  g.drawImage(fr, dx, dy);
  drawMuzzleFlash(g, mx, my - 2*P.k, P.k*GUN_IMG.FLASH_SCALE);   // in front, sitting on the front sight
  return { mx, my, ex:dx + GUN_IMG.EJECT[0]*fr.width, ey:dy + GUN_IMG.EJECT[1]*fr.height, k:P.k, ck:P.k*GUN_IMG.CASING_SCALE };
}

// ---------------------------------------------------------------- HUD
// the hit marker: an x round the crosshair (game and lab)
function gunMarker(){
  if(gunMarkT > 0){
    ctx.fillStyle = '#ffb347';
    for(const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      ctx.fillRect(VW/2 + sx*6 - (sx < 0 ? 2 : 0), VH/2 + sy*6, 2, 1);
      ctx.fillRect(VW/2 + sx*6, VH/2 + sy*6 - (sy < 0 ? 2 : 0), 1, 2);
    }
  }
}
// the lab's box: which method, what each costs
function gunHud(){
  const m = GUN_METHODS[Math.max(0, gunMethod)];
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '8px monospace';
  const lines = [
    'GUN LAB   viewmodel: ' + m.toUpperCase() + '   (V switch, G ascii)',
    GUN_METHODS.map(n => n + ' ' + (gunMs[n] == null ? '-' : gunMs[n].toFixed(3) + ' ms')).join('   ') +
      '   frame ' + (typeof walkMs !== 'undefined' ? walkMs.toFixed(1) : '-') + ' ms',
    'shots ' + gunShots + '  hits ' + gunHits + '   click / SPACE fire',
  ];
  if(m === 'image') lines.push(gunImg.status);
  ctx.fillStyle = 'rgba(7,4,15,.65)'; ctx.fillRect(VW - 236, 4, 232, 6 + lines.length*10);
  ctx.fillStyle = NEON.CYAN;
  lines.forEach((l, i) => ctx.fillText(l, VW - 8, 7 + i*10));
  ctx.textAlign = 'left';
}

// the lab starts in the city, on foot, armed
let gunLabBooted = false;
function gunLabBoot(){
  if(gunLabBooted) return false;
  gunLabBooted = true;
  skipToCity();
  if(cars[0]) cars[0].speed = 0;
  toggleOnFoot();
  return true;
}
