// foe.js - enemies on foot, as billboards in the first-person view.
//
// A sentry is a position, a picture, a walk cycle and - since 2026-11-09 - an AI
// of its own: it stands in the city ignoring you until you shoot it, and then it
// follows you until you get away. It never shoots back (the user's rule, asked
// and settled). The rules and the knobs are FOE_AI and FOE_POP in config.js 3e.
//
// Three things in here are deliberately NOT the car versions, and each one says
// why at its definition: foeDamage (not damage()), foeDie (not damage()'s death
// branch) and foeCollide (not walkCollide).
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
  R:     6,     // body radius (WALK_R is 5). It is solid: you walk into one, and a
                // provoked one will not let you past (foeCollide, and the clause
                // foeBlock adds to the walker).
  HP:   90,     // FIVE pistol hits, which is the number the user asked for:
                // PISTOL.DMG is 18, so 4x18 = 72 < 90 <= 5x18 = 90.
                // This is the PISTOL's number ONLY. The car's cannon (7 a round)
                // and its missile (34) land on whatever counts they land on -
                // there is no single HP that makes every weapon come out round,
                // so do not go hunting for one.
  HIT_R:   8,   // the pistol's lateral tolerance on a sentry. PISTOL.HIT_R is 14,
                // tuned for a car 38 x 20; a sentry is about 12 wide, so it gets
                // its own number rather than being hit from a body's width away.
  SHOT_R:  9,   // ...and a cannon round or a missile counts as a contact inside
                // this (the cars' own number is 15, for the same reason)
  RAM:   0.9,   // damage per unit/s of a car that drives into one, so about 100
  RAM_MIN:  40, // units/s is lethal. Below this it is only shoved aside.
  FADE: 1100,   // same fog distance the car billboards use
};

let foes = [];
let foeMadN = 0;        // how many are provoked right now; counted in updateFoes.
                        // cityStep reads it: a sentry hunting you on foot is the
                        // one case where the flow field has to be refilled and
                        // there is no hunter car to ask for it.

function spawnFoe(x, y, a, vox){
  const f = { x, y, a:a||0, hp:FOE.HP, dead:false, hurtFlash:0, vox:vox||null,
    // The AI's whole state. `mad` is all of it: a sentry is either ignoring you
    // or following you, and only a bullet of YOURS flips it on.
    mad:false, loseT:0, walk:false, phase:0,
    // `ck` is the city chunk it belongs to and `key` its name within the run.
    // Both are null on one dropped by hand (the Z key), which is what keeps the
    // test sentry out of the spawner's culling.
    ck:null, key:null,
    stuckT:0, lastX:x, lastY:y, side:0 };
  foes.push(f);
  return f;
}
// Every sentry loses its body. foeLive goes with them - it is the index of
// "who has a body right now", so leaving keys in it would tell citySentries that
// sentries it can no longer see are still out there, and they would never come
// back. What this does NOT clear is foeKilled (who you wrecked) or the plans;
// clearFoeWorld does that, and startMatch calls both.
function clearFoes(){ foes.length = 0; foeMadN = 0; foeLive.clear(); }

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
const FOE_LIFT = 1.9;             // first person's lift (see foeCellEnsure)
const FOE_LIFT_2D = 1.4;          // the driving view needs less (see bakeFoe2D)
// how far the hit flash brightens a sentry in the PIXEL panes. Zero in ASCII,
// where brightness is what picks the glyph - see hitFrame in index.html.
const FOE_HIT_LIFT = 0.5;
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
// Baked ONE CELL AT A TIME - one pose at one yaw - the first time something
// actually shows that cell, and never a whole strip.
//
// MEASURED, and this is the whole reason it works this way. A sentry's sheet is
// 6 poses x 16 yaws and costs 643 ms to fill; a STRIP (one pose, every yaw) is
// ~110 ms. Filling strips put one of those on the very frame a sentry came into
// sight and then five more on consecutive frames as it started walking, because
// foeWarm fed them in one at a time: half a second of screen updating at 9 fps,
// once per sheet. That is not a theory - the user hit it and called it a freeze.
// One CELL is ~7 ms for the sentry and ~13 ms for turret-02's 7478 faces, a long
// frame rather than a freeze, and the fillers do the rest in the background.
// A sentry that never walks still pays for pose 0 alone.
//
// This is the ONE bake path: the sentry's two sheets and both turret kinds all
// come through here. Nothing else may write to a sheet, or the ledger lies.
let foeScratch = null;
function foeCellEnsure(sp, p, fr){
  if(!sp) return;
  const i = p*sp.n + fr;
  // the index must be REAL. A NaN defeats a typed array silently - the write is
  // swallowed, the read comes back undefined - and the sheet then re-bakes every
  // sprite on every frame: ~200 ms a frame, forever, with nothing on screen to
  // show for it. Found exactly that way, by a harness that called rcSprites()
  // without its camera arguments and handed every billboard a NaN yaw.
  if(!(i >= 0 && i < sp.cell.length)) return;
  if(sp.cell[i]) return;
  sp.cell[i] = 1; sp.left--;
  // posedMesh is per POSE, so it is CACHED: at cell granularity it would
  // otherwise be rebuilt for all 16 yaws of the same pose.
  // `rig:false` is a TURRET: it has no legs, and posedMesh would split it at
  // FOE_RIG.HIP_Z (11 units, measured off the sentry) and swing the bottom half
  // of a gun emplacement like a pair of thighs.
  const pm = sp.pm[p] || (sp.pm[p] = sp.rig === false ? sp.mesh : posedMesh(sp.mesh, p));
  // one scratch canvas for every sheet, resized when it has to be. A fresh
  // canvas was affordable once per strip and is not once per cell.
  if(!foeScratch) foeScratch = document.createElement('canvas');
  if(foeScratch.width !== sp.fw*SS || foeScratch.height !== sp.fh*SS){
    foeScratch.width = sp.fw*SS; foeScratch.height = sp.fh*SS;
  }
  const sctx = foeScratch.getContext('2d');
  const g = sp.cv.getContext('2d');
  g.filter = 'brightness(' + sp.lift + ')';
  sctx.putImageData(rasterCar(sctx, pm, fr/sp.n*Math.PI*2, sp.col, false,
                              sp.fw, sp.fh, sp.ax, sp.ay, sp.ky, sp.kz, sp.vsc), 0, 0);
  g.drawImage(foeScratch, 0, 0, foeScratch.width, foeScratch.height,
              fr*sp.fw, p*sp.fh, sp.fw, sp.fh);
  g.filter = 'none';
}
// everything the two cameras share: the mesh's own size decides the frame
function foeSheetNew(mesh, col, ky, kz, vsc, lift, opt){
  opt = opt || {};
  let R = 0, zmax = 0;
  for(const f of mesh) for(const p of f.v){
    const r = Math.hypot(p[0], p[1]);
    if(r > R) R = r;
    if(p[2] > zmax) zmax = p[2];
  }
  const n = opt.n || FOE_RIG.YAWS, P = opt.poses || FOE_RIG.POSES;
  // The margin is in WORLD units, not sheet pixels. It used to be a flat +2, which
  // was invisible while vsc was always 1 - but the billboard divides sp.vsc back
  // out when it draws, so a flat margin shrinks with vsc and the sentry creeps up
  // off the ground (1 world unit at vsc 4, which is 14 px at arm's length).
  // Scaling it keeps every derived number identical to the vsc=1 geometry.
  const fw = Math.ceil(2*R*vsc + 2*vsc);
  const fh = Math.ceil((zmax*kz + 2*R*ky)*vsc + 2*vsc);
  const cv = document.createElement('canvas');
  cv.width = fw*n; cv.height = fh*P;
  return { cv, n, fw, fh, poses:P, mesh, col, ky, kz, vsc, lift,
           rig: opt.rig !== false,
           ax: fw/2,
           ay: fh - vsc - R*ky*vsc,       // model z=0 (the feet) near the bottom
           pm: new Array(P),               // posedMesh per pose, built on demand
           cell: new Uint8Array(P*n),      // the bake ledger: one byte per (pose, yaw)
           left: P*n };                    // ...and its count, so a FULL sheet
                                           // costs the fillers one compare a frame
                                           // instead of a scan of the ledger
}

