// pad.js - the gamepad (in the game since 2026-11-09; picked in OPTIONS, knobs:
// PAD in config.js). The layout, and why:
//
//   LEFT SIDE = the car                    RIGHT SIDE = the guns
//   left stick  steer (X) + speed trim (Y)   right stick  the turret
//   d-pad       the same four, digital
//   L2  drift (the handbrake)                R2  missile
//   L1  boost                                R1  machine gun
//   Square  mine     Cross  confirm / in and out of the car     Circle  back
//   Options  pause
//
// The two triggers are the two things you squeeze and hold: drift through a
// corner on the left, the missile on the right. Both guns sit on the right hand
// beside the aim stick, so firing never costs you the aim. Boost is a TAP, and
// it is a driving input, so it joins drift on the left. Mines went to a face
// button because they are the rarest thing in the game (you carry 2, 3 at most).
//
// The Gamepad API has no button events, so this is POLLED: padPoll() runs once a
// frame from frame(), and every other function here reads the snapshot it left.
//
// Loaded as a classic script before the game's own: it only DEFINES things, and
// everything it touches in the game (PAD, inputMode, KY) is looked up when its
// functions run, not when this file loads.
//
// Two kinds of reader, and the difference matters:
//   padHeld / padStick   continuous - steering, the throttle, aim, held fire
//   padPressed           THIS FRAME's edge - boost, a mine, a menu move
// An edge stays true for the whole frame, so more than one reader can act on the
// same press; padPoll clears it on the NEXT frame rather than on first read.

const padState = {
  on:false, id:'', index:-1,
  ax:[0,0,0,0],
  now:Object.create(null), prev:Object.create(null),   // button name -> down?
  rep:Object.create(null),                             // button name -> seconds held
  fired:Object.create(null),                           // button name -> repeat ticked this frame
};

function padConnected(){ return padState.on; }
function padName(){ return padState.id; }

// The ONE place that decides whether the pad is driving: picked in OPTIONS, AND
// something actually plugged in. With no pad this is false whatever the saved
// setting says, so the mouse always keeps the game - nobody can lock themselves
// out by choosing CONTROLLER and then unplugging it.
function padMode(){
  return typeof inputMode !== 'undefined' && inputMode === 'pad' && padState.on;
}

// The pad we listen to: the first one reporting the standard mapping, so the
// indices in PAD.BTN mean what they say. Falls back to the first pad of any
// mapping - better a wrong button than no pad at all.
function padDevice(){
  if(typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const all = navigator.getGamepads();
  let first = null;
  for(let i = 0; i < all.length; i++){
    const g = all[i];
    if(!g || !g.connected) continue;
    if(!first) first = g;
    if(g.mapping === 'standard') return g;
  }
  return first;
}

function padPoll(dt){
  const g = padDevice();
  padState.prev = padState.now;
  padState.now = Object.create(null);
  padState.fired = Object.create(null);
  if(!g){
    padState.on = false; padState.id = ''; padState.index = -1;
    padState.ax = [0,0,0,0];
    padState.rep = Object.create(null);
    return;
  }
  padState.on = true;
  padState.id = g.id || 'gamepad';
  padState.index = g.index;
  padState.ax = [g.axes[0]||0, g.axes[1]||0, g.axes[2]||0, g.axes[3]||0];
  for(const name in PAD.BTN){
    const b = g.buttons[PAD.BTN[name]];
    if(b == null) continue;
    // L2/R2 travel: they report a value, not just pressed/not. Everything else
    // is a switch, but read the value there too - some pads only set `value`.
    const v = (typeof b === 'object') ? (b.value != null ? b.value : (b.pressed ? 1 : 0)) : b;
    padState.now[name] = (name === 'L2' || name === 'R2')
      ? v > PAD.TRIG
      : (v > 0.5 || (typeof b === 'object' && b.pressed === true));
  }
  // Menu repeat: a held d-pad waits MENU_REPEAT, then ticks every MENU_RATE, so
  // one press moves one row and a held one scrolls. Counted per button here so
  // padRepeat() stays a plain read.
  for(const name in PAD.BTN){
    if(!padState.now[name]){ padState.rep[name] = 0; continue; }
    const t0 = padState.rep[name] || 0, t1 = t0 + (dt || 0);
    padState.rep[name] = t1;
    if(t0 < PAD.MENU_REPEAT){
      if(t1 >= PAD.MENU_REPEAT) padState.fired[name] = true;
    } else {
      const n0 = Math.floor((t0 - PAD.MENU_REPEAT)/PAD.MENU_RATE);
      const n1 = Math.floor((t1 - PAD.MENU_REPEAT)/PAD.MENU_RATE);
      if(n1 !== n0) padState.fired[name] = true;
    }
  }
}

function padHeld(name){ return !!padState.now[name]; }
function padPressed(name){ return !!padState.now[name] && !padState.prev[name]; }
// pressed, or held long enough to auto-repeat - menus only, never the guns
function padRepeat(name){ return padPressed(name) || !!padState.fired[name]; }

// A stick, with a RADIAL deadzone: the slack is a circle, not a square, so a
// diagonal push is not clipped on one axis while the other still reads. Past the
// edge the magnitude is rescaled dz..1 -> 0..1, so the first movement off the
// deadzone is gentle instead of jumping to a quarter deflection.
function padStick(which){
  const R = which === 'R';
  const ix = R ? PAD.AX.RX : PAD.AX.LX, iy = R ? PAD.AX.RY : PAD.AX.LY;
  const dz = R ? PAD.DZ_AIM : PAD.DZ_MOVE;
  const x = padState.ax[ix] || 0, y = padState.ax[iy] || 0;
  const m = Math.hypot(x, y);
  if(m < dz) return { x:0, y:0, m:0 };
  const k = (m - dz)/((1 - dz)*m);
  return { x:x*k, y:y*k, m:Math.min(1, (m - dz)/(1 - dz)) };
}

// ---------------------------------------------------------------- the car
// Steering: the left stick is analog (the keyboard's A/D are a flat -1/+1, so
// this is the one control the pad does strictly better), the d-pad digital.
function padSteer(){
  let s = padStick('L').x;
  if(padHeld('LEFT'))  s -= 1;
  if(padHeld('RIGHT')) s += 1;
  return Math.max(-1, Math.min(1, s));
}
// The throttle - in survival this trims your pace inside the cruise band, which
// is to say it picks your place in the frame. Up on a stick is -1, so it flips.
function padThrottle(){
  let t = -padStick('L').y;
  if(padHeld('UP'))   t += 1;
  if(padHeld('DOWN')) t -= 1;
  return Math.max(-1, Math.min(1, t));
}

// Where the right stick points, as a world angle - or null when it is at rest,
// and then the turret HOLDS the bearing it already has. A stick springs back to
// the middle and a mouse does not, so without that the gun would snap to
// straight-ahead every time you let go of it.
//
// The ground is drawn squashed (KY), so the stick is read as a direction on
// SCREEN and converted the way the mouse already is: push it at 45 degrees and
// the shot goes where the screen says, not 45 degrees in world space.
function padAimAngle(){
  const s = padStick('R');
  if(!s.m) return null;
  return Math.atan2(s.y/KY, s.x);
}

// ---------------------------------------------------------------- on foot
function padLookTurn(){  return padStick('R').x; }
function padLookPitch(){ return -padStick('R').y; }   // up on the stick looks up
