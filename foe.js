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

// Not white: `accent` is hexShade(col, 1.32), so a near-white body clamps accent
// to flat grey and the whole sentry washes out. A cooler, darker base keeps the
// highlight bluish and leaves the amber visor the only warm thing on the model.
const FOE_COL = '#a8b6d4';
const FOE_LIFT = 1.9;             // first person's lift (see foeSheetEnsure)
const FOE_LIFT_2D = 1.4;          // the driving view needs less (see bakeFoe2D)
// which carve a sentry uses when it doesn't name one. 96 is the detailed cut,
// 'sentry@64' the coarse one kept beside it for comparison (see HANDOFF).
let FOE_VOX = 'sentry@96';

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
// A sheet is 32 yaws x POSES poses x 2 rows (normal, white flash). Laid out with
// the yaws across and the poses down, so one pose is one strip of rows.
//
// Poses are baked ONE AT A TIME, the first time something actually shows that
// pose. All six at once is ~384 rasterCar calls per view, which is a visible
// freeze the first time a sentry comes into sight - and a sentry standing still
// only ever needs pose 0, so most of that work is for a walk that may never
// happen. foeSheetEnsure fills a strip on demand.
function foeSheetEnsure(sp, p){
  if(!sp || sp.done[p]) return;
  sp.done[p] = true;
  const pm = posedMesh(sp.mesh, p);
  const g = sp.cv.getContext('2d');
  const scratch = document.createElement('canvas');
  scratch.width = sp.fw*SS; scratch.height = sp.fh*SS;
  const sctx = scratch.getContext('2d');
  g.filter = 'brightness(' + sp.lift + ')';
  for(let f = 0; f < sp.n; f++){
    sctx.putImageData(rasterCar(sctx, pm, f/sp.n*Math.PI*2, sp.col, false,
                                sp.fw, sp.fh, sp.ax, sp.ay, sp.ky, sp.kz, sp.vsc), 0, 0);
    g.drawImage(scratch, 0, 0, scratch.width, scratch.height,
                f*sp.fw, p*sp.fh, sp.fw, sp.fh);
  }
  g.filter = 'none';
}
// everything the two cameras share: the mesh's own size decides the frame
function foeSheetNew(mesh, col, ky, kz, vsc, lift){
  let R = 0, zmax = 0;
  for(const f of mesh) for(const p of f.v){
    const r = Math.hypot(p[0], p[1]);
    if(r > R) R = r;
    if(p[2] > zmax) zmax = p[2];
  }
  const n = FOE_RIG.YAWS, P = FOE_RIG.POSES;
  const fw = Math.ceil(2*R*vsc) + 2;
  const fh = Math.ceil((zmax*kz + 2*R*ky)*vsc) + 2;
  const cv = document.createElement('canvas');
  cv.width = fw*n; cv.height = fh*P;
  return { cv, n, fw, fh, poses:P, mesh, col, ky, kz, vsc, lift,
           ax: fw/2,
           ay: fh - 1 - R*ky*vsc,          // model z=0 (the feet) near the bottom
           done: new Array(P).fill(false) };
}

const foeSheets = Object.create(null);
function bakeFoeSheet(col, want){
  const k = foeVoxName(want);
  if(!k) return null;
  if(foeSheets[k] && foeSheets[k].poses === FOE_RIG.POSES) return foeSheets[k];
  const mi = foeMesh(k);
  if(mi < 0) return null;
  // rasterCar's LIGHT is (-0.42,-0.58,0.70): for a CAR the lit faces are the
  // bodywork's tops, but a standing figure shows the camera its +y faces, and
  // LIGHT's y is negative - so the side you look at gets no diffuse at all and
  // the whole sentry bakes at the flat 0.44 ambient. The lift puts it back.
  // vsc=1, so one sheet pixel is one world unit and the billboard scales by
  // distance alone.
  const sp = foeSheetNew(MODELS[mi], col, KY_FPS, KZ_FPS, 1, FOE_LIFT);
  foeSheetEnsure(sp, 0);
  return (foeSheets[k] = sp);
}

// ---- the same model in the DRIVING view
// A billboard only exists in the raycaster, so until this existed a sentry simply
// was not drawn once you got back in the car. The voxel model pays for itself
// twice here: the top-down pane is the same mesh through rasterCar at the
// axonometric KY/KZ, which is exactly what bakeCarSheet does for a car. Baked at
// S like the cars' sheets, so it is dropped and redone by the same rescale that
// clears CAR2D.
const foeSheets2D = Object.create(null);
function clearFoeSheets(){
  for(const k in foeSheets2D) delete foeSheets2D[k];
}
function bakeFoe2D(col, want){
  const k = foeVoxName(want);
  if(!k) return null;
  const hit = foeSheets2D[k];
  if(hit && hit.S === PX*homeZoom() && hit.poses === FOE_RIG.POSES) return hit;
  const mi = foeMesh(k);
  if(mi < 0) return null;
  // Less lift than the first-person bake needs, but not none. The driving camera
  // is only 38 degrees up (KY 0.62), so most of what you see of a STANDING figure
  // is still its vertical faces - only the shoulders and the top of the head
  // catch LIGHT's +z. Unlifted it reads as a dark smudge next to the car.
  // At the SAME zoom the car sheets use, not the live S. Through the bend the
  // zoom eases frame by frame; baking at S would rebuild every strip every frame,
  // which is exactly why bakeCarSprites pins S to homeZoom() and lets drawCar
  // scale by zk. Latent until something eases the zoom, catastrophic then.
  const S0 = S; S = PX*homeZoom();
  let sp;
  try { sp = foeSheetNew(MODELS[mi], col, KY, KZ, S, FOE_LIFT_2D); sp.S = S; }
  finally { S = S0; }
  foeSheetEnsure(sp, 0);
  return (foeSheets2D[k] = sp);
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
  const pose = foePose(f);
  foeSheetEnsure(sp, pose);
  ctx.drawImage(sp.cv, fr*sp.fw, foeRow(sp, pose, f.hurtFlash > 0), sp.fw, sp.fh,
                Math.round(p.x - sp.ax*zk), Math.round(p.y - sp.ay*zk),
                Math.round(sp.fw*zk), Math.round(sp.fh*zk));
}

