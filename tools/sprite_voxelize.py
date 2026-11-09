#!/usr/bin/env python3
"""
sprite_voxelize.py - turn ONE front-facing sprite into a voxel model for the
game's software rasteriser (rasterCar in index.html), so a hand-drawn enemy can
be seen from all 32 angles instead of only the one it was drawn at.

    python3 tools/sprite_voxelize.py assets/enemies/sentry_idle.png \
        -o assets/enemies/sentry-vox.js --name sentry

Output is the same shape as tools/car_voxelize.py's:
    SPRITEVOX["sentry@96"] = { res, vox, lo:[x,y,z], roles:[...], f:[role, 4 corners...] }
so voxMesh() in index.html turns it into {v, c:role} faces with no other change.

HOW, and what it is guessing
----------------------------
A proper visual hull needs at least two silhouettes: you extrude each one through
the volume and keep what they agree on. With one picture there is nothing to
disagree with, so an honest hull would just be a flat slab.

Instead this GUESSES the missing depth from the width, run by run. For every row
of the sprite it finds each horizontal run of solid pixels and gives that run a
superelliptical cross-section whose depth is `min(width, cap)`:

  * a narrow run - an arm, a leg, the head - comes out ROUND, which is what
    arms, legs and heads are;
  * a wide run - the chest, the shoulders - is capped and comes out as a rounded
    SLAB, which is what a torso is.

That one rule does most of the work, because it happens to be how a humanoid is
built. Where it is wrong is predictable: anything held against the body (this
sentry's arms) merges into the torso run and inherits the torso's depth, so the
arms become part of the slab. Draw the next one with its arms slightly out, or
give this tool a side silhouette to intersect with, and that goes away.

Colour is projected straight back along the view axis: every voxel takes the
colour of the sprite pixel it sits behind. The back of the model is therefore a
mirror of the front, which for a symmetric robot is very nearly right.

Colours become ROLES, not RGB, because that is what rasterCar understands (and
it means the same model can be recoloured per enemy). The mapping is in
`role_of`: warm+bright -> lamp (the visor, which is the part ASCII keeps),
then dark / shadowed / body / accent by luminance.
"""
import argparse, base64, json, os, sys
import numpy as np
from PIL import Image

G_MIN, RB_MAX = 150, 120           # the green key, as in fpsgun.js
# only these exist in rasterCar's `roles` table; anything else renders as undefined
ROLES = ['dark', 'shadowed', 'body', 'accent', 'metal', 'lamp']

ap = argparse.ArgumentParser()
ap.add_argument('png')
ap.add_argument('-o', '--out', required=True)
ap.add_argument('--name', default=None, help='key in SPRITEVOX (default: the file stem)')
ap.add_argument('--res', type=int, default=96, help='voxels tall (default 96)')
ap.add_argument('--height', type=float, default=22.0, help='world units tall (FOE.H)')
ap.add_argument('--cap', type=float, default=0.34,
                help='max depth as a fraction of the figure width (default 0.34)')
ap.add_argument('--round', type=float, default=2.6,
                help='superellipse exponent: 2 = elliptical, higher = boxier')
ap.add_argument('--erode', type=int, default=3,
                help="voxels of the drawing's black outline to pull off the skin (default 3)")
ap.add_argument('--smooth', type=int, default=2,
                help='majority-filter passes over the roles, to kill speckle (default 2)')
a = ap.parse_args()
name = a.name or os.path.splitext(os.path.basename(a.png))[0].replace('_idle', '')

# ---------------------------------------------------------------- the picture
src = Image.open(a.png).convert('RGB')
rgb = np.asarray(src).astype(np.int16)
solid = ~((rgb[:, :, 1] >= G_MIN) & (rgb[:, :, 0] <= RB_MAX) & (rgb[:, :, 2] <= RB_MAX))
ys, xs = np.nonzero(solid)
if not len(ys):
    sys.exit('the whole picture keyed out as background')
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
src = src.crop((x0, y0, x1, y1))
H0, W0 = y1 - y0, x1 - x0

NZ = a.res                                   # voxels tall
NY = max(1, round(NZ * W0 / H0))             # ...and across
small = src.resize((NY, NZ), Image.LANCZOS)
sm = np.asarray(small).astype(np.int16)
mask = ~((sm[:, :, 1] >= G_MIN) & (sm[:, :, 0] <= RB_MAX) & (sm[:, :, 2] <= RB_MAX))
# LANCZOS can ring the key colour out of range at the edge; a box pass decides
# the silhouette and the colours come from the sharper resize
mk = np.asarray(src.resize((NY, NZ), Image.BOX)).astype(np.int16)
mask &= ~((mk[:, :, 1] >= G_MIN) & (mk[:, :, 0] <= RB_MAX) & (mk[:, :, 2] <= RB_MAX))

