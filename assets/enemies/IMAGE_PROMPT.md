# On-foot enemy: image prompt

One enemy type, one picture to start: **`sentry_idle.png`** — standing still, facing the camera.
Everything else (turning, walking, firing, dying) comes later; this one sprite exists to get an
enemy through `gatherBillboards` → `rcSprites` → `asciiBlit` and onto the screen.

Then: `python3 tools/enemy_images.py` (a sibling of `tools/gun_images.py`) packs
`assets/enemies/*.png` into `assets/enemies/enemies-2d.js` as data URLs. **This is not optional
plumbing** — a page opened from `file://` may draw a plain `.png` but not read its pixels back,
and both the green key and the ASCII pass read pixels.

## Who it is

**A CIVIC SENTRY** — the techno-lords' street-level guard. The comic already says the city's
guards ignore an old model like him and "only fear high-tech androids packed with powerful energy
attacks", so the sentry has no reason to look at you until you give it one: **the pistol is what
makes you worth shooting.** It is not a Collector (those are the hunter cars).

Design brief, before the prose: it must be **instantly not-us**. He has a round head and one
cracked cyan optic; she has two cyan eyes. The sentry gets a **wide horizontal amber scanner bar**
for a face and **shoulders clearly wider than its head**. At the size this will usually be drawn,
those two facts are the entire character design.

## The prompt

> A single humanoid security robot standing upright, facing the viewer head-on, seen at eye level,
> arms at its sides, perfectly still and symmetrical, like a guard at attention. Tall and
> broad-shouldered with a narrow waist; smooth armoured plating in off-white and pale ice-blue,
> panel seams and dark joints at the elbows, knees and neck. Instead of a face it has a single
> wide horizontal glowing scanner bar across the head, burning bright amber-orange, like a
> searchlight slot. Small amber indicator lights on the chest. Heavy boots flat on the ground.
> Chunky low-resolution pixel-art look with clean hard edges and flat shading, bold black outline
> around the whole figure. Night-time cyberpunk mood, lit from the front-left by cold white light
> with a dim violet shadow down the right side of the body. Limited palette: off-white, pale
> ice-blue, dark violet shadows, amber-orange lights only.
> The figure stands centred and fills the full height of the frame, its boots resting exactly on
> the bottom edge.
> BACKGROUND: completely flat, solid pure green (#00FF00), no gradient, no shadow, no floor, no
> scenery, no ground plane. Portrait 2:3, 1024x1536. No text, no logos, no UI.

### Variants to try

Swap only the first two sentences; keep everything from "Chunky low-resolution" onward, because
that part is the technical contract, not the taste.

- **Heavier / riot:** *"A single bulky riot-enforcement robot standing upright, facing the viewer
  head-on, seen at eye level. Squat and massively armoured, a slab of a chest plate, short thick
  legs, a riot shield slung on its left forearm."*
- **Thin / fast:** *"A single tall spindly patrol drone standing upright on two long digitigrade
  legs, facing the viewer head-on, seen at eye level. Thin limbs, a small sensor pod head on a
  long neck, a cluster of lenses."*

## The rules behind the prompt, and why

Every one of these is a constraint the engine imposes. Breaking them doesn't look worse, it
breaks.

- **Pure flat green background, and no green anywhere on the robot.** `keyAndScale` in
  `fpsgun.js` turns any pixel with `g >= 150` and `r, b <= 120` transparent, then de-spills
  anything greenish. A green-plated robot gets holes punched in it. This one bites: the comic
  gives the Collectors **blue, green and yellow** livery, so the obvious "house colours" choice is
  the one that cannot be used.
- **It will be tiny.** `RC_VD` is about 147 at the default 95° FOV, a person is ~18 world units
  tall (`WALK_EYE` 16), so a sentry 100 units away is **26 px tall — about 9 character rows**, and
  at 200 units it's 4 rows. Fine detail is not reduced, it is deleted. Draw a silhouette that
  survives at thumbnail size and let the rest be a bonus for close range.
- **Keep the body brighter than the street.** ASCII picks a glyph by luminance over `ASC_LO` 16 →
  `ASC_HI` 100, and the night street sits around 40. A dark robot in a dark street is a blank
  rectangle. This already happened once with the pistol, which had to be re-lit. Off-white plating
  is not a style choice here, it is legibility.
- **Warm lights only on the lights.** `asciiBlit` treats any pixel with `r > ASC_LIGHT_R` (120)
  and `r - b > ASC_LIGHT_WARM` (60) as a lit window: that pixel wins its whole cell, takes over
  its colour and forces a bright glyph. An **amber scanner bar exploits this on purpose** — one
  lit pixel at 150 units is still a bright `*` in amber, so the eye is the one part of the sprite
  that cannot be averaged away. It is the reason a distant sentry will be visible at all.
  The flip side: **do not give the body large warm or rust-orange areas.** Comic-palette rust
  accents above r=120 will sparkle the whole figure into bright glyphs and destroy the silhouette.
  Cyan and magenta are safe (magenta #ff2bd6 is `r-b = 41`, under the threshold); amber and orange
  are not.
- **Cyan belongs to us.** He and she both glow cyan. Giving the enemy amber keeps friend and foe
  apart at a glance — and at 4 rows tall, colour is the only thing left to read.
- **Head-on, at eye level, symmetrical.** The billboard is drawn at the camera's eye height from
  whatever angle you approach it, and this first sprite has no turning frames, so it must look
  deliberate from the front and not obviously wrong from the side. A figure drawn from slightly
  above or in three-quarter view will look like it is leaning when the player circles it.
- **Boots on the bottom edge, no shadow, no floor.** The bottom edge of the picture is the ground
  contact line the billboard anchors to. A painted shadow or a sliver of floor becomes a dark
  smear floating under the sprite, and a baked shadow is the same bug the cars already have on
  ramp jumps (`PROJECT.md`, known rough edges).

## Notes

- `design/GDD.md` asks for hand-drawn 2D sprites, *not* pixel art. The prompt above asks for pixel
  art instead, to match the pistol that is actually in the game. The GDD has drifted from the
  build in several places; this is a deliberate departure, not an oversight. Say so if you'd
  rather go the other way — the technical rules are identical either way.
- 8 directions (the GDD's number) is right for the finished enemy and wrong for the first one.
  Directions multiply the cost of every later change to the art; get one sprite on screen and
  shoot it before committing to eight of anything.
