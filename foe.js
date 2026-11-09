// foe.js - enemies on foot, as billboards in the first-person view.
//
// First cut, deliberately dumb: a sentry is a position and a picture. It does not
// move, think, or shoot. The point of this file is to get one through
// gatherBillboards -> rcSprites -> asciiBlit and see what the ASCII pass does to
// it, before any of that is worth writing.
//
// The picture comes from assets/enemies/enemies-2d.js (made by
// tools/enemy_images.py), already keyed, cropped and shrunk - so unlike the
// pistol there is nothing to do here but wait for it to decode. See
// assets/enemies/IMAGE_PROMPT.md for the art rules and why each one exists.
//
// Loaded as a classic script before the game's own: it only DEFINES things.

const FOE = {
  H:    22,     // world units tall. The player's eye is WALK_EYE (16), so a sentry
                // stands a good head over him - which is the point of him being an
                // old model nobody rates.
  R:     6,     // body radius (WALK_R is 5) - unused until they can be walked into
  HP:   60,     // WALK_HP is 40: a sentry takes more than a person
  FADE: 1100,   // same fog distance the car billboards use
};

let foes = [];

function spawnFoe(x, y, a, vox){
  const f = { x, y, a:a||0, hp:FOE.HP, dead:false, hurtFlash:0, vox:vox||null };
  foes.push(f);
  return f;
}
function clearFoes(){ foes.length = 0; }

// ---------------------------------------------------------------- the picture
// One Image per ENEMY_IMAGES entry. Nothing is resized: the packer already did
// it, and the billboard scales per frame anyway.
const foeImg = { frames:{}, loading:false, status:'', n:0 };
function foeImagesReady(){
  if(typeof ENEMY_IMAGES === 'undefined' || !ENEMY_IMAGES || !Object.keys(ENEMY_IMAGES).length){
    foeImg.status = 'no sprites: put PNGs in assets/enemies/, run tools/enemy_images.py';
    return false;
  }
  if(foeImg.n) return true;
  if(foeImg.loading) return false;
  foeImg.loading = true; foeImg.status = 'loading...';
  const names = Object.keys(ENEMY_IMAGES), frames = {};
  let left = names.length;
  for(const n of names){
    const im = new Image();
    im.onload  = () => { frames[n] = im; if(--left === 0) done(); };
    im.onerror = () => { if(--left === 0) done(); };
    im.src = ENEMY_IMAGES[n].src;
  }
  function done(){
    foeImg.frames = frames; foeImg.loading = false;
    foeImg.n = Object.keys(frames).length;
    foeImg.status = foeImg.n ? Object.keys(frames).join(', ') : 'none loaded';
  }
  return false;
}
function foeFrame(){ return foeImg.frames.sentry_idle || foeImg.frames[Object.keys(foeImg.frames)[0]] || null; }

// ------------------------------------------------------------ the voxel model
// The same sprite, carved into voxels by tools/sprite_voxelize.py and baked
// through rasterCar exactly like a car: 32 yaw frames and a white flash row, so
// you can walk round it. The model is built +x forward / +y lateral / +z up with
// its feet on z=0, which is the cars' convention, so the car's frame-picking
// formula works on it unchanged.
let FOE_RENDER = 'vox';                         // 'vox' | 'image'  (X cycles)
function foeCycleRender(){ FOE_RENDER = FOE_RENDER === 'vox' ? 'image' : 'vox'; return FOE_RENDER; }

// More than one model can be loaded at a time - two carves of the same drawing at
// different resolutions, or eventually different enemies - so meshes and baked
// sheets are both keyed by the SPRITEVOX name. foeVoxName() picks the default.
const foeMeshIdx = Object.create(null);
function foeVoxName(want){
  if(typeof SPRITEVOX === 'undefined' || !SPRITEVOX) return null;
  if(want && SPRITEVOX[want]) return want;
  return FOE_VOX && SPRITEVOX[FOE_VOX] ? FOE_VOX : Object.keys(SPRITEVOX)[0] || null;
}
function foeMesh(want){
  const k = foeVoxName(want);
  if(!k) return -1;
  if(k in foeMeshIdx) return foeMeshIdx[k];
  return (foeMeshIdx[k] = MODELS.push(voxMesh(SPRITEVOX[k])) - 1);
}

