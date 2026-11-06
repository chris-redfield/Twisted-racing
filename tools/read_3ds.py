#!/usr/bin/env python3
"""
read_3ds.py - minimal Autodesk .3ds reader (no dependencies beyond numpy).

Reads mesh objects (vertices, faces, per-face material) and materials (name, diffuse
colour). Vertices in a .3ds file are already in world space, so the local matrix
chunk is ignored.

    python read_3ds.py model.3ds          # prints objects and materials
    from read_3ds import read_3ds          # -> (objects, materials)
      objects:   [{'name', 'verts' (n,3), 'faces' (m,3), 'mat' [m] material name or None}]
      materials: {name: (r, g, b) 0..255}
"""
import struct, sys
import numpy as np

MAIN, EDIT, OBJECT, TRIMESH, VERTS, FACES, FACEMAT = 0x4D4D, 0x3D3D, 0x4000, 0x4100, 0x4110, 0x4120, 0x4130
MATERIAL, MATNAME, DIFFUSE = 0xAFFF, 0xA000, 0xA020
RGB_F, RGB_B, RGB_B_GAMMA, RGB_F_GAMMA = 0x0010, 0x0011, 0x0012, 0x0013


def _chunks(buf, start, end):
    p = start
    while p + 6 <= end:
        cid, ln = struct.unpack_from('<HI', buf, p)
        if ln < 6 or p + ln > end: break
        yield cid, p + 6, p + ln
        p += ln


def _cstr(buf, p):
    e = buf.index(b'\0', p)
    return buf[p:e].decode('latin1'), e + 1


def _colour(buf, s, e):
    for cid, cs, ce in _chunks(buf, s, e):
        if cid in (RGB_B, RGB_B_GAMMA): return tuple(buf[cs:cs + 3])
        if cid in (RGB_F, RGB_F_GAMMA): return tuple(int(255 * v) for v in struct.unpack_from('<3f', buf, cs))
    return (128, 128, 128)


def read_3ds(path):
    buf = open(path, 'rb').read()
    objects, materials = [], {}
    for cid, s, e in _chunks(buf, 0, len(buf)):
        if cid != MAIN: continue
        for cid2, s2, e2 in _chunks(buf, s, e):
            if cid2 != EDIT: continue
            for cid3, s3, e3 in _chunks(buf, s2, e2):
                if cid3 == MATERIAL:
                    name, col = None, (128, 128, 128)
                    for c4, s4, e4 in _chunks(buf, s3, e3):
                        if c4 == MATNAME: name, _ = _cstr(buf, s4)
                        elif c4 == DIFFUSE: col = _colour(buf, s4, e4)
                    if name is not None: materials[name] = col
                elif cid3 == OBJECT:
                    oname, p = _cstr(buf, s3)
                    for c4, s4, e4 in _chunks(buf, p, e3):
                        if c4 != TRIMESH: continue
                        verts = faces = None; mats = None
                        for c5, s5, e5 in _chunks(buf, s4, e4):
                            if c5 == VERTS:
                                n, = struct.unpack_from('<H', buf, s5)
                                verts = np.frombuffer(buf, '<f4', n * 3, s5 + 2).reshape(n, 3).astype(np.float64)
                            elif c5 == FACES:
                                n, = struct.unpack_from('<H', buf, s5)
                                faces = np.frombuffer(buf, '<u2', n * 4, s5 + 2).reshape(n, 4)[:, :3].astype(np.int64)
                                mats = [None] * n
                                for c6, s6, e6 in _chunks(buf, s5 + 2 + n * 8, e5):
                                    if c6 == FACEMAT:
                                        mname, q = _cstr(buf, s6)
                                        k, = struct.unpack_from('<H', buf, q)
                                        for fi in np.frombuffer(buf, '<u2', k, q + 2): mats[fi] = mname
                        if verts is not None and faces is not None and len(faces):
                            objects.append({'name': oname, 'verts': verts, 'faces': faces, 'mat': mats})
    return objects, materials


if __name__ == '__main__':
    objs, mats = read_3ds(sys.argv[1])
    allv = np.concatenate([o['verts'] for o in objs])
    print('%d objects, %d faces, bbox %s .. %s' % (len(objs), sum(len(o['faces']) for o in objs),
          allv.min(0).round(1).tolist(), allv.max(0).round(1).tolist()))
    print('materials:')
    for k, v in mats.items(): print('  %-28s %s' % (k, v))
    print('objects:')
    for o in objs:
        used = sorted({m for m in o['mat'] if m}, key=str)
        print('  %-24s faces %6d  bbox %s..%s  mats %s' % (o['name'], len(o['faces']),
              o['verts'].min(0).round(0).tolist(), o['verts'].max(0).round(0).tolist(), used))
