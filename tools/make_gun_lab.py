#!/usr/bin/env python3
"""
make_gun_lab.py - build scrapheap-gun-lab.html from index.html.

The gun lab boots straight into the city ON FOOT with the pistol armed
(fpsgun.js), so viewmodel methods can be compared in place: V cycles them, G
cycles ASCII, and the top-right box shows each method's draw cost.
index.html is never touched; re-run after it changes:

    python3 tools/make_gun_lab.py

Every patch asserts it matched exactly once, so a drifted index.html fails loudly.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit('patch failed (%d matches, wanted %d):\n%s' % (c, n, old[:200]))
    s = s.replace(old, new)

# (the pistol itself is in index.html since 2026-11-08; the lab adds the stats box, V and the boot)
# armed on foot (WALK_ARMED is a config const; in the lab it is simply true)
s = re.sub(r'\bWALK_ARMED\b(?!\s*=)', 'true', s)
# the viewmodel goes into the raycaster's frame, before the blit (and the ascii pass)
rep("  gunMarker();\n  // crosshair", "  gunMarker();\n  gunHud();\n  // crosshair")
# V cycles the viewmodel method on foot
rep("  if(code==='KeyF') showFps=!showFps;",
    "  if(code==='KeyV' && onFoot){ gunCycleMethod(); return; }\n  if(code==='KeyF') showFps=!showFps;")
# boot: skip the menu, straight into the city on foot
rep("  if(state==='title'){ menuT += dt;", "  if(state==='title' && gunLabBoot()) return;\n  if(state==='title'){ menuT += dt;")
s = re.sub(r'<title>[^<]*</title>', '<title>Scrapheap - GUN LAB</title>', s, count=1)
rep('Q mine &middot;', 'V viewmodel &middot; Q mine &middot;')

open(os.path.join(ROOT, 'scrapheap-gun-lab.html'), 'w', encoding='utf8').write(s)
print('wrote scrapheap-gun-lab.html')
