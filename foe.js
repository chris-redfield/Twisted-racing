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
const FOE_LIFT = 1.9;             // first person's lift (see foeSheetEnsure)
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
           ax: fw/2,
           ay: fh - vsc - R*ky*vsc,       // model z=0 (the feet) near the bottom
           done: new Array(P).fill(false) };
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
  const sp = foeSheetNew(MODELS[mi], col, KY_FPS, KZ_FPS, FOE_VSC, FOE_LIFT);
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
  if(ownerId === 0) gunnerKill = 1.1;   // the driving pane's kill flash
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
  const m = foes.filter(f => f.mad && !f.dead), R = FOE.R*2;
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
  const R = FOE.R + WALK_R;
  for(const f of foes){
    if(f.dead) continue;
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
    const sp = Math.hypot(c.vx, c.vy), R = (c.rad || 14) + FOE.R;
    for(const f of foes){
      if(f.dead) continue;
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
  // QUEST 1's bunker guards don't wait to be shot: get close and they come
  if(f.guard && !f.mad && typeof cityTarget === 'function'){
    const T0 = cityTarget();
    if(Math.hypot(T0.x - f.x, T0.y - f.y) < QUEST.GUARD_AGGRO){ f.mad = true; f.loseT = 0; }
  }
  if(!f.mad) return;              // ignoring you: whatever `walk` is, it is not the AI's
  const T = cityTarget();
  const dx = T.x - f.x, dy = T.y - f.y, dist = Math.hypot(dx, dy);
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
  if(dist > (f.guard ? QUEST.GUARD_GIVE_UP : FOE_AI.GIVE_UP)){
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
  const inCity = typeof street !== 'undefined' && street;
  const aim = (!inCity || (dist < FOE_AI.NEAR && cityClear(f.x, f.y, T.x, T.y))) ? T
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
  const inCity = typeof street !== 'undefined' && street;
  if(inCity && typeof cityClear === 'function' && !cityClear(f.x, f.y, T.x, T.y)) return;   // no line, no shot
  f.charge = FOE_GUN.WINDUP; f.glowT = 0;
}
// Wedged on a corner the field routed it into, or shouldering the car: lean off
// to ONE side for a while - the same side until it comes free, so it does not
// jitter left and right against a wall - and straighten up once it is moving.
function foeStuck(dt){
  for(const f of foes){
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
  // The city's geometry only exists in the city; everywhere else (the straight
  // legs, the labs) a walking sentry just walks.
  const walled = typeof street !== 'undefined' && street;
  foeMadN = 0;
  for(const f of foes){
    if(f.dead) continue;
    if(f.hurtFlash > 0) f.hurtFlash = Math.max(0, f.hurtFlash - dt);
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
      const f = spawnFoe(p.x, p.y, p.a);
      f.key = p.key; f.ck = p.ck;
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
