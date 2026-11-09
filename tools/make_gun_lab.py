#!/usr/bin/env python3
"""
make_gun_lab.py - build scrapheap-gun-lab.html from index.html.

The gun lab boots straight into the city ON FOOT with the pistol armed
(fpsgun.js), so viewmodel methods can be compared in place: V cycles them, G
cycles ASCII, and the top-right box shows each method's draw cost.

It also plants a row of SENTRIES (foe.js) down the street at known distances, so
the enemy sprite can be judged against the ASCII pass at every size it will be
drawn at. Z drops another one 120 units ahead; that key is in index.html.
The city's own scattered sentries and its hunter cars are switched OFF in the
lab (enemiesOn = false): this is a controlled row, not a street scene. Their AI
is looked at in the game.
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
# Two rows of sentries, LEFT the detailed carve and RIGHT the coarse one, at the
# same four distances so the pair at each distance can be compared directly. The
# distances span what the billboard does: at RC_VD ~147 a 22-unit sentry is ~18
# ASCII rows tall at 60 units and barely one at 900.
# The helper goes INSIDE the page's own inline script, not in a <script> tag of
# its own: tools/headless.js pulls the inline script out with one greedy regex,
# and a second inline block makes it swallow a </script> and fail to parse.
rep('function rcSprites(camX, camY, bearing){',
    'const LAB_VOX = ["sentry@96", "sentry@64"];   // left column, right column\n'
    'function labSpawnFoes(){\n'
    '  // The city scatters sentries of its own now (citySentries, 2026-11-09) and\n'
    '  // its hunters drive through them. The lab wants ONLY its row, at known\n'
    '  // distances, with nothing walking across the comparison - so both are off\n'
    '  // here. Z still drops one, and the GAME is where the AI is looked at.\n'
    '  clearFoes(); enemiesOn = false;\n'
    '  const w = walker, fx = Math.cos(w.a), fy = Math.sin(w.a), lx = -fy, ly = fx;\n'
    '  // the same four distances twice, one carve each side, facing you\n'
    '  [70, 130, 260, 520].forEach((d, i) => {\n'
    '    LAB_VOX.forEach((v, c) => {\n'
    '      // the bearing WIDENS with distance, so the far pairs sit further out on\n'
    '      // screen instead of hiding behind the near ones\n'
    '      const a = w.a + (c ? 1 : -1) * (0.18 + i*0.10);\n'
    '      const x = w.x + Math.cos(a)*d, y = w.y + Math.sin(a)*d;\n'
    '      spawnFoe(x, y, Math.atan2(w.y - y, w.x - x), v);\n'
    '    });\n'
    '  });\n'
    '}\n'
    'function rcSprites(camX, camY, bearing){')

# V cycles the viewmodel method on foot
rep("  if(code==='KeyF') showFps=!showFps;",
    "  if(code==='KeyV' && onFoot){ gunCycleMethod(); return; }\n  if(code==='KeyF') showFps=!showFps;")
# boot: skip the menu, straight into the city on foot
rep("  if(state==='title'){ menuT += dt;",
    "  if(state==='title' && gunLabBoot()){ labSpawnFoes(); return; }\n  if(state==='title'){ menuT += dt;")
s = re.sub(r'<title>[^<]*</title>', '<title>Scrapheap - GUN LAB</title>', s, count=1)
rep('Q mine &middot;', 'V viewmodel &middot; Z sentry &middot; Q mine &middot;')

open(os.path.join(ROOT, 'scrapheap-gun-lab.html'), 'w', encoding='utf8').write(s)
print('wrote scrapheap-gun-lab.html')