// One sheet, cached. Frame size comes from the model itself: rasterCar is called
// with vsc=1 (as bakeFpsSprites does), so one sheet pixel IS one world unit and
// the billboard can scale it by distance alone.
const foeSheets = Object.create(null);
function bakeFoeSheet(col, want){
  const k = foeVoxName(want);
  if(!k) return null;
  if(foeSheets[k]) return foeSheets[k];
  const mi = foeMesh(k);
  if(mi < 0) return null;
  const mesh = MODELS[mi];
  let R = 0, zmax = 0;
  for(const f of mesh) for(const p of f.v){
    const r = Math.hypot(p[0], p[1]);
    if(r > R) R = r;
    if(p[2] > zmax) zmax = p[2];
  }
  const n = 32;
  const fw = Math.ceil(2*R) + 2;
  const fh = Math.ceil(zmax*KZ_FPS + 2*R*KY_FPS) + 2;
  const ax = fw/2, ay = fh - 1 - R*KY_FPS;      // model z=0 (the feet) near the bottom
  const cvs = document.createElement('canvas');
  cvs.width = fw*n; cvs.height = fh*2;
  const g = cvs.getContext('2d');
  const scratch = document.createElement('canvas');
  scratch.width = fw*SS; scratch.height = fh*SS;
  const sctx = scratch.getContext('2d');
  for(let f = 0; f < n; f++) for(let row = 0; row < 2; row++){
    sctx.putImageData(rasterCar(sctx, mesh, f/n*Math.PI*2, col, row === 1,
                                fw, fh, ax, ay, KY_FPS, KZ_FPS, 1), 0, 0);
    // rasterCar's LIGHT is (-0.42,-0.58,0.70): for a CAR the lit faces are the
    // bodywork's tops, but a standing figure shows the camera its +y faces, and
    // LIGHT's y is negative - so the side you look at gets no diffuse at all and
    // the whole sentry bakes at the flat 0.44 ambient. The lift puts it back.
    // (Not on the flash row, which has to stay white.)
    g.filter = row === 1 ? 'none' : 'brightness(' + FOE_LIFT + ')';
    g.drawImage(scratch, 0, 0, scratch.width, scratch.height, f*fw, row*fh, fw, fh);
    g.filter = 'none';
  }
  return (foeSheets[k] = { cv:cvs, n, fw, fh, ax, ay });
}
// Chosen together with FOE_LIFT so the roles land where ASCII wants them: at the
// flat 0.44 ambient and lift 1.9, body ~185, accent ~213, shadowed ~114, and lamp
// comes out (213,193,134) - still r-b = 79, over ASC_LIGHT_WARM, so the visor
// keeps winning its character cell at distance.
// Not white: `accent` is hexShade(col, 1.32), so a near-white body clamps accent
// to flat grey and the whole sentry washes out. A cooler, darker base keeps the
// highlight bluish and leaves the amber visor the only warm thing on the model.
const FOE_COL = '#a8b6d4', FOE_LIFT = 1.9;
// which carve a sentry uses when it doesn't name one. 96 is the detailed cut,
// 'sentry@64' the coarse one kept beside it for comparison (see HANDOFF).
let FOE_VOX = 'sentry@96';
const FOE_LIFT_2D = 1.4;          // the driving view's lift (see bakeFoe2D)

