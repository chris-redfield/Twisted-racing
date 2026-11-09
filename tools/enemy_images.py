#!/usr/bin/env python3
"""
enemy_images.py - pack on-foot enemy sprites into assets/enemies/enemies-2d.js.

    python3 tools/enemy_images.py              # every assets/enemies/*.png
    python3 tools/enemy_images.py --height 512 # keep more detail
    -> assets/enemies/enemies-2d.js : const ENEMY_IMAGES = { sentry_idle: {...} }

Each entry is { src: 'data:image/png;base64,...', w, h } - w/h are the packed
picture's size, which the billboard needs to keep the sprite's aspect.

Unlike tools/gun_images.py, this one does the work in Python rather than in the
browser, for two reasons:

  * SIZE. A 1024x1536 source is 1.3 MB, and base64 is a third bigger again. The
    sprite is never drawn above ~100 px tall (see the billboard maths in
    assets/enemies/IMAGE_PROMPT.md), so shipping the full picture would put 1.7 MB
    of text in a file that is parsed on every load, to throw 94% of it away.
  * THE KEY. Keying green AFTER a smooth downscale is wrong: the black outline
    blends into the green background on the way down, and the blend is no longer
    green enough to key, so the sprite gets a dark halo. Key first at full size,
    then shrink with the alpha already there and let the filter antialias the edge.

Why a .js of data URLs (the same reason as the guns): a page opened from file://
may draw a plain image file but not read its pixels back, and the ASCII pass reads
pixels off the canvas the sprite was drawn onto.
"""
import argparse, base64, glob, io, json, os, sys

try:
    from PIL import Image
except ImportError:
    sys.exit('needs Pillow:  pip install Pillow')

G_MIN, RB_MAX = 150, 120          # must match GUN_KEY in fpsgun.js

ap = argparse.ArgumentParser()
ap.add_argument('--height', type=int, default=384, help='packed height in px (default 384)')
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'assets', 'enemies')

def key_out(im):
    """green -> transparent, and de-spill what's left (no green fringe)."""
    im = im.convert('RGBA')
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            if g >= G_MIN and r <= RB_MAX and b <= RB_MAX:
                px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b:
                px[x, y] = (r, max(r, b), b, 255)
    return im

out = {}
for p in sorted(glob.glob(os.path.join(DIR, '*.png'))):
    name = os.path.splitext(os.path.basename(p))[0]
    src = Image.open(p)
    W0, H0 = src.size
    im = key_out(src)
    box = im.getbbox()                       # tight crop: the sprite's own bounds
    if not box:
        print('  %-16s all green, skipped' % name); continue
    im = im.crop(box)
    if im.height > a.height:                 # LANCZOS, not NEAREST: the source only
        w = max(1, round(im.width*a.height/im.height))   # looks like pixel art, it is
        im = im.resize((w, a.height), Image.LANCZOS)     # full of 1px runs
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    out[name] = {'src': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(),
                 'w': im.width, 'h': im.height}
    print('  %-16s %dx%d -> cropped %dx%d -> %dx%d   %6.1f KB -> %6.1f KB'
          % (name, W0, H0, box[2]-box[0], box[3]-box[1], im.width, im.height,
             os.path.getsize(p)/1024, len(buf.getvalue())/1024))

js = ('// made by tools/enemy_images.py from assets/enemies/*.png - do not edit\n'
      'const ENEMY_IMAGES = ' + json.dumps(out, indent=0) + ';\n')
open(os.path.join(DIR, 'enemies-2d.js'), 'w').write(js)
print('wrote assets/enemies/enemies-2d.js (%d sprite%s)' % (len(out), '' if len(out) == 1 else 's'))
