#!/usr/bin/env python3
"""
car_voxelize.py - turn a multi-part car mesh into a voxel car for the game's
software rasteriser (rasterCar in index.html).

Pipeline:
  1. load each part (STL/OBJ via trimesh, or glTF nodes by name), tag it with a colour ROLE
     (body / accent / shadowed / dark / glass / tyre / metal / lamp / tail),
     so the car still takes any livery. A textured part instead classifies its texture
     colour at every sample point (paint/white/black/grey/red -> roles, see `classes`);
     each voxel takes the majority, and fixed-role parts win over textured ones
  2. optional wheel instancing: CAD exports often hold ONE wheel at the origin
  3. move into car space (+x nose, +y right, +z up, wheels on z=0) and scale to
     LENGTH game units
  4. voxelize the surfaces (dense point sampling; a voxel takes the role of the
     highest-priority part that touches it), then fill the inside: everything the
     outside air can't reach is solid
  5. emit only faces between solid and outside air, greedy-merged per role into
     big quads, wound counter-clockwise from outside (rasterCar culls by winding)

Output: a JS file  `VOXCARS["name@res"] = { vox, lo:[x,y,z], roles:[...], f:[role, 4 corners as integer grid x,y,z ...] }`
        (car-space point = lo + corner*vox)

Usage (recipe in a JSON file, see tools/cars/aspen.json):
  python car_voxelize.py tools/cars/aspen.json --res 64 -o assets/voxcars/aspen.js
"""
import argparse, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import trimesh
from collections import deque

ROLE_PRIORITY = ['lamp', 'tail', 'glass', 'metal', 'tyre', 'dark', 'accent', 'shadowed', 'body']


