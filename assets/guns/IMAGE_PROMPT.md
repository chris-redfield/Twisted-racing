# First-person pistol: image prompt

One picture per gun, saved as PNG into this folder:
- `idle.png`: the pistol held, not firing

The firing is animated in code on top of it (recoil, a flickering flash, a tumbling casing):
a painted flash/casing in a second 'fire' picture just blinks on and off, which looked bad.
`fire.png` is kept but unused (`GUN_IMG.USE_FIRE_FRAME` in fpsgun.js). After a new picture,
re-measure `GUN_IMG.MUZZLE` / `EJECT` (front-sight top / ejection port, as fractions).

Then run `python3 tools/gun_images.py` and open `scrapheap-gun-lab.html` (V switches to IMAGE).

## Prompt (idle)

> First-person view of a hand holding a pistol, as in a classic 1990s first-person shooter
> (viewmodel at the bottom centre of the screen, slightly right of centre). We look over the
> top of the gun: the back of the slide, the rear sight, the front sight, aiming straight
> ahead into the distance. A gloved hand grips it, the forearm in a dark worn jacket sleeve
> coming in from the bottom-right edge. Chunky low-resolution pixel-art look with clean hard
> edges and flat shading, limited palette: gunmetal greys, a warm amber rim light on the right
> edge of the slide (like light from city windows at night), dusky purple tones on the glove
> and sleeve. Night-time cyberpunk mood. The gun and hand fill only the bottom 45% of the
> picture; everything else is empty.
> BACKGROUND: completely flat, solid pure green (#00FF00), no gradient, no shadow, no floor,
> no scenery. 16:9 landscape, 1920x1080. No text, no logos, no UI, no crosshair.

## Notes
- Pure flat green matters: it is keyed out to transparent (anything with green >= 150 and
  red, blue <= 120). Avoid green in the gun itself.
- The picture is shrunk to the game's first-person resolution (about 320x180), so fine detail
  disappears; bold shapes and strong light/dark contrast survive, and contrast is also what
  makes it read in ASCII mode (dark areas turn into blank space there).
- The game's lore for who holds the gun isn't decided; if the hand should be robotic, say so
  in the prompt.