// ------------------------------------------------------------------- the rig
// Posing happens on the MESH, before the raster, so both the first-person and the
// top-down bake get the walk from one piece of code. Knobs: FOE_RIG in config.js.
//
// A face belongs to one group, decided by where its centre sits, so a quad is
// never split across a joint. Three groups: body (z >= HIP_Z), thigh, shin.
function rot2(x, z, pz, th){            // about an axis parallel to y at (0, pz)
  const c = Math.cos(th), s = Math.sin(th), dx = x, dz = z - pz;
  return [dx*c - dz*s, pz + dx*s + dz*c];
}
// the two leg angles at a point in the cycle. +ve swings the foot forward.
function foeLegs(ph){
  const S = FOE_RIG.SWING, K = FOE_RIG.KNEE;
  const si = Math.sin(ph), co = Math.cos(ph);
  return [
    { th:  S*si, knee: K*Math.max(0,  co) },   // the +y leg
    { th: -S*si, knee: K*Math.max(0, -co) },   // ...and the -y one, half a cycle off
  ];
}
// Straight legs rotating about a hip lift the feet off the floor, and a bent knee
// lifts them further, so the body has to come DOWN by however far the lower foot
// ended up - otherwise the sentry walks on tiptoe and bobs the wrong way. Rather
// than model it, put a foot through the same transform and read its height off.
function foeDrop(legs){
  let lowest = Infinity;
  for(const L of legs){
    let [x, z] = rot2(0, 0, FOE_RIG.KNEE_Z, -L.knee);   // shin folds back
    [x, z] = rot2(x, z, FOE_RIG.HIP_Z, L.th);           // ...then the whole leg swings
    if(z < lowest) lowest = z;
  }
  return lowest;
}
function posedMesh(mesh, pose){
  if(!pose) return mesh;                                 // pose 0 IS the drawing
  const ph = pose/FOE_RIG.POSES*Math.PI*2;
  const legs = foeLegs(ph), drop = foeDrop(legs);
  const out = [];
  for(const f of mesh){
    let cy = 0, cz = 0;
    for(const v of f.v){ cy += v[1]; cz += v[2]; }
    cy /= f.v.length; cz /= f.v.length;
    const L = cz < FOE_RIG.HIP_Z ? legs[cy >= 0 ? 0 : 1] : null;
    const shin = L && cz < FOE_RIG.KNEE_Z;
    out.push({ c:f.c, noCull:f.noCull, v: f.v.map(v => {
      if(!L) return [v[0], v[1], v[2] - drop];
      let x = v[0], z = v[2];
      if(shin) [x, z] = rot2(x, z, FOE_RIG.KNEE_Z, -L.knee);
      [x, z] = rot2(x, z, FOE_RIG.HIP_Z, L.th);
      return [x, v[1], z - drop];
    }) });
  }
  return out;
}
// which pose a sentry is showing. Standing still shows the drawing, which is why
// the sprite was drawn standing.
function foePose(f){
  if(!f.walk) return 0;
  return Math.floor((f.phase || 0)*FOE_RIG.POSES) % FOE_RIG.POSES;
}
// a sheet row: one strip per pose.
// No white flash row, unlike the car sheets. Nothing can hurt a sentry yet, so it
// was doubling every bake to draw something never shown. When damage arrives,
// either bake the second row back here or - better, and what the ASCII pane
// already does for cars - recolour at draw time with hitFrame().
function foeRow(sp, pose, flash){ return pose*sp.fh; }

// There is no AI yet. `walk` makes a sentry step forward so the rig can be looked
// at (Y toggles it); the phase advances with DISTANCE, not time, so the feet keep
// still against the ground whatever the speed becomes later.
// Bake ONE not-yet-baked pose strip per frame, as soon as anything is walking.
// Without this a strip is baked at the moment its pose is first shown, which is
// in the middle of the walk - the worst possible time, and six times over. This
// moves the same work to the frames right after a sentry starts moving, where a
// burst is far less noticeable, and leaves a sentry that never walks paying for
// pose 0 alone.
function foeWarm(){
  if(!foes.some(f => f.walk)) return;
  const k = foeVoxName();
  for(const sp of [foeSheets[k], foeSheets2D[k]]){
    if(!sp) continue;
    const p = sp.done.indexOf(false);
    if(p >= 0){ foeSheetEnsure(sp, p); return; }   // one strip a frame, no more
  }
}

function updateFoes(dt){
  foeWarm();
  for(const f of foes){
    if(f.dead) continue;
    if(f.hurtFlash > 0) f.hurtFlash = Math.max(0, f.hurtFlash - dt);
    if(!f.walk) continue;
    const d = FOE_RIG.WALK_SPD*dt;
    f.x += Math.cos(f.a)*d;
    f.y += Math.sin(f.a)*d;
    f.phase = ((f.phase || 0) + d/FOE_RIG.STRIDE) % 1;
  }
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
      const pose = foePose(f);
      foeSheetEnsure(sp, pose);
      rcCtx.globalAlpha = 1 - fog0*0.55;
      rcCtx.drawImage(sp.cv, fr*sp.fw, foeRow(sp, pose, f.hurtFlash > 0), sp.fw, sp.fh,
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