NX = max(3, int(round(a.cap * NY)) | 1)      # depth, odd so it has a centre
print('  sprite %dx%d -> grid %d(d) x %d(w) x %d(h)' % (W0, H0, NX, NY, NZ))

# ---------------------------------------------------------------- the carve
# model axes, matching the cars: +x forward (the way it faces), +y lateral, +z up
vol = np.zeros((NX, NY, NZ), dtype=bool)
cx = (NX - 1) / 2.0
n = a.round
for k in range(NZ):
    row = mask[NZ - 1 - k]                   # image row 0 is the TOP, z is up
    j = 0
    while j < NY:
        if not row[j]:
            j += 1; continue
        j2 = j
        while j2 + 1 < NY and row[j2 + 1]:
            j2 += 1
        w = j2 - j + 1                       # this run's width, in voxels
        d = min(w, NX)                       # ...and the depth we are guessing
        cy, ry, rx = (j + j2) / 2.0, w / 2.0, d / 2.0
        for jj in range(j, j2 + 1):
            ty = abs(jj - cy) / max(ry, 1e-6)
            if ty > 1: continue
            # superellipse: |y/ry|^n + |x/rx|^n <= 1, solved for the x half-width
            hx = rx * (1 - ty ** n) ** (1 / n)
            lo_i, hi_i = int(np.ceil(cx - hx - 0.5)), int(np.floor(cx + hx + 0.5))
            vol[max(0, lo_i):min(NX, hi_i + 1), jj, k] = True
        # every column of the drawing keeps at least one voxel, so the front
        # silhouette is exactly the picture's
        vol[int(round(cx)), j:j2 + 1, k] = True
        j = j2 + 1
print('  solid voxels: %d' % vol.sum())

# ---------------------------------------------------------------- the colours
def role_of(r, g, b):
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if r > 120 and r - b > 60:  return 'lamp'        # the visor and chest lights
    if lum < 55:                return 'dark'        # outline, joints
    if lum < 105:               return 'metal'
    if lum < 165:               return 'shadowed'
    if lum < 215:               return 'body'
    return 'accent'

role_img = np.zeros(mask.shape, dtype=np.int8)
for y in range(mask.shape[0]):
    for x in range(mask.shape[1]):
        if mask[y, x]:
            r, g, b = sm[y, x]
            role_img[y, x] = ROLES.index(role_of(r, g, b))

