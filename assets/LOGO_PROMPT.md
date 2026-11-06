# Logo prompts (for ChatGPT image generation)

The name isn't final, so the logo is split in two:

- **a SYMBOL with no lettering** - made by the image model, survives any rename;
- **the NAME** - written by the game itself from `GAME_TITLE` in `config.js`.

Set `LOGO_WITH_TITLE = true` in `config.js` and the menu draws the symbol with the name
under it. Save the image as `assets/logo.png`. A black background is fine (`LOGO_BLEND`
'lighter' makes it vanish); crop with `LOGO_CROP` if the symbol only fills part of the image.

**Status 2026-11-06: the logo stays as it is** - the welded-metal neon wordmark in
`assets/logo.png`. Prompt A below was tried and rejected: it produced an app icon, which is not
what a title logo should be. Kept only as a record of what not to repeat.

---

## A. The route emblem (recommended) - the game's whole journey as a badge

> A minimal flat vector emblem for a video game, no text, no letters anywhere. A square
> badge with softly rounded corners, outlined in a single glowing hot-magenta (#ff2bd6) neon
> line. Inside the badge, seen straight from above like a map: a thick highway enters from
> the lower left, runs to the right, turns a clean 90-degree corner and runs straight up
> into a dense grid of small rectangular city blocks that fills the top of the badge. The
> blocks are flat deep violet (#3b2b5e) with thin cyan (#22f0ff) outlines, irregular in
> size like a real downtown, with narrow streets between them. On the highway, just before
> the corner, a small bright magenta arrow-shaped car marker pointing along the road. The
> highway has a dashed centre line. Everything is flat colour and clean geometric line art
> with a soft neon glow, like a cyberpunk transit sign. Pure black background, centred,
> generous empty margin around the badge. It must still read clearly when shown very small,
> like an app icon.

Settings: square (1024x1024).

## B. Graffiti stencil - rougher, street-level

> A spray-paint stencil emblem on a black background, no text. A battered muscle car seen
> head-on, simplified to bold flat shapes like a protest stencil, with one headlight lit.
> Painted in hot magenta (#ff2bd6) with overspray and drips, a second offset pass in cyan
> (#22f0ff) slightly misregistered behind it like a cheap two-colour print. Grainy, gritty,
> but the silhouette is clean and instantly readable. Centred, empty margin, nothing else in
> the image.

Settings: square (1024x1024).

## C. With the name in it (only once the name is final)

Use either prompt above and add:

> Below the emblem, the word "[NAME]" in a wide, heavy, geometric sans-serif typeface, all
> capitals, flat cyan (#22f0ff) with a thin magenta outline, evenly letter-spaced. The text
> must read exactly "[NAME]" and nothing else.

Then set `LOGO_WITH_TITLE = false` (the image carries the name).

---

## Follow-ups that usually fix things

- Text crept in: "Remove every letter, number and word from the image. Keep everything else."
- Too detailed: "Simplify: half as many city blocks, thicker lines, so it reads at 64 pixels."
- Glow fills the background: "Keep the background pure black (#000000); the glow should stay
  close to the lines."
- Corner looks wrong: "The road must make exactly one 90-degree turn: right, then straight up."