AXIS = {'+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1]}


class Part:
    """triangles (n,3,3) in source units; either a fixed role, or a texture + uv (n,3,2)
    whose colours get classified into roles through `classes`"""
    def __init__(self, name, tris, role=None, uv=None, image=None, classes=None):
        self.name, self.tris, self.role, self.uv, self.image, self.classes = name, tris, role, uv, image, classes


def classify(rgb, classes):
    """texture colours -> role names. Classes: red (tail lights), black, white, grey, paint (anything saturated)."""
    r, g, b = [rgb[:, i].astype(np.float32) for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = (mx - mn) / (mx + 1)
    out = np.full(len(r), classes.get('grey', 'metal'), dtype=object)
    out[(sat < 0.25) & (lum > 165)] = classes.get('white', 'accent')
    dark = classes.get('black_lum', 48)                          # below this luminance counts as black
    out[lum < dark] = classes.get('black', 'dark')
    out[(sat >= 0.35) & (lum >= dark)] = classes.get('paint', 'body')
    out[(r > 110) & (r - g > 60) & (r - b > 50)] = classes.get('red', 'tail')
    return out


def load_parts(recipe, base):
    out = []
    for p in recipe['parts']:
        path = os.path.join(base, p['file'])
        if path.lower().endswith('.3ds'):                         # .3ds: pick objects, map materials -> roles
            from read_3ds import read_3ds
            objs, _ = read_3ds(path)
            for o in objs:
                if o['name'] not in p['objects']: continue
                mats = np.array([m or '' for m in o['mat']])
                for mname, role in p['materials'].items():
                    sel = mats == mname
                    if sel.any():
                        tris = o['verts'][o['faces'][sel]] + np.asarray(p.get('offset', [0, 0, 0]), float)
                        out.append(Part(o['name'] + ':' + mname, tris, role))
            continue
        if 'nodes' in p:                                         # glTF scene: pick nodes by name prefix, keep transforms + texture
            sc = trimesh.load(path)
            for node in sc.graph.nodes_geometry:
                if not any(node.startswith(k) for k in p['nodes']): continue
                T, gname = sc.graph[node]
                g = sc.geometry[gname]
                tris = trimesh.transform_points(g.vertices, T)[g.faces]
                uv = img = None
                if 'classes' in p and getattr(g.visual, 'uv', None) is not None:
                    uv = g.visual.uv[g.faces]
                    img = np.asarray(g.visual.material.baseColorTexture.convert('RGB'))
                out.append(Part(node, tris, p.get('role'), uv, img, p.get('classes')))
            continue
        m = trimesh.load(path, force='mesh')
        tris = m.vertices[m.faces].astype(np.float64)            # (n,3,3)
        if 'rotate' in p:                                        # [axis, deg] about the part's own origin
            ax, deg = p['rotate']
            R = trimesh.transformations.rotation_matrix(np.radians(deg), {'x': [1,0,0], 'y': [0,1,0], 'z': [0,0,1]}[ax])[:3, :3]
            tris = tris @ R.T
        for off in p.get('at', [[0, 0, 0]]):                     # instances (wheels)
            out.append(Part(p['file'], tris + np.asarray(off, float), p['role']))
    return out


def to_car_space(parts, recipe):
    """rotate so the nose is +x and up is +z (a proper rotation, never a mirror), centre, scale to `length`"""
    fwd = np.array(AXIS[recipe.get('nose', '+x')], float)
    up = np.array(AXIS[recipe.get('up', '+z')], float)
    R = np.stack([fwd, np.cross(up, fwd), up])                   # rows: car x, y, z in source coords
    for p in parts: p.tris = p.tris @ R.T
    allv = np.concatenate([p.tris.reshape(-1, 3) for p in parts])
    lo, hi = allv.min(0), allv.max(0)
    k = recipe['length'] / (hi[0] - lo[0])
    shift = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    for p in parts: p.tris = (p.tris - shift) * k
    return parts, k


def sample_tris(tris, step, uv=None):
    """points on every triangle, spaced < step apart (barycentric grid per triangle); uv interpolated alongside"""
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    elen = np.maximum.reduce([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1), np.linalg.norm(a - c, axis=1)])
    n = np.clip(np.ceil(elen / step).astype(int), 1, 400)
    pts, uvs = [], []
    for N in np.unique(n):
        sel = n == N
        i, j = np.meshgrid(np.arange(N + 1), np.arange(N + 1), indexing='ij')
        m = (i + j) <= N
        u, w = i[m] / N, j[m] / N                                # (k,)
        A, B, C = a[sel], b[sel], c[sel]
        pts.append((A[:, None] + (B - A)[:, None] * u[None, :, None] + (C - A)[:, None] * w[None, :, None]).reshape(-1, 3))
        if uv is not None:
            UA, UB, UC = uv[sel, 0], uv[sel, 1], uv[sel, 2]
            uvs.append((UA[:, None] + (UB - UA)[:, None] * u[None, :, None] + (UC - UA)[:, None] * w[None, :, None]).reshape(-1, 2))
    return np.concatenate(pts), (np.concatenate(uvs) if uv is not None else None)


def voxelize(parts, res, length, smooth=0):
    vox = length / res
    allv = np.concatenate([p.tris.reshape(-1, 3) for p in parts])
    lo = allv.min(0) - vox * 1.5
    dims = np.ceil((allv.max(0) + vox * 1.5 - lo) / vox).astype(int)
    NR = len(ROLE_PRIORITY)
    votes = np.zeros(tuple(dims) + (NR,), np.int32)               # textured parts: majority vote per voxel
    pri = np.full(dims, 255, np.uint8)                           # fixed-role parts: priority, and they beat texture
    for p in parts:
        P, UV = sample_tris(p.tris.reshape(-1, 3, 3), vox * 0.45, p.uv if p.image is not None else None)
        idx = np.clip(np.floor((P - lo) / vox).astype(int), 0, dims - 1)
        if p.image is not None:
            H, W = p.image.shape[:2]
            tx = np.clip((np.mod(UV[:, 0], 1) * (W - 1)).astype(int), 0, W - 1)
            ty = np.clip(((1 - np.mod(UV[:, 1], 1)) * (H - 1)).astype(int), 0, H - 1)
            roles = classify(p.image[ty, tx], p.classes)
            ri = np.array([ROLE_PRIORITY.index(r) for r in roles], np.int64)
            np.add.at(votes, (idx[:, 0], idx[:, 1], idx[:, 2], ri), 1)
        else:
            np.minimum.at(pri, (idx[:, 0], idx[:, 1], idx[:, 2]), np.uint8(ROLE_PRIORITY.index(p.role)))
    voted = votes.sum(-1) > 0
    raw = votes
    for _ in range(smooth):                                      # majority over the 3x3x3 neighbourhood: kills decal speckle
        pad = np.pad(votes, ((1, 1), (1, 1), (1, 1), (0, 0)))
        acc = np.zeros_like(votes)
        for dx in range(3):
            for dy in range(3):
                for dz in range(3):
                    acc += pad[dx:dx + dims[0], dy:dy + dims[1], dz:dz + dims[2]]
        votes = np.where(voted[..., None], acc, 0)
    take = voted & (pri == 255)
    pri[take] = votes[take].argmax(-1).astype(np.uint8)
    for small in ('lamp', 'tail'):                               # lights are small: smoothing must not erase them
        r = ROLE_PRIORITY.index(small)
        keep = take & (raw[..., r] * 3 >= raw.sum(-1)) & (raw[..., r] > 0)
        pri[keep] = r
    shell = pri != 255
    # outside air: flood from the border through empty cells (6-connected)
    outside = np.zeros(dims, bool)
    q = deque()
    for x in (0, dims[0] - 1):
        for y in range(dims[1]):
            for z in range(dims[2]): q.append((x, y, z))
    for y in (0, dims[1] - 1):
        for x in range(dims[0]):
            for z in range(dims[2]): q.append((x, y, z))
    for z in (0, dims[2] - 1):
        for x in range(dims[0]):
            for y in range(dims[1]): q.append((x, y, z))
    while q:
        x, y, z = q.pop()
        if outside[x, y, z] or shell[x, y, z]: continue
        outside[x, y, z] = True
        if x > 0: q.append((x - 1, y, z))
        if x < dims[0] - 1: q.append((x + 1, y, z))
        if y > 0: q.append((x, y - 1, z))
        if y < dims[1] - 1: q.append((x, y + 1, z))
        if z > 0: q.append((x, y, z - 1))
        if z < dims[2] - 1: q.append((x, y, z + 1))
    solid = ~outside
    # sealed-in cells nobody touched take the role of the nearest shell above them (body by default)
    pri[solid & ~shell] = ROLE_PRIORITY.index('body')
    return solid, outside, pri, lo, vox


def greedy_faces(solid, outside, pri, lo, vox):
    """exposed faces, merged into rectangles per (direction, slice, role)"""
    faces = []
    dims = solid.shape
    for axis in range(3):
        for sgn in (1, -1):
            # face exists where cell solid and neighbour (axis, sgn) is outside air
            nb = np.zeros(dims, bool)
            sl_src = [slice(None)] * 3; sl_dst = [slice(None)] * 3
            if sgn > 0: sl_src[axis] = slice(1, None); sl_dst[axis] = slice(0, -1)
            else:       sl_src[axis] = slice(0, -1);  sl_dst[axis] = slice(1, None)
            nb[tuple(sl_dst)] = outside[tuple(sl_src)]
            exp = solid & nb
            u, v = [a for a in range(3) if a != axis]
            for s in range(dims[axis]):
                take = [slice(None)] * 3; take[axis] = s
                m = exp[tuple(take)].copy()                    # 2D (u,v)
                if not m.any(): continue
                roles = pri[tuple(take)]
                H, W = m.shape
                for i in range(H):
                    j = 0
                    while j < W:
                        if not m[i, j]: j += 1; continue
                        r = roles[i, j]
                        w = 1
                        while j + w < W and m[i, j + w] and roles[i, j + w] == r: w += 1
                        h = 1
                        while i + h < H and all(m[i + h, j + k] and roles[i + h, j + k] == r for k in range(w)): h += 1
                        m[i:i + h, j:j + w] = False
                        # rectangle cells [i,i+h) x [j,j+w) on plane at s (+1 if sgn>0)
                        pl = s + (1 if sgn > 0 else 0)
                        corners = []
                        for (du, dv) in ((0, 0), (h, 0), (h, w), (0, w)):
                            p = [0, 0, 0]; p[axis] = pl; p[u] = i + du; p[v] = j + dv
                            corners.append(p)
                        # winding: (u,v) order gives normal +axis when (u,v,axis) is right-handed
                        rh = (u, v, axis) in ((0, 1, 2), (1, 2, 0), (2, 0, 1))
                        if (sgn > 0) != rh: corners.reverse()
                        pts = corners                                # integer grid corners; world = lo + p*vox
                        faces.append((ROLE_PRIORITY[r], pts))
                        j += w
    return faces


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('recipe')
    ap.add_argument('--res', type=int, default=64, help='voxels along the car length')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--name', default=None)
    a = ap.parse_args()
    recipe = json.load(open(a.recipe))
    base = os.path.join(os.path.dirname(a.recipe), recipe.get('dir', '.'))
    t0 = time.time()
    parts = load_parts(recipe, base)
    parts, k = to_car_space(parts, recipe)
    print('parts:', ', '.join(f'{p.name}({len(p.tris)})' for p in parts))
    solid, outside, pri, lo, vox = voxelize(parts, a.res, recipe['length'], recipe.get('smooth', 0))
    t1 = time.time()
    faces = greedy_faces(solid, outside, pri, lo, vox)
    t2 = time.time()
    roles = sorted({r for r, _ in faces}, key=ROLE_PRIORITY.index)
    flat = []
    for r, pts in faces:
        flat.append(roles.index(r))
        for p in pts: flat.extend(p)
    allp = lo + np.array([p for _, pts in faces for p in pts]) * vox
    name = a.name or recipe.get('name') or os.path.splitext(os.path.basename(a.recipe))[0]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as f:
        f.write('// generated by tools/car_voxelize.py from %s, res %d - do not edit\n' % (os.path.basename(a.recipe), a.res))
        f.write('(window.VOXCARS = window.VOXCARS || {})[%s] = %s;\n' % (
            json.dumps(name + '@' + str(a.res)),
            json.dumps({'res': a.res, 'vox': round(vox, 5), 'lo': [round(float(x), 4) for x in lo], 'roles': roles, 'f': [int(x) for x in flat]}, separators=(',', ':'))))
    print('grid %s  solid %d  faces %d  bbox %s..%s  voxelize %.1fs merge %.1fs  -> %s (%.0f KB)' % (
        'x'.join(map(str, solid.shape)), solid.sum(), len(faces),
        np.round(allp.min(0), 1).tolist(), np.round(allp.max(0), 1).tolist(),
        t1 - t0, t2 - t1, a.out, os.path.getsize(a.out) / 1024))
    print('faces per role:', {r: sum(1 for q, _ in faces if q == r) for r in roles})


if __name__ == '__main__':
    main()