# The drawing's bold black outline is a 2D convention: a line around the figure.
# Projected into 3D it becomes a dark SKIN over the model, and since a voxel's
# side faces take the colour of the column they sit behind, the outline column
# paints the whole left and right of the model black - which is why the first
# carve came out as a dark grey slab from every angle but dead ahead. So: any
# `dark` voxel within --erode of the background takes the role of the nearest
# painted pixel instead. Dark pixels deeper in (the joints) are left alone,
# because those are real shading, not an outline.
def shift(arr, dy, dx, fill=0):
    """arr moved by (dy, dx); what slides in from outside is `fill`."""
    out = np.full_like(arr, fill)
    y0, y1 = max(0, dy), min(arr.shape[0], arr.shape[0] + dy)
    x0, x1 = max(0, dx), min(arr.shape[1], arr.shape[1] + dx)
    out[y0:y1, x0:x1] = arr[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return out

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
if a.erode > 0:
    DARK = ROLES.index('dark')
    inner = mask.copy()                                   # peel `erode` layers off
    for _ in range(a.erode):
        keep = inner.copy()
        for dy, dx in N4: keep &= shift(inner, dy, dx, False)
        inner = keep
    rim = mask & ~inner                                   # ...what came off is the skin
    todo = rim & (role_img == DARK)
    n0 = int(todo.sum())
    known = mask & (role_img != DARK)                     # the painted pixels
    for _ in range(a.erode + 2):                          # flood them outward into it
        if not todo.any(): break
        for dy, dx in N4:
            take = todo & shift(known, dy, dx, False)
            if not take.any(): continue
            role_img[take] = shift(role_img, dy, dx)[take]
            known |= take
            todo &= ~take
    print('  outline eroded off %d skin pixels (%d left dark)' % (n0 - todo.sum(), todo.sum()))

# The drawing has far more detail than the grid can hold: panel seams and shading
# steps land on single voxels, and a voxel's colour is then smeared through the
# whole depth, so what was a crisp line in the picture becomes salt-and-pepper on
# the model. A majority vote over each 3x3 neighbourhood turns the noise back into
# flat plates - which is what armour is, and what survives the ASCII pass.
for _ in range(max(0, a.smooth)):
    counts = np.zeros((len(ROLES),) + mask.shape, dtype=np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            m = shift(mask, dy, dx, False)
            r = shift(role_img, dy, dx)
            w = 2 if (dy == 0 and dx == 0) else 1      # a pixel gets a vote and a half
            for ri in range(len(ROLES)):
                counts[ri] += ((r == ri) & m) * w
    # the visor is tiny and must not be voted away: lamp wins wherever it is drawn
    LAMP = ROLES.index('lamp')
    best = counts.argmax(axis=0).astype(np.int8)
    keep_lamp = mask & (role_img == LAMP)
    role_img = np.where(mask, best, 0).astype(np.int8)
    role_img[keep_lamp] = LAMP

role_grid = np.zeros((NY, NZ), dtype=np.int8)
for k in range(NZ):
    role_grid[:, k] = role_img[NZ - 1 - k, :]

# ---------------------------------------------------------------- the surface
# one quad per exposed voxel face, then greedy-merged into big rectangles per
# role (rasterCar culls by winding, so each is wound CCW seen from outside)
faces = []
def emit(axis, pos, u0, v0, u1, v1, role, positive):
    """a merged rectangle on `axis` at slice `pos`, spanning u0..u1 / v0..v1."""
    if axis == 0:    # +-x : u = y, v = z
        c = [(pos, u0, v0), (pos, u1, v0), (pos, u1, v1), (pos, u0, v1)]
        if not positive: c = [c[0], c[3], c[2], c[1]]
    elif axis == 1:  # +-y : u = x, v = z
        c = [(u0, pos, v0), (u0, pos, v1), (u1, pos, v1), (u1, pos, v0)]
        if not positive: c = [c[0], c[3], c[2], c[1]]
    else:            # +-z : u = x, v = y
        c = [(u0, v0, pos), (u1, v0, pos), (u1, v1, pos), (u0, v1, pos)]
        if not positive: c = [c[0], c[3], c[2], c[1]]
    faces.append([role] + [n for p in c for n in p])

def greedy(plane, axis, pos, positive):
    """merge a 2D grid of role-or--1 into as few rectangles as possible."""
    P = plane.copy()
    U, V = P.shape
    for u in range(U):
        for v in range(V):
            r = P[u, v]
            if r < 0: continue
            w = 1
            while u + w < U and P[u + w, v] == r: w += 1
            h = 1
            while v + h < V and (P[u:u + w, v + h] == r).all(): h += 1
            P[u:u + w, v:v + h] = -1
            emit(axis, pos, u, v, u + w, v + h, int(r), positive)

ROLE_AT = np.where(vol, role_grid[None, :, :], -1)
for axis in (0, 1, 2):
    size = vol.shape[axis]
    for pos in range(size + 1):
        below = np.take(vol, pos - 1, axis=axis) if pos > 0 else None
        above = np.take(vol, pos, axis=axis) if pos < size else None
        rb = np.take(ROLE_AT, pos - 1, axis=axis) if pos > 0 else None
        ra = np.take(ROLE_AT, pos, axis=axis) if pos < size else None
        # a face exists where solid meets air; it belongs to the solid voxel
        if below is not None:
            f = below & (~above if above is not None else True)
            greedy(np.where(f, rb, -1), axis, pos, True)
        if above is not None:
            f = above & (~below if below is not None else True)
            greedy(np.where(f, ra, -1), axis, pos, False)
print('  faces: %d' % len(faces))

# ---------------------------------------------------------------- emit
vox = a.height / NZ                               # world units per voxel
# feet on z=0, centred on the figure's own middle so it spins about itself
colsz = mask.any(axis=0)
jmid = (np.nonzero(colsz)[0].mean() + 0.5) if colsz.any() else NY / 2
lo = [-(NX / 2.0) * vox, -jmid * vox, 0.0]
data = {'res': NZ, 'vox': round(vox, 6), 'lo': [round(v, 5) for v in lo],
        'roles': ROLES, 'f': [int(v) for row in faces for v in row]}
key = '%s@%d' % (name, NZ)
js = ('// made by tools/sprite_voxelize.py from %s - do not edit\n'
      '(window.SPRITEVOX = window.SPRITEVOX || {})[%s] = %s;\n'
      % (os.path.basename(a.png), json.dumps(key), json.dumps(data, separators=(',', ':'))))
open(a.out, 'w').write(js)
print('  wrote %s  (%.1f KB)' % (a.out, os.path.getsize(a.out) / 1024))
