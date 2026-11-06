# Logo prompt (for ChatGPT image generation)

Save the result as `assets/logo.png` (transparent PNG). The menu picks it up automatically;
`LOGO_IMAGE` / `LOGO_WIDTH` in `config.js` control it. No file = the neon text fallback.

## Main prompt

> A video game logo wordmark that reads exactly "SCRAPHEAP", in one line of bold, heavy,
> slightly condensed capital letters. The letters are built from welded scrap metal: riveted
> steel plates, rough weld seams, small dents and bolt heads, a few jagged torn edges - like
> they were cut from a wrecked car with a torch. Running around the outline of every letter
> is a thin glowing neon tube in hot magenta (#ff2bd6), with a soft cyan (#22f0ff) glow
> bleeding off the metal edges, as if the scrap sign has been rewired into a cyberpunk neon
> sign. Lighting comes from the neon itself; the metal faces are dark gunmetal with magenta
> and cyan reflections. Subtle details: a few sparks, a hairline crack in one letter, a
> single flickering (dimmer) tube segment. Flat, straight-on front view, no perspective
> tilt, letters evenly spaced and perfectly legible. Wide horizontal composition, the
> wordmark filling about 85% of the width. Transparent background, no backdrop, no scene,
> no cars, no characters, no extra text, no tagline. Crisp clean edges suitable for a game
> title screen on a near-black (#07040f) background.

Settings: landscape (1536x1024). Ask for **transparent background** explicitly.

## If you want a variation

- **More pixel-art** (matches the in-game sprites):
  > ...same description, but rendered as clean high-resolution pixel art with a limited
  > palette (near-black, gunmetal greys, magenta #ff2bd6, cyan #22f0ff), hard pixel edges,
  > no anti-aliasing blur, 16-bit arcade title screen style.
- **More road/racing**: add
  > a strip of road rumble-strip (red and white blocks) under the wordmark, and a motion
  > streak behind the letters as if the logo is driving left to right.
- **Cleaner/minimal**: drop the sparks, crack and flicker; keep only welded plates + neon.

## Follow-up messages that usually fix things

- Letters wrong or misspelled: "The text must read exactly S-C-R-A-P-H-E-A-P, nine letters,
  nothing else. Keep everything else the same."
- Background not transparent: "Same image, but with a fully transparent background (PNG
  alpha), remove any glow haze that fills the background."
- Too busy at small size: "Make the letter shapes simpler and thicker so the logo stays
  readable when shown 600 pixels wide."
- Glow too weak on dark backgrounds: "Increase the magenta neon outline brightness and the
  cyan edge glow."
