#!/usr/bin/env python3
"""Make the game's WebP copy of an image (or several), next to the original.

    python3 tools/webp.py assets/comic/page1-1.png [more.png ...]
    python3 tools/webp.py --all          # every comic panel + the logo

Quality 92 lossy, transparency kept exact. The originals are never touched; the
game loads the .webp (paths in config.js). Why 92: on this halftone art the
leftover difference is colour resolution (lossy WebP always halves it), not
compression - q99 barely scores higher than q92 but is ~40% bigger. At the size
the game draws a panel (<= ~700 px wide) the two can't be told apart; checked
side by side on page2-1 (2026-11-06). Lossless is ~3 MB a panel - no saving.
"""
import glob, os, sys
from PIL import Image

def convert(path):
    im = Image.open(path); im.load()
    alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    out = os.path.splitext(path)[0] + '.webp'
    im.convert('RGBA' if alpha else 'RGB').save(out, 'WEBP', quality=92, method=6,
                                                alpha_quality=100, exact=True)
    a, b = os.path.getsize(path), os.path.getsize(out)
    print(f'{path} {a/1e6:.2f} MB -> {out} {b/1e3:.0f} KB ({b/a*100:.0f}%)')

if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--all']:
        args = sorted(glob.glob('assets/comic/page*.png')) + ['assets/logo.png']
    if not args:
        sys.exit(__doc__)
    for p in args:
        convert(p)
