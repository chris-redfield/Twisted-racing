#!/usr/bin/env python3
"""
read_obj.py - minimal Wavefront .obj reader (numpy only), in the same shape as
read_3ds.py, so tools/car_voxelize.py can take an OBJ with NAMED OBJECTS and map
each one to a colour role.

    python3 tools/read_obj.py model.obj           # prints objects and materials
    from read_obj import read_obj                 # -> (objects, materials)
      objects:   [{'name', 'verts' (n,3), 'faces' (m,3), 'mat' [m] or None,
                   'uv' (m,3,2) or None}]
      materials: {name: (r, g, b) 0..255}   # from the sibling .mtl, if there is one

WHY NOT TRIMESH. car_voxelize.py loads most things with trimesh, but
`trimesh.load(force='mesh')` MERGES every object into one soup - and for a turret
the three objects (base / body / barrel) are exactly what we want to colour
differently. trimesh is also not currently importable in this environment at all
(anaconda ships a scipy built against numpy 1.x next to numpy 2.2), and a reader
this small is a better answer than pinning somebody's whole python install.

FACES are triangulated by fanning, which is right for the convex polygons a
modeller exports and close enough for the rest: this feeds a voxelizer that
samples triangle SURFACES, so a fan across a slightly concave quad moves a few
sample points, not a wall.

Vertex indices may be negative (relative to the end of the list so far), which is
rare but legal, and 'v' lines may carry a trailing colour, which is ignored.
"""
import os, sys
import numpy as np


def _mtl(path):
    """material name -> diffuse (r,g,b) 0..255, from a .mtl next to the .obj"""
    out = {}
    if not os.path.exists(path):
        return out
    name = None
    for line in open(path, errors='replace'):
        w = line.split()
        if not w:
            continue
        if w[0] == 'newmtl':
            name = ' '.join(w[1:])
        elif w[0] == 'Kd' and name and len(w) >= 4:
            out[name] = tuple(int(round(float(c) * 255)) for c in w[1:4])
    return out


def read_obj(path):
    V, VT = [], []                       # shared across objects, as the format says
    objs, cur = [], None

    def start(nm):
        nonlocal cur
        cur = {'name': nm, 'f': [], 'mat': [], 'uv': []}
        objs.append(cur)

    mtllib, mat = None, None
    for line in open(path, errors='replace'):
        w = line.split()
        if not w:
            continue
        k = w[0]
        if k == 'v':
            V.append([float(x) for x in w[1:4]])
        elif k == 'vt':
            VT.append([float(x) for x in w[1:3]])
        elif k in ('o', 'g'):
            start(' '.join(w[1:]) or 'object%d' % len(objs))
        elif k == 'usemtl':
            mat = ' '.join(w[1:])
        elif k == 'mtllib':
            mtllib = ' '.join(w[1:])
        elif k == 'f':
            if cur is None:
                start('object0')
            idx = []
            for tok in w[1:]:
                p = tok.split('/')
                vi = int(p[0])
                ti = int(p[1]) if len(p) > 1 and p[1] else 0
                idx.append((vi - 1 if vi > 0 else len(V) + vi,
                            (ti - 1 if ti > 0 else len(VT) + ti) if ti else -1))
            for i in range(1, len(idx) - 1):          # fan
                tri = (idx[0], idx[i], idx[i + 1])
                cur['f'].append([t[0] for t in tri])
                cur['uv'].append([t[1] for t in tri])
                cur['mat'].append(mat)

    verts = np.array(V, dtype=np.float64) if V else np.zeros((0, 3))
    uvs = np.array(VT, dtype=np.float64) if VT else np.zeros((0, 2))
    out = []
    for o in objs:
        if not o['f']:
            continue
        faces = np.array(o['f'], dtype=np.int64)
        ti = np.array(o['uv'], dtype=np.int64)
        # every object carries the WHOLE vertex table; the voxelizer only ever
        # looks at verts[faces], so there is nothing to gain by compacting it
        out.append({'name': o['name'], 'verts': verts, 'faces': faces,
                    'mat': o['mat'],
                    'uv': uvs[ti] if len(uvs) and (ti >= 0).all() else None})
    mats = _mtl(os.path.join(os.path.dirname(path), mtllib)) if mtllib else {}
    return out, mats


if __name__ == '__main__':
    objs, mats = read_obj(sys.argv[1])
    for o in objs:
        used = sorted({m or '-' for m in o['mat']})
        lo, hi = o['verts'][o['faces']].reshape(-1, 3).min(0), o['verts'][o['faces']].reshape(-1, 3).max(0)
        print('%-28s %6d tris  uv:%-3s  mats:%s' % (o['name'], len(o['faces']),
              'yes' if o['uv'] is not None else 'no', ','.join(used)))
        print('%-28s bbox %s .. %s' % ('', np.round(lo, 3).tolist(), np.round(hi, 3).tolist()))
    if mats:
        print('materials:', mats)