// ---- the same model in the DRIVING view
// A billboard only exists in the raycaster, so until now a sentry simply was not
// drawn once you got back in the car. The voxel model pays for itself twice here:
// the top-down pane is the same mesh through rasterCar at the axonometric KY/KZ,
// which is exactly what bakeCarSheet does for a car. Baked at S like the cars'
// sheets, so it is dropped and redone by the same rescale that clears CAR2D.
const foeSheets2D = Object.create(null);
function clearFoeSheets(){
  for(const k in foeSheets2D) delete foeSheets2D[k];
}
function bakeFoe2D(col, want){
  const k = foeVoxName(want);
  if(!k) return null;
  const hit = foeSheets2D[k];
  if(hit && hit.S === S) return hit;
  const mi = foeMesh(k);
  if(mi < 0) return null;
  const mesh = MODELS[mi];
  let R = 0, zmax = 0;
  for(const f of mesh) for(const p of f.v){
    const r = Math.hypot(p[0], p[1]);
    if(r > R) R = r;
    if(p[2] > zmax) zmax = p[2];
  }
  const n = 32;
  const fw = Math.ceil(2*R*S) + 2;
  const fh = Math.ceil((zmax*KZ + 2*R*KY)*S) + 2;
  const ax = fw/2, ay = fh - 1 - R*KY*S;
  const cvs = document.createElement('canvas');
  cvs.width = fw*n; cvs.height = fh*2;
  const g = cvs.getContext('2d');
  const scratch = document.createElement('canvas');
  scratch.width = fw*SS; scratch.height = fh*SS;
  const sctx = scratch.getContext('2d');
  for(let f = 0; f < n; f++) for(let row = 0; row < 2; row++){
    sctx.putImageData(rasterCar(sctx, mesh, f/n*Math.PI*2, col, row === 1,
                                fw, fh, ax, ay, KY, KZ, S), 0, 0);
    // Less lift than the first-person bake needs, but not none. The driving
    // camera is only 38 degrees up (KY 0.62), so most of what you see of a
    // STANDING figure is still its vertical faces - only the shoulders and the
    // top of the head catch LIGHT's +z. Unlifted it reads as a dark smudge next
    // to the car.
    g.filter = row === 1 ? 'none' : 'brightness(' + FOE_LIFT_2D + ')';
    g.drawImage(scratch, 0, 0, scratch.width, scratch.height, f*fw, row*fh, fw, fh);
    g.filter = 'none';
  }
  return (foeSheets2D[k] = { cv:cvs, n, fw, fh, ax, ay, S });
}

function drawFoe2D(f){
  if(f.dead) return;
  const sp = bakeFoe2D(FOE_COL, f.vox);
  if(!sp) return;
  const zk = S/sp.S;                             // 1 except while the zoom eases
  const p = toScreen(f.x, f.y, 0);
  const TAU = Math.PI*2;
  const a = (((f.a || 0) % TAU) + TAU) % TAU;
  const fr = Math.round(a/TAU*sp.n) % sp.n;
  const row = f.hurtFlash > 0 ? sp.fh : 0;
  ctx.drawImage(sp.cv, fr*sp.fw, row, sp.fw, sp.fh,
                Math.round(p.x - sp.ax*zk), Math.round(p.y - sp.ay*zk),
                Math.round(sp.fw*zk), Math.round(sp.fh*zk));
}

// ---------------------------------------------------------------- the billboard
// Called from rcSprites with the numbers it has already worked out: sx is the
// screen column the sentry stands on, `ground` the ground line at its distance.
// One sprite, no turning frames, so it faces the camera from every angle - which
// is why the prompt asked for a straight-on symmetrical pose.
function drawFoeBillboard(f, sx, ground, scale, perp, camX, camY){
  const h = FOE.H*scale;
  if(h < 1) return;
  const fog0 = Math.min(0.78, perp/FOE.FADE);

  if(FOE_RENDER === 'vox'){
    const sp = bakeFoeSheet(FOE_COL, f.vox);
    if(sp){
      // the frame is picked from where it faces against the line of sight - the
      // car branch's formula, unchanged, because the model shares its axes
      const look = Math.atan2(f.y - camY, f.x - camX);
      const TAU = Math.PI*2;
      let yaw = (f.a || 0) - look - Math.PI/2;
      yaw = ((yaw % TAU) + TAU) % TAU;
      const fr = Math.round(yaw/TAU*sp.n) % sp.n;
      rcCtx.globalAlpha = 1 - fog0*0.55;
      rcCtx.drawImage(sp.cv, fr*sp.fw, f.hurtFlash > 0 ? sp.fh : 0, sp.fw, sp.fh,
                      sx - sp.ax*scale, ground - sp.ay*scale, sp.fw*scale, sp.fh*scale);
      rcCtx.globalAlpha = 1;
      return;
    }
  }

  const im = foeFrame();
  if(!im){                                     // no art yet: a box, so it is still testable
    const w = h*0.55;
    rcCtx.fillStyle = '#d8dce8';
    rcCtx.fillRect(sx - w/2, ground - h, w, h);
    rcCtx.fillStyle = '#ffa820';               // the visor, which is the part ASCII keeps
    rcCtx.fillRect(sx - w*0.3, ground - h*0.92, w*0.6, Math.max(1, h*0.06));
    return;
  }
  const w = h*(im.width/im.height);
  rcCtx.globalAlpha = 1 - fog0*0.55;
  rcCtx.drawImage(im, sx - w/2, ground - h, w, h);
  rcCtx.globalAlpha = 1;
}