const foeSheets = Object.create(null);
function bakeFoeSheet(col, want){
  const k = foeVoxName(want);
  if(!k) return null;
  if(foeSheets[k] && foeSheets[k].poses === FOE_RIG.POSES && foeSheets[k].vsc === FOE_VSC) return foeSheets[k];
  const mi = foeMesh(k);
  if(mi < 0) return null;
  // rasterCar's LIGHT is (-0.42,-0.58,0.70): for a CAR the lit faces are the
  // bodywork's tops, but a standing figure shows the camera its +y faces, and
  // LIGHT's y is negative - so the side you look at gets no diffuse at all and
  // the whole sentry bakes at the flat 0.44 ambient. The lift puts it back.
  // vsc=1, so one sheet pixel is one world unit and the billboard scales by
  // distance alone.
  // NOTHING is baked here. This used to fill pose 0 - 16 yaws, ~110 ms - on the
  // frame the first sentry came into sight, which is the worst frame in the game
  // to spend it on. The draw path pulls the one cell it needs, foeWarm the rest.
  const sp = foeSheetNew(MODELS[mi], col, KY_FPS, KZ_FPS, FOE_VSC, FOE_LIFT);
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
const turretSheets2D = Object.create(null);
function clearFoeSheets(){
  for(const k in foeSheets2D) delete foeSheets2D[k];
  for(const k in turretSheets2D) delete turretSheets2D[k];
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
  return (foeSheets2D[k] = sp);
}

// The same bake for the driving pane. A turret may NOT go through bakeFoe2D:
// that one is keyed by foeVoxName and rigged, so it would hand a gun emplacement
// to posedMesh and swing its base like a pair of thighs. One row, no rig, and
// TURRET.YAWS directions rather than the sentry's 16 - it is a bigger silhouette
// and it turns on the spot, which is all you see of it from up here.
function bakeTurret2D(kind){
  const k = turretVoxName(kind);
  if(!k) return null;
  const hit = turretSheets2D[k];
  if(hit && hit.S === PX*homeZoom()) return hit;
  const mi = turretMesh(kind);
  if(mi < 0) return null;
  const S0 = S; S = PX*homeZoom();        // pinned to the cars' zoom, as bakeFoe2D is
  let sp;
  try {
    sp = foeSheetNew(MODELS[mi], TURRET.KINDS[kind].col, KY, KZ, S, FOE_LIFT_2D,
                     { n:TURRET.YAWS, poses:1, rig:false });
    sp.S = S;
  } finally { S = S0; }
  return (turretSheets2D[k] = sp);
}
// A TURRET from above. No pose and no walk - it has one row - and no rise either:
// the lid is a datacenter trick and the only turrets the driving pane can see are
// the emplacements out on the square, which are up from the moment they spawn.
function drawTurret2D(f){
  const sp = bakeTurret2D(f.turret);
  if(!sp) return;
  const zk = S/sp.S;                             // 1 except while the zoom eases
  const p = toScreen(f.x, f.y, 0);
  const TAU = Math.PI*2;
  const a = (((f.a || 0) % TAU) + TAU) % TAU;
  const fr = Math.round(a/TAU*sp.n) % sp.n;
  foeCellEnsure(sp, 0, fr);
  const dx = Math.round(p.x - sp.ax*zk), dy = Math.round(p.y - sp.ay*zk);
  const w = Math.round(sp.fw*zk), h = Math.round(sp.fh*zk);
  if(f.hurtFlash > 0) ctx.drawImage(hitFrame(sp, fr, 0, FOE_HIT_LIFT), 0, 0, sp.fw, sp.fh, dx, dy, w, h);
  else                ctx.drawImage(sp.cv, fr*sp.fw, 0, sp.fw, sp.fh, dx, dy, w, h);
}

function drawFoe2D(f){
  if(f.dead) return;
  if(f.turret){ drawTurret2D(f); return; }
  const sp = bakeFoe2D(FOE_COL, f.vox);
  if(!sp) return;
  const zk = S/sp.S;                             // 1 except while the zoom eases
  const p = toScreen(f.x, f.y, 0);
  const TAU = Math.PI*2;
  const a = (((f.a || 0) % TAU) + TAU) % TAU;
  const fr = Math.round(a/TAU*sp.n) % sp.n;
  const pose = foePose(f);
  foeCellEnsure(sp, pose, fr);
  const row = foeRow(sp, pose, false);
  const dx = Math.round(p.x - sp.ax*zk), dy = Math.round(p.y - sp.ay*zk);
  const w = Math.round(sp.fw*zk), h = Math.round(sp.fh*zk);
  // the hit flash, recoloured from this pose's strip rather than baked as a
  // second row - see foeRow. hitFrame takes a row because of this.
  // the driving pane is always pixels, so it always takes the lift
  if(f.hurtFlash > 0) ctx.drawImage(hitFrame(sp, fr, row, FOE_HIT_LIFT), 0, 0, sp.fw, sp.fh, dx, dy, w, h);
  else                ctx.drawImage(sp.cv, fr*sp.fw, row, sp.fw, sp.fh, dx, dy, w, h);
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
// a sheet row: one strip per pose, and no white flash row unlike the car sheets.
// Something CAN hurt a sentry now, and the flash is still not baked: both views
// recolour at draw time with hitFrame() instead. Baking the row back would double
// every strip's bake cost (the thing that caused the first-walk stutter) to draw
// a white silhouette, and a white silhouette is exactly what destroys the glyph
// read in the ASCII pane - which is why hitFrame exists for the cars already.
function foeRow(sp, pose, flash){ return pose*sp.fh; }

// `walk` is the one flag that means "stepping". The AI owns it while a sentry is
// provoked; while a sentry is ignoring you it is left alone, which is what keeps
// the Y key (set every sentry marching, to look at the rig) working.
// Fill FOE_RIG.WARM cells a frame in the background, so that the cell the draw
// path asks for has nearly always been paid for already.
//
// The POSE policy is the old one and is deliberate: pose 0 is filled whatever
// happens, because a sentry standing still still TURNS and so still works
// through every yaw of it, while the five walk poses are only filled once
// something is actually walking - a sentry that never takes a step never pays
// for the stride. What changed is the granularity: cells, not strips, because a
// strip a frame IS the freeze the user saw (see foeCellEnsure).
//
// One sheet a frame: the first with anything left takes the whole budget, so the
// first-person sheet and the driving sheet never charge for the same frame.
function foeWarm(){
  const k = foeVoxName();
  const a = foeSheets[k], b = foeSheets2D[k];
  // the common case by far: both sheets full, nothing to do, and no reason to
  // walk the ledgers or the foe list to find that out.
  if(!(a && a.left) && !(b && b.left)) return;
  const walking = foes.some(f => f.walk);
  for(const sp of [a, b]){
    if(!sp || !sp.left) continue;
    const poses = walking ? sp.poses : 1;
    let budget = FOE_RIG.WARM;
    for(let p = 0; p < poses && budget > 0; p++)
      for(let fr = 0; fr < sp.n && budget > 0; fr++)
        if(!sp.cell[p*sp.n + fr]){ foeCellEnsure(sp, p, fr); budget--; }
    if(budget < FOE_RIG.WARM) return;
  }
}

// ------------------------------------------------------------------- damage
// NOT damage() in index.html. That one is car-only all the way through -
// untouchable(), armorCut(), respawn, deaths, the death clip, the bounty - and a
// sentry shares none of it. Bending it to take a pedestrian would mean carrying
// car bookkeeping on something that has no car in it.
//
// Being shot is the ONLY thing that provokes a sentry, and it provokes THAT one.
// The others carry on ignoring you however loud it gets: each one is on its own,
// by the user's decision, so there is nothing here that touches its neighbours.
function foeDamage(f, amount, ownerId){
  if(f.dead || !(amount > 0)) return;   // a 0-damage blast must not anger anybody
  f.hp -= amount;
  f.hurtFlash = 0.12;
  // ...but only YOUR fire wakes it up. A hunter's stray round still hurts a
  // sentry; it just does not make the sentry blame you for it.
  if(ownerId === 0){ f.mad = true; f.loseT = 0; }
  if(f.hp <= 0) foeDie(f, ownerId);
  else if(typeof Snd !== 'undefined') Snd.hit();
}
// The cars' explosion, which is what the user asked for: explode() plus two
// particles() bursts in the sentry's own colours. NOT a copy of damage()'s death
// branch - that branch is the tanque's bomb, lastHitBy, frags, convoyKills, the
// respawn timer and the down-a-pit clip, and none of it means anything here.
//
// dmg 0 on the blast, so a sentry going off never chains into the one down the
// street. (explode() reads 0 as 0 for sentries on purpose; for CARS its old
// `dmg||30` fallback still applies, exactly as a wrecked car's blast always has.)
function foeDie(f, ownerId){
  f.hp = 0; f.dead = true; f.walk = false; f.mad = false;
  if(f.key) foeKilled.add(f.key);       // and it stays wrecked if you come back
  // centred on the TORSO (FOE_BLAST_Z): explode() puts its ring 4 and its sparks 6
  // above `z`, and its debris still falls to the ground (floor 0)
  const bz = typeof FOE_BLAST_Z !== 'undefined' ? FOE_BLAST_Z : 8;
  explode(f.x, f.y, SHAKE.SENTRY, null, 0, 10, { z:bz - 6, floor:0 });   // power only drives the camera kick
  particles(f.x, f.y, bz, 14, {col:[FOE_COL, '#ffa820', '#3a3040'],
    spd0:50, spd1:190, size:2, life0:0.3, life1:0.9});
  particles(f.x, f.y, bz - 4,  8, {col:['#4a3f50', '#6b5c72'],
    spd0:10, spd1:60, size:3, life0:0.5, life1:1.2, grav:20});
  if(ownerId === 0){
    gunnerKill = 1.1;                   // the driving pane's kill flash
    // state property is state property: the Saints pay for a sentry as well, at a
    // fraction of a car's bounty (SAINTS.BOUNTY.sentry). Only what YOU wrecked -
    // a sentry mown down by a hunter car pays nobody.
    const pay = (typeof SAINTS !== 'undefined' && SAINTS.BOUNTY.sentry) || 0;
    if(pay){
      cash += pay;
      saintsPay = { amt: pay + (saintsPay && saintsPay.t > 0 ? saintsPay.amt : 0), t:1.8 };
    }
  }
}

// ---------------------------------------------------------------- collision
// walkCollide's job, for a sentry. Not walkCollide itself: that one is hard-wired
// to WALK_R, carries a wasteland branch a sentry never stands in, and clamps to
// the walker's wander limit instead of the city wall.
//
// The parked-car clause IS right for a sentry, for the same reason it is right
// for the player: it should walk round the thing rather than through it. A car
// that is MOVING catches one instead (foeRam).
function foeCollide(f){
  // inside the datacenter the city does not exist: the floor's own walls are the
  // whole world, and the parked car is outside it (maze.js, dcPushOut).
  if(typeof dcq !== 'undefined' && dcq && dcq.inside){ dcPushOut(dcq.inside.M, f, FOE.R); return; }
  for(const c of cityChunks(f.y - FOE.R, f.y + FOE.R, f.x < 0 ? -1 : 1))
    for(const b of c.cores) circleBox(f, b.x0, b.y0, b.x1, b.y1, FOE.R, false);
  const c = cars[0];
  if(c && !c.dead){
    const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    const lp = { x:(f.x - c.x)*ca + (f.y - c.y)*sa, y:-(f.x - c.x)*sa + (f.y - c.y)*ca };
    if(pushOutBox(lp, -CAR_HL, -CAR_HW, CAR_HL, CAR_HW, FOE.R)){
      f.x = c.x + lp.x*ca - lp.y*sa;
      f.y = c.y + lp.x*sa + lp.y*ca;
    }
  }
  f.x = clamp(f.x, -(CITY_W - FOE.R), CITY_W - FOE.R);
}
// Two sentries coming down the same street would otherwise stack into one
// sprite. Only the PROVOKED ones are compared against each other, which is
// almost always none or one or two: foes[] has no spatial index, and that is the
// reason not to run an O(n^2) pass over every sentry in the city.
function foeSeparate(){
  if(foeMadN < 2) return;
  // `!f.turret`: a turret is BOLTED INTO THE FLOOR over a hatch it has to stay on
  // top of, and the only thing that ever makes one `mad` is the player shooting
  // it - at which point this would quietly walk it off its own hole.
  const m = foes.filter(f => f.mad && !f.dead && !f.turret), R = FOE.R*2;
  for(let i = 0; i < m.length; i++) for(let j = i + 1; j < m.length; j++){
    const a = m[i], b = m[j];
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if(d >= R) continue;
    if(d < 1e-4){ dx = 1; dy = 0; d = 1; }
    const k = (R - d)/2/d;
    a.x -= dx*k; a.y -= dy*k;
    b.x += dx*k; b.y += dy*k;
  }
}
// The player on foot, pushed out of any sentry he walks into. Kept OUT of
// walkCollide deliberately: toggleOnFoot uses walkCollide as a "is this spot
// free?" probe for the driver's door, and a sentry loitering by the car would
// then report NO ROOM TO OPEN THE DOOR, which is both wrong and baffling.
// A sentry does not hurt you by touching you - it has no weapon, by decision.
// It simply will not let you through, which is the whole of the threat.
function foeBlock(p){
  for(const f of foes){
    if(f.dead) continue;
    // `f.r` is the TURRET's own footprint - 16 for the missile rack, whose base
    // ring really is that wide. A flat FOE.R let you stand inside one.
    if(f.turret && f.rise < 1) continue;         // still coming up: not there yet
    const R = (f.r || FOE.R) + WALK_R;
    const dx = p.x - f.x, dy = p.y - f.y;
    if(dx > R || dx < -R || dy > R || dy < -R) continue;
    const d = Math.hypot(dx, dy);
    if(d >= R || d < 1e-6) continue;
    p.x = f.x + dx/d*R; p.y = f.y + dy/d*R;
  }
}
// A car that drives into a sentry. Nobody asked for this; a car passing clean
// THROUGH one reads as a bug, and the game already does the same thing to the
// player on foot (WALK_RUNOVER). Slow, and it is only shoved out of the way.
function foeRam(){
  if(!foes.length) return;
  for(const c of cars){
    if(c.dead) continue;
    const sp = Math.hypot(c.vx, c.vy), cr = c.rad || 14, R = cr + FOE.R;
    for(const f of foes){
      if(f.dead) continue;
      // A TURRET IS NOT A PEDESTRIAN. Everything below this line throws the FOE
      // clear and kills it on contact, and both are wrong for a thing that is
      // bolted down and armoured. Its own branch, next function.
      if(f.turret){ turretRam(f, c, sp, cr); continue; }
      const dx = f.x - c.x, dy = f.y - c.y;
      if(dx > R || dx < -R || dy > R || dy < -R) continue;   // cheap reject first
      const d = Math.hypot(dx, dy);
      if(d > R) continue;
      const k = (R + 2 - d)/(d || 1);
      f.x += dx*k; f.y += dy*k;                              // thrown clear either way
      // a guard is braced for it: shoved, never hurt - you have to get out and fight
      if(sp > FOE.RAM_MIN && !f.guard) foeDamage(f, sp*FOE.RAM, c.id);
    }
  }
}
// A car that drives into a TURRET. Two things are different, and they are the
// same two things that make a turret a turret rather than a man:
//
//   IT DOES NOT MOVE. A sentry is thrown clear, which is also what kept the old
//   one-contact kill from reading as a bug - the body left. An emplacement is
//   bolted over a hatch it has to stay on top of (the same reason foeSeparate
//   and foeStuck skip them), so the CAR is what gets thrown, on exactly the
//   constants a barrel throws it on (blockCollide's round branch in index.html:
//   out to the touching distance, normal velocity reflected at 1.35, 0.86 off
//   the rest). Driving through one was only ever invisible because the turret
//   died in the same frame.
//
//   IT DOES NOT DIE AT ONCE. TURRET.RAM_* - a fixed share of its own hp per ram,
//   mildly harder the faster you were going, and one ram per RAM_GAP seconds.
//
// Not gated on f.guard: that flag is a bunker sentry braced for a bumper, and a
// turret's armour is already in the numbers.
function turretRam(f, c, sp, cr){
  if(f.rise < 1) return;             // under the floor, or still coming up out of
                                     // it: there is nothing there to hit yet, and
                                     // this is foeBlock's rule for the walker
  const R = (f.r || FOE.R) + cr;     // f.r is the turret's OWN footprint - 16 for
                                     // the missile rack, whose base ring is 35
                                     // across. FOE.R (6) let you park inside one.
  let dx = c.x - f.x, dy = c.y - f.y;
  if(dx > R || dx < -R || dy > R || dy < -R) return;      // cheap reject first
  let d = Math.hypot(dx, dy);
  if(d > R) return;
  if(d < 1e-4){ dx = 1; dy = 0; d = 1; }
  const nx = dx/d, ny = dy/d;
  c.x = f.x + nx*R; c.y = f.y + ny*R;
  const vn = c.vx*nx + c.vy*ny;
  if(vn < 0){                        // only when it is still coming AT the turret:
    c.vx -= nx*vn*1.35;              // the frame after a bounce it is leaving, and
    c.vy -= ny*vn*1.35;              // reflecting that would suck it back in
    c.vx *= 0.86; c.vy *= 0.86;
  }
  if(sp <= FOE.RAM_MIN || f.ramLock > 0) return;
  f.ramLock = TURRET.RAM_GAP;
  const t = clamp((sp - FOE.RAM_MIN)/(CAR_TOP - FOE.RAM_MIN), 0, 1);
  const K = TURRET.KINDS[f.turret];
  foeDamage(f, K.hp*(TURRET.RAM_LO + (TURRET.RAM_HI - TURRET.RAM_LO)*t), c.id);
}

// -------------------------------------------------------------------- the AI
// Each sentry on its own, two states, and one thing that moves between them:
//
//   ignoring you  --you shoot it-->  following you  --you get away-->  ignoring you
//
// It never shoots. Following IS the threat, which is why it walks faster than you
// do (FOE_AI.CHASE_SPD against WALK_SPD 46) and why it is solid.
//
// The route is the hunters' flow field - FLOW / flowNext in index.html - a BFS of
// the streets filled outward from wherever you are, so a sentry comes down the
// street that actually leads to you instead of grinding into a wall. That field
// is built with CAR clearances; the only cost of borrowing it is that a sentry
// keeps to the roadway, and a pedestrian variant is a later nicety.
function foeThink(f, dt){
  // A TURRET IS NOT A WALKER. Everything below this line is about where to put
  // its feet next - the flow field, the stuck check, the give-up radius - and a
  // thing bolted into the floor has no use for any of it. It gets its own brain
  // and comes straight back out.
  if(f.turret){ turretThink(f, dt); return; }
  // QUEST 1's bunker guards don't wait to be shot: get close and they come
  if(f.guard && !f.mad && typeof cityTarget === 'function'){
    const T0 = cityTarget();
    if(Math.hypot(T0.x - f.x, T0.y - f.y) < QUEST.GUARD_AGGRO){ f.mad = true; f.loseT = 0; }
  }
  // A DATACENTER SENTRY doesn't wait to be shot either, and it doesn't need you
  // close - it needs to SEE you. dcClear walks the maze's own walls between the
  // two of you, so the corner you just turned is cover and the one grinding
  // around in the next corridor is deaf. A plain radius would wake the whole
  // floor at once through the partitions, which is the opposite of a labyrinth.
  const dcM = (f.dc && typeof dcq !== 'undefined' && dcq && dcq.inside) ? dcq.inside.M : null;
  if(dcM && !f.mad){
    const T0 = cityTarget();
    if(Math.hypot(T0.x - f.x, T0.y - f.y) < DC.FOE_AGGRO && dcClear(dcM, f.x, f.y, T0.x, T0.y)){
      f.mad = true; f.loseT = 0;
      if(typeof Snd !== 'undefined' && Snd.voice) Snd.voice(430, 0.12, 'square', 0.03, 230);   // it has you
    }
  }
  if(!f.mad) return;              // ignoring you: whatever `walk` is, it is not the AI's
  const T = cityTarget();
  const dx = T.x - f.x, dy = T.y - f.y, dist = Math.hypot(dx, dy);
  // the floor's shared BFS, built once a cell he moves - see dcHunt
  const field = dcM && typeof dcHunt === 'function' ? dcHunt() : null;
  // ...and when they reach you, they hit: you on foot, or whatever you drive
  if(f.guard){
    f.hitT = Math.max(0, (f.hitT || 0) - dt);
    const reach = FOE_AI.STOP + (onFoot ? 6 : (cars[0].rad || 14) + 4);
    if(dist < reach && f.hitT <= 0){
      f.hitT = QUEST.GUARD_HIT_T;
      if(onFoot) hurtWalker(QUEST.GUARD_DMG_WALK);
      else if(!devMode) damage(cars[0], QUEST.GUARD_DMG_CAR, -1);
      Snd.hit();
    }
  }
  // Losing you: out here that is the straight line, but inside the maze a wall
  // is not distance - 200 units away through three partitions is a long walk, so
  // in here it gives up on the FLOW distance instead.
  const fd = dcM && field ? dcFlowDist(dcM, field, f.x, f.y) : -1;
  const lost = dcM && field ? (fd < 0 || fd > DC.FOE_FORGET)
                            : dist > (f.guard ? QUEST.GUARD_GIVE_UP : FOE_AI.GIVE_UP);
  if(lost){
    f.loseT += dt;
    if(f.loseT > FOE_AI.LOSE_T){ f.mad = false; f.loseT = 0; f.walk = false; f.side = 0;
      if(f.route) f.rejoin = true;        // a mover goes back to its round
      return; }
  } else f.loseT = 0;
  // Where to put its feet next. Close and in the open: straight at you.
  // Otherwise a few cells down the flow field. If even that comes back empty
  // (off the grid, or walled off from you) head your way anyway and let the
  // collision shove it round whatever is in front.
  //
  // Outside the city there is no street to route along, so skip the lot: that is
  // the Z key in a lab or on a straight leg, and cityClear would otherwise reach
  // into cityGround, which happily generates city chunks at any y once
  // cityLimitY is Infinity.
  // Inside the datacenter the city's flow field is the wrong map entirely (it is
  // a BFS of STREETS, and `street` stays true in here), so the floor's own field
  // takes precedence. Without it a sentry aims straight through the partition and
  // grinds along it for ever, one corridor from you.
  const inCity = typeof street !== 'undefined' && street;
  const aim = dcM ? ((field && dcFlowNext(dcM, field, f.x, f.y)) || T)
            : (!inCity || (dist < FOE_AI.NEAR && cityClear(f.x, f.y, T.x, T.y))) ? T
            : (flowNext(f.x, f.y) || T);
  let want = Math.atan2(aim.y - f.y, aim.x - f.x);
  if(f.side) want += f.side*1.2;                  // wedged: shoulder past it
  f.a += clamp(angDiff(f.a, want), -FOE_AI.TURN*dt, FOE_AI.TURN*dt);
  f.walk = dist > FOE_AI.STOP;                    // stops at arm's length
  foeGun(f, dt, T, dist);
}
// FOE_GUN: rest, then (in range, with a clear line) stop and glow for WINDUP,
// then one bolt at where you are NOW. No lead: a bolt you see coming is one
// you can step out of the way of.
function foeGun(f, dt, T, dist){
  if(typeof FOE_GUN === 'undefined' || typeof shots === 'undefined') return;
  if(f.gunT === undefined) f.gunT = FOE_GUN.REST[0]*Math.random();   // they don't all open up at once
  const mx = () => f.x + Math.cos(f.a)*6, my = () => f.y + Math.sin(f.a)*6;
  if(f.charge > 0){
    f.walk = false;                                 // planted while it aims
    f.charge -= dt;
    // the tell: sparks gathering at the gun hand, thicker as it builds
    f.glowT = (f.glowT || 0) - dt;
    if(f.glowT <= 0 && typeof particles === 'function'){
      f.glowT = 0.04;
      const k = 1 - f.charge/FOE_GUN.WINDUP;
      particles(mx(), my(), FOE_GUN.MUZZLE_Z, 1 + (k*2|0), { col:[FOE_GUN.COL, FOE_GUN.GLOW], spd0:4, spd1:14 + 20*k,
        size:1 + k, life0:0.06, life1:0.14, grav:0, up0:-4, up1:4 });
    }
    if(f.charge <= 0){
      f.charge = 0;
      f.gunT = FOE_GUN.REST[0] + Math.random()*(FOE_GUN.REST[1] - FOE_GUN.REST[0]);
      const a = Math.atan2(T.y - my(), T.x - mx());
      shots.push({ kind:'bolt', foe:true, x:mx(), y:my(), z:FOE_GUN.MUZZLE_Z,
        vx:Math.cos(a)*FOE_GUN.SPD, vy:Math.sin(a)*FOE_GUN.SPD,
        life:FOE_GUN.RANGE/FOE_GUN.SPD, owner:-2, dmg:FOE_GUN.DMG_CAR, dmgWalk:FOE_GUN.DMG_WALK });
      if(typeof particles === 'function')
        particles(mx(), my(), FOE_GUN.MUZZLE_Z, 6, { col:[FOE_GUN.GLOW, '#ffffff', FOE_GUN.COL], spd0:20, spd1:70, size:1.5, life0:0.05, life1:0.14, grav:0 });
      if(typeof Snd !== 'undefined' && Snd.voice) Snd.voice(1100, 0.16, 'sawtooth', 0.05, 260);   // a zap, not a bang
      f.x -= Math.cos(a)*1.5; f.y -= Math.sin(a)*1.5;                                            // a little kick
    }
    return;
  }
  f.gunT -= dt;
  if(f.gunT > 0 || dist > FOE_GUN.RANGE) return;
  // No line, no shot - and inside the datacenter the line is the MAZE's walls,
  // not the city's footprints. cityClear knows nothing about a corridor, so
  // without this branch a woken sentry shoots you through four partitions.
  if(f.dc && typeof dcq !== 'undefined' && dcq && dcq.inside){
    if(!dcClear(dcq.inside.M, f.x, f.y, T.x, T.y)) return;
  } else {
    const inCity = typeof street !== 'undefined' && street;
    if(inCity && typeof cityClear === 'function' && !cityClear(f.x, f.y, T.x, T.y)) return;
  }
  f.charge = FOE_GUN.WINDUP; f.glowT = 0;
}
// Wedged on a corner the field routed it into, or shouldering the car: lean off
// to ONE side for a while - the same side until it comes free, so it does not
// jitter left and right against a wall - and straighten up once it is moving.
function foeStuck(dt){
  for(const f of foes){
    // A TURRET is bolted to the floor: it cannot be wedged on a corner, and
    // `side` is not its field. Without this it was swept up here EVERY FRAME -
    // see the `arm` note in spawnTurret for what that did.
    if(f.turret) continue;
    if(f.dead || !f.mad){ f.stuckT = 0; f.side = 0; continue; }
    f.stuckT += dt;
    if(f.stuckT < FOE_AI.STUCK_T) continue;
    const moved = Math.hypot(f.x - f.lastX, f.y - f.lastY);
    f.side = moved < FOE_AI.STUCK_D ? (f.side || (Math.random() < 0.5 ? -1 : 1)) : 0;
    f.stuckT = 0; f.lastX = f.x; f.lastY = f.y;
  }
}

function updateFoes(dt){
  foeWarm();
  turretWarm();
  // The city's geometry only exists in the city; everywhere else (the straight
  // legs, the labs) a walking sentry just walks.
  const walled = typeof street !== 'undefined' && street;
  foeMadN = 0;
  for(const f of foes){
    if(f.dead) continue;
    if(f.hurtFlash > 0) f.hurtFlash = Math.max(0, f.hurtFlash - dt);
    // the one-ram-at-a-time timer (turretRam). NOT `ramT`: cars already have a
    // `c.ramT` (the rear-ender coast, RAM_COAST), and a turret is handed a car in
    // turretRam - one typo apart. This is the `f.side` collision he reported on
    // 2026-11-23, avoided by name instead of discovered in play.
    // Here and not in turretThink
    // because it is about the BUMPER, not about the brain: a turret that cannot
    // see you, or is still rising, still has to count down the ram it just took.
    if(f.ramLock > 0) f.ramLock = Math.max(0, f.ramLock - dt);
    // A MOVER ON DUTY IS NOT SIMULATED. Its position is read out of the clock:
    // one evaluation, no integration, no collision, no separation, no stuck
    // check. This is the whole reason the movers are cheap - see FOE_WALK.
    if(f.route && !f.mad){
      if(f.rejoin){ walkRejoin(f, dt); continue; }
      const p = walkAt(f.route, matchTime);
      f.x = p.x; f.y = p.y; f.a = p.a; f.phase = p.phase; f.walk = p.walk;
      continue;
    }
    foeThink(f, dt);
    if(f.mad) foeMadN++;
    if(!f.walk) continue;
    const x0 = f.x, y0 = f.y;
    const d = (f.mad ? FOE_AI.CHASE_SPD : FOE_RIG.WALK_SPD)*dt;
    f.x += Math.cos(f.a)*d;
    f.y += Math.sin(f.a)*d;
    if(walled) foeCollide(f);
    // the phase runs on the distance it ACTUALLY covered, not the distance it
    // meant to: a sentry pressed against a wall should not paddle its feet.
    f.phase = ((f.phase || 0) + Math.hypot(f.x - x0, f.y - y0)/FOE_RIG.STRIDE) % 1;
  }
  foeSeparate();
  foeStuck(dt);
}

// ------------------------------------------------------- how many, and where
// Scattered over the whole city, by DENSITY PER BLOCK rather than at a flat
// rate: every BSP lot draws its own count from a normal distribution, so some
// blocks are busy and most are empty. Knobs: FOE_POP in config.js 3e.
//
// A sentry belongs to the city chunk it was placed in and lives as long as that
// chunk is near you. Walk away past FOE_POP.DROP and it is forgotten; come back
// and it is generated again in exactly the same spot, because the draw is seeded
// from (chunk, side) alone - the same contract the city itself has, where nothing
// is saved and the same stretch of road is always the same streets.
//
// The one thing that IS remembered is which ones you WRECKED. Without it a
// sentry you killed would be standing there again on the way back, which reads
// as the kill not having counted.
// A chunk's PLAN: every sentry it would hold, drawn once and kept. Deterministic
// from (chunk, side) alone - the same plan every time the same stretch of city
// is asked for, which is the contract the city itself has.
//
// Drawing and MATERIALISING are separate on purpose. The draw is per block over
// the whole city, which is the rule. What actually gets a body is decided by
// DISTANCE from you: a chunk is 1400 long but the full 4000-unit width of the
// city, so seeding a whole chunk spends most of its sentries three or four
// thousand units out to the side, in blocks you will never walk down. The first
// cut did exactly that and put 20 of 26 sentries where nobody could ever meet
// them - 1 inside 600 units, 5 inside the 1500-unit billboard cull.
const foePlans = new Map();       // chunk key -> [{key, x, y, a}]
const foeLive = new Set();        // sentry keys that have a body right now
const foeKilled = new Set();      // ...and the ones wrecked this run
function clearFoeWorld(){ foeLive.clear(); foeKilled.clear(); foePlans.clear();
  if(typeof clearWalkWorld === 'function') clearWalkWorld(); }

// Somewhere to stand on a block: its PAVEMENT, the band between the lot's edge
// and the building's footprint. Picked ON an edge by construction rather than by
// rejection-sampling the box - the band is about a sixth of a block's area, so
// rejection would miss more often than it hit.
// `placed` is what this block has already put down: a spot too close to one of
// them is rejected and re-rolled. Without it two sentries stand INSIDE each
// other - they are 12 units wide and nothing else keeps them apart, since
// foeSeparate only pushes apart the ones that are chasing you. It bites at any
// density (at MEAN 2.5 the closest pair was 4 units) and is grotesque at high
// ones (at MEAN 25, 0 units - straight through each other).
//
// It is also what makes the density knob SELF-LIMITING: when a block has no room
// left, foeSpot runs out of tries and returns null, and that sentry is simply
// not placed. Wind MEAN up far enough and the city fills to what it can hold
// rather than stacking bodies in one spot.
function foeSpot(b, rng, placed){
  const inset = CITY_STYLE.PAVE*0.5;
  // WHICH EDGE is the whole game here. A block has four, and only one of them
  // faces the highway - so picking uniformly put three sentries in four down
  // interior side streets, where nothing the player ever does brings him past
  // them. That is what made the first cut read as "there are no enemies in the
  // city": there were seventeen, scattered exactly as asked, at 500-1400 units
  // down streets nobody walks, three to ten pixels tall. Density was no help -
  // MEAN 0.22 and MEAN 0.8 both left ONE sentry within 600 units - because the
  // highway is a 360-wide corridor with no blocks in it and only one or two
  // blocks within 600 units of it at all.
  //
  // So FOE_POP.ROADSIDE of them stand on the FRONTAGE: the edge nearest the
  // road, which for a block beside the highway is the barrier you drive past.
  // The rest keep to the back streets, which is what stops it reading as a
  // guard of honour lining the route.
  const inner = Math.abs(b.x0) < Math.abs(b.x1) ? 0 : 1;
  for(let t = 0; t < FOE_POP.TRIES; t++){
    const e = rng.chance(FOE_POP.ROADSIDE) ? inner : (rng.next()*4)|0;
    const u = rng.next();
    let x, y;
    if(e === 0)      { x = b.x0 + inset;               y = b.y0 + u*(b.y1 - b.y0); }
    else if(e === 1) { x = b.x1 - inset;               y = b.y0 + u*(b.y1 - b.y0); }
    else if(e === 2) { y = b.y0 + inset;               x = b.x0 + u*(b.x1 - b.x0); }
    else             { y = b.y1 - inset;               x = b.x0 + u*(b.x1 - b.x0); }
    // pavement only (cityGround 2). On a small block a corner inset lands inside
    // the footprint, and a lot's inner edge can fall on the highway barrier.
    if(cityGround(x, y) !== 2) continue;
    if(placed){
      let clash = false;
      for(const q of placed){
        const dx = q.x - x, dy = q.y - y;
        if(dx*dx + dy*dy < FOE_POP.GAP*FOE_POP.GAP){ clash = true; break; }
      }
      if(clash) continue;
    }
    return { x, y };
  }
  return null;
}
function foeChunkPlan(k, side){
  const key = k + ':' + (side > 0 ? 1 : -1);
  let plan = foePlans.get(key);
  if(plan) return plan;
  const ch = cityChunk(k, side);
  const rng = cityRng(hash3(k, side > 0 ? 1 : 2, FOE_POP.SEED)*4294967296);
  plan = [];
  // QUEST 1: the bunker's chunk is held by GUARDS instead, spaced round the
  // bunker's own pavement, all facing out
  if(ch.bunker && typeof QUEST !== 'undefined'){
    const d = ch.bunker, P = CITY_STYLE.PAVE*0.5, n = QUEST.GUARDS;
    const w = d.x1 - d.x0, h = d.y1 - d.y0, per = 2*(w + h);
    for(let i = 0; i < n; i++){
      let s = (i + 0.5)/n*per, x, y;
      if(s < w){ x = d.x0 + s; y = d.y0 - P; }
      else if((s -= w) < h){ x = d.x1 + P; y = d.y0 + s; }
      else if((s -= h) < w){ x = d.x1 - s; y = d.y1 + P; }
      else { s -= w; x = d.x0 - P; y = d.y1 - s; }
      plan.push({ key: key + ':g' + i, x, y, a:Math.atan2(y - d.y, x - d.x), ck:key, guard:true });
    }
    foePlans.set(key, plan);
    return plan;
  }
  // QUEST 2: THE PICKET ON THE SQUARE. Five guards in formation in front of the
  // main doors, facing out across the plaza - a line of three on the doors and
  // two standing further out. Unlike the bunker's ring this does NOT replace the
  // chunk's own sentries: the datacenter's lot is one lot of several and the rest
  // of the block should still be populated, so it falls through to the blocks.
  //
  // Facing OUT (a = the outward normal) is the whole read: five backs to a door
  // is scenery, five faces watching the square is a reason to walk round the back.
  if(ch.data && typeof QUEST !== 'undefined' && QUEST.DATA_GUARDS > 0){
    const D = ch.data, ox = D.main.nx, cy = D.main.y;         // ox = -side: out across the plaza
    const a = Math.atan2(0, ox);
    const S = QUEST.DATA_GUARD_S;
    // [depth, lateral] - the three abreast, then the two out front
    const F = [ [QUEST.DATA_GUARD_D1, -S], [QUEST.DATA_GUARD_D1, 0], [QUEST.DATA_GUARD_D1, S],
                [QUEST.DATA_GUARD_D2, -S*1.5], [QUEST.DATA_GUARD_D2, S*1.5] ];
    for(let i = 0; i < Math.min(QUEST.DATA_GUARDS, F.length); i++){
      const [d, t] = F[i];
      plan.push({ key: key + ':dg' + i, x:D.main.x + ox*d, y:cy + t, a, ck:key, guard:true });
    }
    // ...and the two emplacements flanking the doors, inboard of the picket and
    // wider than it. Same outward facing: the whole front of this building is
    // pointed at the square. Alternating sides, so any count is symmetric.
    const KN = QUEST.DATA_TURRET_KINDS || [1];
    for(let i = 0; i < (QUEST.DATA_TURRETS || 0); i++){
      const lat = (i % 2 ? 1 : -1)*QUEST.DATA_TURRET_S*(1 + Math.floor(i/2)*0.6);
      plan.push({ key: key + ':dt' + i, x:D.main.x + ox*QUEST.DATA_TURRET_D, y:cy + lat,
                  a, ck:key, turret: KN[i % KN.length] });
    }
  }
  ch.blocks.forEach((b, bi) => {
    // Box-Muller: two uniforms make one normal. Rounded and clamped at nought,
    // and that clamp is what empties most blocks - the curve's whole left half
    // lands on none - while the right tail is what makes a few of them busy.
    const u1 = Math.max(1e-9, rng.next()), u2 = rng.next();
    const g = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
    const n = Math.min(FOE_POP.MAX, Math.max(0, Math.round(FOE_POP.MEAN + g*FOE_POP.SD)));
    const placed = [];
    for(let i = 0; i < n; i++){
      const p = foeSpot(b, rng, placed), a = rng.range(0, Math.PI*2);  // drawn either
      if(!p) continue;                       // way, so one bad spot cannot shift the rest
      placed.push(p);
      plan.push({ key: key + ':' + bi + ':' + i, x:p.x, y:p.y, a, ck:key });
    }
  });
  foePlans.set(key, plan);
  return plan;
}
// Keep the sentries around you: give a body to every planned one inside KEEP,
// take it away again past DROP. At most one NEW chunk is planned per frame -
// planning one walks its blocks and samples the pavement, and may have to
// generate the city chunk itself.
function citySentries(){
  if(!enemiesOn) return;
  const T = cityTarget();
  for(let i = foes.length - 1; i >= 0; i--){
    const f = foes[i];
    // dropped by hand (Z) has no key and is not ours; a MOVER has a key but
    // belongs to cityWalkers, and culling it here would strand its key in
    // walkLive forever - the same trap as clearFoes vs foeLive.
    if(!f.key || f.route) continue;
    if(Math.hypot(f.x - T.x, f.y - T.y) > FOE_POP.DROP){ foeLive.delete(f.key); foes.splice(i, 1); }
  }
  const k0 = Math.floor((T.y - FOE_POP.KEEP)/CITY_CH);
  const k1 = Math.min(Math.floor((T.y + FOE_POP.KEEP)/CITY_CH), Math.floor(cityLimitY/CITY_CH) - 1);
  let planned = 0;
  for(let k = k0; k <= k1; k++) for(const side of [-1, 1]){
    if(!foePlans.has(k + ':' + side)){
      if(planned) continue;                           // one new plan a frame, no more
      planned++;
    }
    for(const p of foeChunkPlan(k, side)){
      if(foeLive.has(p.key) || foeKilled.has(p.key)) continue;
      if(Math.hypot(p.x - T.x, p.y - T.y) > FOE_POP.KEEP) continue;
      const f = p.turret ? spawnTurret(p.x, p.y, p.a, p.turret) : spawnFoe(p.x, p.y, p.a);
      f.key = p.key; f.ck = p.ck;
      if(p.turret){
        // spawnFoe PUSHES; spawnTurret only builds. That asymmetry is deliberate -
        // a datacenter turret is born into its floor's F.turrets and dcEnter puts
        // it in the world later, when you walk in - so out here it has to be put
        // in the world by hand. Without this the key went into foeLive and the
        // turret went nowhere: the square stayed empty and nothing complained.
        foes.push(f);
        // no lid out here: it is already up. And it is NOT a datacenter body, so
        // it must not read the maze's walls for line of sight - see turretThink.
        f.hidden = false; f.rise = 1; f.dc = false;
      }
      if(p.guard){ f.guard = true; f.hitT = 0; }
      foeLive.add(p.key);
    }
  }
  // forget the plans for city you are nowhere near, exactly as cityCache does
  if(foePlans.size > 32){
    const kn = Math.floor(T.y/CITY_CH);
    for(const key of foePlans.keys()) if(Math.abs(parseInt(key, 10) - kn) > 6) foePlans.delete(key);
  }
}
// the N key, with the cars: forget every sentry the city put there, and let
// citySentries lay them out again from scratch when it comes back on.
function cityFoesOff(){
  for(let i = foes.length - 1; i >= 0; i--) if(foes[i].key && !foes[i].route) foes.splice(i, 1);
  foeLive.clear();
}

// ======================================================================= MOVERS
// A SEPARATE population from the standing sentries (FOE_WALK, config.js 3f).
// Nothing below reads FOE_POP, and FOE_WALK.ON = false removes the lot without
// touching the standing city.
//
// The whole trick: a mover on duty is never integrated. Its position is read
// straight out of the clock, so one that is off screen is not stepped, not
// collided and not drawn - it is a plan entry costing nothing until it comes
// into range. See the comment on FOE_WALK for why that also kills drift and
// the teleport-on-return problem.

const walkPlans = new Map();      // chunk key -> [route, ...]
const walkLive  = new Set();      // route keys that have a body right now
function clearWalkWorld(){ walkLive.clear(); walkPlans.clear(); }

// The pavement RING of a block: the rectangle the movers walk round, inset from
// the lot edge by FOE_WALK.LANE of the pavement width. The standers sit at 0.5
// of it (foeSpot's inset), so a different LANE keeps the two mostly apart.
function walkRing(b){
  const inset = CITY_STYLE.PAVE*FOE_WALK.LANE;
  const x0 = b.x0 + inset, x1 = b.x1 - inset;
  const y0 = b.y0 + inset, y1 = b.y1 - inset;
  const w = x1 - x0, h = y1 - y0;
  if(w <= 0 || h <= 0) return null;               // block too small to walk round
  return { x0, y0, x1, y1, w, h, per: 2*(w + h) };
}

// Distance s along the ring -> a point on it, and the heading of travel there.
// Clockwise from the top-left corner. `dir` is +1 walking with s, -1 against it,
// 0 standing - so the heading is the tangent, flipped when walking back.
function ringPoint(r, s, dir){
  const per = r.per;
  s = ((s % per) + per) % per;
  let x, y, a;
  if(s < r.w)              { x = r.x0 + s;                 y = r.y0; a = 0; }
  else if(s < r.w + r.h)   { x = r.x1;                     y = r.y0 + (s - r.w); a = Math.PI/2; }
  else if(s < 2*r.w + r.h) { x = r.x1 - (s - r.w - r.h);   y = r.y1; a = Math.PI; }
  else                     { x = r.x0;                     y = r.y1 - (s - 2*r.w - r.h); a = -Math.PI/2; }
  if(dir < 0) a += Math.PI;
  return { x, y, a };
}

// Where a route's mover is at time t. Forward leg, pause, back leg, pause.
// Pure: same route and same t always give the same answer, on any machine, with
// or without anybody watching.
function walkAt(rt, t){
  // A LAP: distance just accumulates and wraps. No ends, so no pause and no
  // turning round - and it is the longest route in the game, a whole block.
  if(rt.loop){
    const s = rt.s0 + rt.spd*(t + rt.t0)*Math.sign(rt.span || 1);
    const p = ringPoint(rt.ring, s, Math.sign(rt.span || 1));
    p.phase = ((rt.spd*(t + rt.t0))/FOE_RIG.STRIDE) % 1;
    p.walk = true;
    return p;
  }
  const legT = rt.arc/rt.spd, pauseT = rt.pause;
  const period = 2*(legT + pauseT);
  let u = ((t + rt.t0) % period + period) % period;
  let f, dir;                                      // f = 0..1 along the arc
  if(u < legT)                       { f = u/legT;                      dir =  1; }
  else if(u < legT + pauseT)         { f = 1;                           dir =  0; }
  else if(u < 2*legT + pauseT)       { f = 1 - (u - legT - pauseT)/legT; dir = -1; }
  else                               { f = 0;                           dir =  0; }
  const s = rt.s0 + rt.span*f;
  const p = ringPoint(rt.ring, s, dir || rt.lastDir || 1);
  // The rig's phase has to run on distance WALKED, not on f, or the feet skate
  // at one end of the arc and sprint at the other. Total distance walked is the
  // whole cycles plus how far into this one, and a cycle is two lengths of arc.
  const cyc = Math.floor((t + rt.t0)/period);
  const inCyc = rt.arc*(dir < 0 || u >= legT + pauseT ? 2 - f : f);
  p.phase = ((cyc*2*rt.arc + inCyc)/FOE_RIG.STRIDE) % 1;
  p.walk = dir !== 0;
  return p;
}

// One chunk's movers, drawn deterministically and cached - the same shape as
// foeChunkPlan, with its own seed so the two populations are independent.
function walkChunkPlan(k, side){
  const key = k + ':' + (side > 0 ? 1 : -1);
  let plan = walkPlans.get(key);
  if(plan) return plan;
  const ch = cityChunk(k, side);
  const rng = cityRng(hash3(k, side > 0 ? 3 : 4, FOE_WALK.SEED)*4294967296);
  // the reasons, as a normalised cumulative table (weights need not sum to 1)
  const tot = FOE_WALK.REASONS.reduce((a, r) => a + r.w, 0) || 1;
  plan = [];
  ch.blocks.forEach((b, bi) => {
    const ring = walkRing(b);
    const u1 = Math.max(1e-9, rng.next()), u2 = rng.next();
    const g = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
    const n = Math.min(FOE_WALK.MAX, Math.max(0, Math.round(FOE_WALK.MEAN + g*FOE_WALK.SD)));
    for(let i = 0; i < n; i++){
      // draw every number whatever happens, so one rejected route cannot shift
      // the ones after it (the same discipline foeChunkPlan keeps)
      const pick = rng.next()*tot, s0 = rng.next(), span = rng.next(), bk = rng.next();
      if(!ring) continue;
      let acc = 0, reason = FOE_WALK.REASONS[0];
      for(const r of FOE_WALK.REASONS){ acc += r.w; if(pick <= acc){ reason = r; break; } }
      // A looping mover's "arc" is the whole ring: one lap, and it never turns.
      const arc = reason.loop ? ring.per
                : Math.min(FOE_WALK.ARC0 + span*(FOE_WALK.ARC1 - FOE_WALK.ARC0), ring.per*FOE_WALK.ARC_MAXF);
      const start = s0*ring.per;
      const signed = (bk < 0.5 ? -arc : arc);      // walk either way round
      const rt = { key: 'w' + key + ':' + bi + ':' + i, ck: key, ring,
                   s0: start, span: signed, arc, loop: !!reason.loop,
                   spd: FOE_WALK.SPD*reason.spd, pause: FOE_WALK.PAUSE*reason.pause,
                   t0: bk*997, reason: reason.name };
      // SHRINK TO FIT rather than reject. A ring has four corners and on an odd
      // lot one of them lands inside the footprint or on the barrier; the longer
      // the arc, the likelier it samples a bad one. Throwing the route away
      // throws away the MOVER, and lengthening the routes cost 23% of them that
      // way (132 -> 102). So walk the route in from its far end until it fits,
      // and only give up if even the shortest allowed arc is blocked.
      if(!walkFit(rt)) continue;
      plan.push(rt);
    }
  });
  walkPlans.set(key, plan);
  return plan;
}

// Trim a route until it is walkable, in place. A LAP cannot be trimmed - it is
// the whole ring by definition - so a block whose ring is not fully walkable
// gives its lapper a ping-pong arc instead of losing it.
function walkFit(rt){
  if(rt.loop){
    if(walkRouteOk(rt)) return true;
    rt.loop = false;                               // cannot lap this block
    rt.arc = Math.min(rt.arc, rt.ring.per*FOE_WALK.ARC_MAXF);
    rt.span = (rt.span < 0 ? -1 : 1)*rt.arc;
  }
  const base = rt.arc, sign = rt.span < 0 ? -1 : 1;   // fractions are OF THE
  for(const k of FOE_WALK.SHRINK){                   // ORIGINAL, not compounding
    const arc = base*k;
    if(arc < FOE_WALK.ARC_MIN) break;
    rt.arc = arc;
    rt.span = sign*arc;
    if(walkRouteOk(rt)) return true;
  }
  return false;
}

// Every FOE_WALK.SAMPLE units of the arc has to be pavement. This is the only
// validation a route gets, and it is done ONCE at plan time rather than per
// frame - which is what lets the mover skip collision entirely afterwards.
function walkRouteOk(rt){
  const n = Math.max(2, Math.ceil(rt.arc/FOE_WALK.SAMPLE));
  // a lap is sampled right round the ring, not along a span
  const span = rt.loop ? rt.ring.per : rt.span;
  for(let i = 0; i <= n; i++){
    const p = ringPoint(rt.ring, rt.s0 + span*(i/n), 1);
    if(cityGround(p.x, p.y) !== 2) return false;
  }
  return true;
}

// Give bodies to the routes near you and take them off the ones you left, the
// same way citySentries does - and for the same reason: a chunk is 1400 long but
// the city's whole width, so a chunk band would spend movers thousands of units
// out to the side where nobody will ever see them walk.
function cityWalkers(){
  if(!enemiesOn || !FOE_WALK.ON) return;
  const T = cityTarget();
  for(let i = foes.length - 1; i >= 0; i--){
    const f = foes[i];
    if(!f.route) continue;
    if(Math.hypot(f.x - T.x, f.y - T.y) > FOE_WALK.DROP){ walkLive.delete(f.route.key); foes.splice(i, 1); }
  }
  const k0 = Math.floor((T.y - FOE_WALK.KEEP)/CITY_CH);
  const k1 = Math.min(Math.floor((T.y + FOE_WALK.KEEP)/CITY_CH), Math.floor(cityLimitY/CITY_CH) - 1);
  let planned = 0;
  for(let k = k0; k <= k1; k++) for(const side of [-1, 1]){
    if(!walkPlans.has(k + ':' + (side > 0 ? 1 : -1))){
      if(planned) continue;                        // one new plan a frame, no more
      planned++;
    }
    for(const rt of walkChunkPlan(k, side)){
      if(walkLive.has(rt.key) || foeKilled.has(rt.key)) continue;
      const p = walkAt(rt, matchTime);             // where it should be RIGHT NOW
      if(Math.hypot(p.x - T.x, p.y - T.y) > FOE_WALK.KEEP) continue;
      const f = spawnFoe(p.x, p.y, p.a);
      f.key = rt.key; f.ck = rt.ck; f.route = rt; f.reason = rt.reason;
      f.phase = p.phase; f.walk = p.walk;
      walkLive.add(rt.key);
    }
  }
  if(walkPlans.size > 32){
    const kn = Math.floor(T.y/CITY_CH);
    for(const key of walkPlans.keys()) if(Math.abs(parseInt(key, 10) - kn) > 6) walkPlans.delete(key);
  }
}

// A mover that has been shot leaves its schedule to chase (the normal FOE_AI
// path). When it gives up, it walks back to wherever the schedule has got to and
// picks up where it should be - so the route survives being interrupted.
function walkRejoin(f, dt){
  const p = walkAt(f.route, matchTime);
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
  // It hurries back at CHASE_SPD, not at its working pace: the point it is
  // walking to is ITSELF MOVING, so anything slower than the fastest mover
  // never arrives. Measured: at working pace it sat 140 units adrift after ten
  // seconds and stayed there. REJOIN_T is the backstop either way.
  const spd = Math.max(FOE_AI.CHASE_SPD, FOE_WALK.SPD*2);
  f.rejoinT = (f.rejoinT || 0) + dt;
  if(d < spd*dt + 2 || f.rejoinT > FOE_WALK.REJOIN_T){
    f.x = p.x; f.y = p.y; f.a = p.a; f.rejoin = false; f.rejoinT = 0; return;
  }
  const want = Math.atan2(dy, dx);
  f.a += clamp(angDiff(f.a, want), -FOE_AI.TURN*dt, FOE_AI.TURN*dt);
  const step = spd*dt;
  f.x += Math.cos(f.a)*step; f.y += Math.sin(f.a)*step;
  if(typeof street !== 'undefined' && street) foeCollide(f);
  f.walk = true;
  f.phase = ((f.phase || 0) + step/FOE_RIG.STRIDE) % 1;
}

// the N key: forget the movers too
function cityWalkersOff(){
  for(let i = foes.length - 1; i >= 0; i--) if(foes[i].route) foes.splice(i, 1);
  walkLive.clear();
}

// ---------------------------------------------------------------- the billboard
// Called from rcSprites with the numbers it has already worked out: sx is the
// screen column the sentry stands on, `ground` the ground line at its distance.
// One sprite, no turning frames, so it faces the camera from every angle - which
// is why the prompt asked for a straight-on symmetrical pose.
function drawFoeBillboard(f, sx, ground, scale, perp, camX, camY){
  if(f.turret){ drawTurretBillboard(f, sx, ground, scale, perp, camX, camY); return; }
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
      foeCellEnsure(sp, pose, fr);
      const row = foeRow(sp, pose, false);
      // sp.fw/ax/ay are in SHEET pixels, and the sheet is baked at sp.vsc pixels
      // per world unit - so the sheet's own scale divides straight back out and
      // the sentry lands exactly where and how big it did at vsc 1.
      const k = scale/sp.vsc;
      const dx = sx - sp.ax*k, dy = ground - sp.ay*k;
      const w = sp.fw*k, h = sp.fh*k;
      rcCtx.globalAlpha = 1 - fog0*0.55;
      // unlike a car, this recolours in BOTH panes: a car has a white flash row
      // baked and a sentry has none, so there is nothing else to show here.
      if(f.hurtFlash > 0) rcCtx.drawImage(hitFrame(sp, fr, row, asciiMode ? 0 : FOE_HIT_LIFT),
                                          0, 0, sp.fw, sp.fh, dx, dy, w, h);
      else                rcCtx.drawImage(sp.cv, fr*sp.fw, row, sp.fw, sp.fh, dx, dy, w, h);
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

// =============================================================== THE TURRETS
// The datacenter's emplacements (config.js 3c-ii). A turret is a FOE RECORD with
// `turret` set to 1 or 2, which is what lets it reuse - unchanged - the bolt and
// blast collision in updateShots, the splash in explode, foeDamage and the hit
// flash, the pistol's second pass in fpsgun.js, the billboard list, and the
// floor's ownership of its own bodies across the stairs. What it does NOT reuse
// is anything about walking: foeThink hands it to turretThink on the first line
// and foeSeparate skips it outright.
//
// It is also the first enemy in the game that EXISTS BEFORE IT CAN BE SEEN. The
// hatches are placed when the floor is generated and the turrets with them, shut
// and `hidden`, so that the lid you walk over on the way down is the same object
// that comes up out of the floor behind you on the way back. See dcTurrets and
// dcRelease in index.html.

// ---- the models. Keyed like the sentry's, by VOXTURRETS name, so two carves of
// the same turret can sit side by side and the recipe can be re-cut without
// touching the game.
const turretMeshIdx = Object.create(null);
function turretVoxName(kind){
  if(typeof VOXTURRETS === 'undefined' || !VOXTURRETS) return null;
  const want = TURRET.KINDS[kind] && TURRET.KINDS[kind].vox;
  if(want && VOXTURRETS[want]) return want;
  // a missing carve falls back to whatever IS loaded rather than drawing nothing:
  // the viewer and the game read the same files and the game must not go blind
  // because a recipe was re-cut at another resolution.
  return Object.keys(VOXTURRETS)[0] || null;
}
function turretMesh(kind){
  const k = turretVoxName(kind);
  if(!k) return -1;
  if(k in turretMeshIdx) return turretMeshIdx[k];
  return (turretMeshIdx[k] = MODELS.push(voxMesh(VOXTURRETS[k])) - 1);
}

// ---- the sheet. TURRET.YAWS yaws, ONE row, no rig. The sentry's sheet is
// 16 yaws x 6 poses = 96 frames because it walks; a turret is 32 x 1 = 32, and
// it gets the finer yaw step precisely BECAUSE it has nothing else to spend it
// on - a traversing mount that pops between headings is the one artefact this
// model can show. Baked once per KIND, not per turret, so eleven of them on a
// floor cost one bake between them.
//
// BAKED ONE YAW AT A TIME, and this is not an optimisation. "It is all
// prerendered, so the face count is free" is only true of the DRAWING: the bake
// itself is real work, and baking turret-02's 32 yaws in one go measures at
// ~400 ms - a quarter-second freeze, triggered the first frame a missile rack
// comes into view, which is a floor that has just opened eleven hatches. The
// sentry had exactly the same disease, and the cure is now shared: foeCellEnsure
// fills ONE cell, and a turret's sheet is one pose, so for it a cell is a yaw.
// dcRelease starts the sheets and the 1.2 s rise is the cover to fill them under.
const turretSheets = Object.create(null);
function bakeTurretSheet(kind){
  const k = turretVoxName(kind);
  if(!k) return null;
  if(turretSheets[k] && turretSheets[k].vsc === FOE_VSC) return turretSheets[k];
  const mi = turretMesh(kind);
  if(mi < 0) return null;
  const K = TURRET.KINDS[kind];
  // the sentry's lift, for the sentry's reason: rasterCar's LIGHT has a negative
  // y, so the faces a standing thing shows the camera get no diffuse at all.
  const sp = foeSheetNew(MODELS[mi], K.col, KY_FPS, KZ_FPS, FOE_VSC, FOE_LIFT,
                         { n:TURRET.YAWS, poses:1, rig:false });
  // Nothing is baked yet, and the ledger is the shared `sp.cell`: one pose, so
  // one row of TURRET.YAWS cells. The sentry's filler cannot reach this sheet
  // because it only ever looks sheets up by foeVoxName().
  return (turretSheets[k] = sp);
}
function clearTurretSheets(){ for(const k in turretSheets) delete turretSheets[k]; }

// the background filler, run from updateFoes beside foeWarm. A few yaws a frame
// and ONE sheet a frame, so a floor with both kinds on it fills in order rather
// than paying for both at once. One cell is ~3 ms for turret-01 and ~13 ms for
// turret-02: a long frame either way, and not a freeze.
function turretWarm(){
  // BOTH registries: the first-person sheets and the driving pane's. A 2D sheet
  // only exists once something has actually drawn a turret from above - which
  // means the emplacements on the square are in view - so warming it is never
  // speculative, and leaving it cold would put its cells on the frames you drive
  // past the building, which is the one place they are all needed at once.
  for(const reg of [turretSheets, turretSheets2D])
    for(const k in reg){
      const sp = reg[k];
      if(!sp.left) continue;
      let budget = TURRET.WARM;
      for(let fr = 0; fr < sp.n && budget > 0; fr++)
        if(!sp.cell[fr]){ foeCellEnsure(sp, 0, fr); budget--; }
      if(budget < TURRET.WARM) return;          // one sheet a frame, no more
    }
}

// ---- making one. `hidden` is the shut hatch: it is a complete turret in every
// other respect, it is simply not in the world's foe list yet.
function spawnTurret(x, y, a, kind){
  const K = TURRET.KINDS[kind] || TURRET.KINDS[1];
  return { x, y, a:a || 0, hp:K.hp, dead:false, hurtFlash:0, vox:null,
    turret:kind, hidden:true, rise:0, sawT:0, ramLock:0,
    // the per-body overrides the shared sentry numbers are read through
    r:K.r, h:K.h, hitR:K.hitR, shotR:K.shotR,
    mad:false, loseT:0, walk:false, phase:0,
    dc:true, ck:null, key:null,
    stuckT:0, lastX:x, lastY:y, side:0,
    // WHICH ARM the next missile leaves, latched when the windup opens.
    // NOT `side`, which is what it used to be, and that was a real bug he
    // reported from play (2026-11-23): `side` already means "lean off to one
    // side, you are wedged on a corner" for a sentry (-1/0/+1, foeThink +
    // foeStuck), and foeStuck ran over every foe. A calm turret had `side`
    // zeroed every frame, so it always fired the same arm; an angry one picked
    // up a random +/-1 that stuck, so it locked onto the other; and when that
    // landed mid-windup the smoke poured from one arm and the missile left the
    // other. One field, two meanings, two owners. Turret 1 ignores it: one barrel.
    arm:0 };
}

// ---- the brain, such as it is. Rise, then: track you while it can see you,
// and fire. There is no state beyond that and there is not meant to be.
function turretThink(f, dt){
  f.walk = false;                                  // never, under any circumstances
  if(f.rise < 1){
    f.rise = Math.min(1, f.rise + dt/TURRET.RISE);
    // coming up is not a free action. The rest timer is held at full until it is
    // clear of the floor, so the thing cannot shoot you out of its own hole -
    // the rise IS the warning that it is there.
    f.gunT = TURRET.KINDS[f.turret].rest[0];
    return;
  }
  const T = cityTarget();
  const dist = Math.hypot(T.x - f.x, T.y - f.y);
  // WHETHER IT CAN SEE YOU, and which walls decide that. Both branches are the
  // sentry's own (foeGun), because a turret is a foe record and should not
  // invent a second convention:
  //   * in the datacenter the walls are the MAZE's partitions (dcClear), gated
  //     on f.dc - the street is not a floor plan and must not be tested as one.
  //   * out on the square they are the city's FOOTPRINTS (cityClear). Without
  //     this an emplacement at the main doors could traverse the whole way round
  //     and shoot through the building at someone at the SERVICE door, which is
  //     the way in he actually uses - 181 units away, well inside its 540 reach.
  const M = (f.dc && typeof dcq !== 'undefined' && dcq && dcq.inside) ? dcq.inside.M : null;
  const inCity = typeof street !== 'undefined' && street;
  const see = M ? dcClear(M, f.x, f.y, T.x, T.y)
            : (inCity && typeof cityClear === 'function') ? cityClear(f.x, f.y, T.x, T.y)
            : true;
  // TRACK_LOST seconds of follow-through past losing sight of you. Without it a
  // turret freezes mid-swing the instant you cross a doorframe, which reads as a
  // bug; with it the mount keeps turning for a moment and then gives up, which
  // reads as a mount. It does NOT let it track you blind - the timer only ever
  // runs down, and it cannot fire without `see` anyway.
  f.sawT = see ? TURRET.TRACK_LOST : Math.max(0, (f.sawT || 0) - dt);
  if(f.sawT > 0){
    const want = Math.atan2(T.y - f.y, T.x - f.x);
    f.a += clamp(angDiff(f.a, want), -TURRET.TURN*dt, TURRET.TURN*dt);
  }
  turretGun(f, dt, T, dist, see);
}

// ---- the guns. FOE_GUN's shape - rest, then windup with a visible tell, then
// one shot at where you are NOW - with the numbers and the projectile taken from
// TURRET.KINDS. No lead on either: a shot you can see coming is one you can get
// a wall between yourself and, and that is the only defence either of these has.
function turretGun(f, dt, T, dist, see){
  if(typeof shots === 'undefined') return;
  const K = TURRET.KINDS[f.turret], W = K.shot;
  if(f.gunT === undefined) f.gunT = K.rest[0]*Math.random();   // they don't all open up at once
  // WHERE IT LEAVES THE MODEL. K.muzzle is a point on the carve, measured off it
  // by role (config.js), not a guess: `fwd` along the barrel, `side` out to one
  // arm, `z` the height. It used to be a flat 8 units forward at a hand-picked
  // height, and on turret-01 the barrel tip is at 22.5 - so the bolt was born
  // ~14 units BEHIND the muzzle, which is further from the player than the
  // muzzle is. A point below eye level (WALK_EYE 16, muzzle 12.2) climbs toward
  // the horizon as it gets further away, so it read as leaving ABOVE the barrel.
  // That is what the user saw, and the fix is the real point, not a lower z.
  const M = K.muzzle;
  // `M.side` is a MAGNITUDE: f.arm picks which one, and +y of the model is the
  // world's (-sin a, cos a). Which arm is which does not matter - they are
  // mirror images - only that consecutive shots come off OPPOSITE ones, and that
  // the TELL and the SHOT agree. Those are computed on different frames, up to
  // K.windup (1.2 s) apart, which is why f.arm is latched when the windup opens
  // and nothing else is allowed to write it.
  const off = M.side ? (f.arm ? M.side : -M.side) : 0;
  // hoisted: f.a cannot change inside one of these, and the tell calls mx()/my()
  // 25 times a second per firing turret. Two trig calls a frame, not eight.
  const ca = Math.cos(f.a), sa = Math.sin(f.a);
  const mx = () => f.x + ca*M.fwd - sa*off;
  const my = () => f.y + sa*M.fwd + ca*off;
  if(f.charge > 0){
    f.charge -= dt;
    f.glowT = (f.glowT || 0) - dt;
    if(f.glowT <= 0 && typeof particles === 'function'){
      f.glowT = 0.04;
      const k = 1 - f.charge/K.windup;
      // the missile rack smokes where the energy gun sparks: same tell, and you
      // can tell WHICH of the two has you from across a corridor by the colour.
      if(W.kind === 'missile')
        particles(mx(), my(), M.z, 1 + (k*2|0), { col:['#8a7c84', '#5a4e58', W.col], spd0:3, spd1:10 + 14*k,
          size:2 + k, life0:0.2, life1:0.5, grav:-10, up0:0, up1:8 });
      else
        particles(mx(), my(), M.z, 1 + (k*2|0), { col:[W.col, W.glow], spd0:4, spd1:14 + 26*k,
          size:1 + k, life0:0.05, life1:0.12, grav:0, up0:-4, up1:4 });
    }
    if(f.charge <= 0){
      f.charge = 0;
      f.gunT = K.rest[0] + Math.random()*(K.rest[1] - K.rest[0]);
      const a = Math.atan2(T.y - my(), T.x - mx());
      const s = { kind:W.kind, foe:true, turret:true, x:mx(), y:my(), z:M.z,
        vx:Math.cos(a)*W.spd, vy:Math.sin(a)*W.spd, angle:a,
        life:K.range/W.spd, owner:-2, dmg:W.dmgCar, dmgWalk:W.dmgWalk,
        col:W.col, glow:W.glow, r:W.r, blast:W.blast || 0, smoke:0 };
      shots.push(s);
      if(typeof particles === 'function')
        particles(mx(), my(), M.z, W.kind === 'missile' ? 10 : 6,
          { col:[W.glow, '#ffffff', W.col], spd0:20, spd1:W.kind === 'missile' ? 110 : 70,
            size:W.kind === 'missile' ? 2.5 : 1.5, life0:0.05, life1:0.18, grav:0 });
      if(typeof Snd !== 'undefined' && Snd.voice){
        if(W.kind === 'missile') Snd.voice(180, 0.42, 'sawtooth', 0.07, 90);     // a launch, not a zap
        else                     Snd.voice(1500, 0.10, 'square', 0.04, 520);     // a crack
      }
    }
    return;
  }
  f.gunT -= dt;
  if(f.gunT > 0 || dist > K.range || !see) return;
  // the next arm, latched HERE rather than at the shot, so the smoke pours out
  // of the one the missile then leaves. Strict alternation and not a coin flip:
  // a rack cycles its tubes, and a flip would fire the same arm twice now and
  // again for no reason you could see on the model.
  f.arm = f.arm ? 0 : 1;
  f.charge = K.windup; f.glowT = 0;
}

// ---- drawing it, and the rise. There is no second model and no animation: the
// sprite is CLIPPED to the part of it that has cleared the floor, so what comes
// up out of the hatch first is whatever is at the top of the model - the barrel
// on one, the missile arms on the other. The frame's bottom rows hold the base's
// near face (KY_FPS tilts it into view), so the full frame is drawn once it is
// up rather than the clipped path being used at k = 1 and losing them.
function drawTurretBillboard(f, sx, ground, scale, perp, camX, camY){
  const K = TURRET.KINDS[f.turret];
  if(K.h*scale < 1) return;
  const sp = bakeTurretSheet(f.turret);
  if(!sp) return;
  const fog0 = Math.min(0.78, perp/(TURRET.FADE || FOE.FADE));
  // the car branch's frame formula, unchanged: the carve shares the cars' axes
  const look = Math.atan2(f.y - camY, f.x - camX);
  const TAU = Math.PI*2;
  let yaw = (f.a || 0) - look - Math.PI/2;
  yaw = ((yaw % TAU) + TAU) % TAU;
  const fr = Math.round(yaw/TAU*sp.n) % sp.n;
  foeCellEnsure(sp, 0, fr);                        // the one it needs, now; the rest in the background
  const k = scale/sp.vsc;                          // the sheet's own scale divides back out
  const dx = sx - sp.ax*k;
  rcCtx.globalAlpha = 1 - fog0*0.55;
  if(f.rise >= 1){
    const dy = ground - sp.ay*k;
    if(f.hurtFlash > 0) rcCtx.drawImage(hitFrame(sp, fr, 0, asciiMode ? 0 : FOE_HIT_LIFT),
                                        0, 0, sp.fw, sp.fh, dx, dy, sp.fw*k, sp.fh*k);
    else                rcCtx.drawImage(sp.cv, fr*sp.fw, 0, sp.fw, sp.fh, dx, dy, sp.fw*k, sp.fh*k);
  } else {
    // sunk by (1 - rise) of its height. sp.ay is the sheet row the model's z = 0
    // sits on, so the floor line is `cut` rows above it and everything below that
    // row is still underground.
    const cut = (1 - f.rise)*K.h*sp.vsc;
    const srcH = Math.max(1, Math.round(sp.ay - cut));
    rcCtx.drawImage(sp.cv, fr*sp.fw, 0, sp.fw, srcH,
                    dx, ground - srcH*k, sp.fw*k, srcH*k);
  }
  rcCtx.globalAlpha = 1;
}
