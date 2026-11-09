#!/usr/bin/env python3
"""
gun_images.py - pack first-person gun pictures into assets/guns/guns-2d.js.

    python3 tools/gun_images.py            # every assets/guns/*.png
    -> assets/guns/guns-2d.js : const GUN_IMAGES = { idle:'data:image/png;base64,...', fire:... }

The name of each entry is the file name without .png (pistol_idle.png -> 'pistol_idle';
the lab looks for 'idle' and 'fire', so name them idle.png / fire.png, or the first
one found is used as idle). Pictures are expected full-frame 16:9 on a flat pure-green
background; fpsgun.js keys the green out and scales them in the browser.

Why a .js of data URLs: a page opened from disk (file://) may draw a plain image
file but not read its pixels back, and both the green key and the ASCII view read
pixels. Data URLs don't have that restriction. Standard library only.
"""
import base64, glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'assets', 'guns')
out = {}
for p in sorted(glob.glob(os.path.join(DIR, '*.png'))):
    name = os.path.splitext(os.path.basename(p))[0]
    out[name] = 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
    print('  %-20s %7.1f KB' % (name, os.path.getsize(p)/1024))
js = ('// made by tools/gun_images.py from assets/guns/*.png - do not edit\n'
      'const GUN_IMAGES = ' + json.dumps(out, indent=0) + ';\n')
open(os.path.join(DIR, 'guns-2d.js'), 'w').write(js)
print('wrote assets/guns/guns-2d.js (%d images)' % len(out))
