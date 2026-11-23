#!/usr/bin/env python3
"""
read_fbx.py - minimal BINARY .fbx reader (numpy + zlib only), in the same shape
as read_3ds.py / read_obj.py, so tools/car_voxelize.py can take an FBX straight
from an asset pack.

    python3 tools/read_fbx.py model.fbx           # prints objects and materials
    from read_fbx import read_fbx                 # -> (objects, materials)
      objects:   [{'name', 'verts' (n,3), 'faces' (m,3), 'mat' [m] or None,
                   'uv' (m,3,2) or None}]
      materials: {name: (r, g, b) 0..255}

WHY THIS EXISTS. trimesh cannot read FBX at all (it needs Autodesk's closed SDK),
assimp and blender are not installed here, and asset packs ship FBX constantly -
turret-02 is FBX ONLY, three .rar files and not one .obj. So this is the reader
that lets the pipeline take that whole class of download.

ASCII FBX is NOT handled (it announces itself and this raises); every pack seen
so far is binary.

THE FORMAT, as much of it as matters
------------------------------------
A 27-byte header ("Kaydara FBX Binary  ", 0x1a 0x00, then a uint32 version),
then a tree of node records:

    EndOffset, NumProperties, PropertyListLen   (uint32 each, or uint64 if >= 7500)
    NameLen (uint8), Name
    properties..., then nested nodes until EndOffset

A property is a type byte then its data: YCIFDL are scalars, `fdlib` are ARRAYS
(length, encoding, compressed length, then raw or zlib'd), S and R are byte
strings. Version 7500 widening those three header fields to 64 bits is the one
trap - read them as 32-bit and every offset past the first node is nonsense.

Geometry lives in Objects/Geometry:
  * Vertices            - flat xyz doubles
  * PolygonVertexIndex  - vertex indices; the LAST index of each polygon is
                          stored as ~i (negative), which is how polygons are
                          delimited. Fanned into triangles here.
  * LayerElementUV      - UV + UVIndex, by ByPolygonVertex or ByControlPoint
  * LayerElementMaterial- per-polygon material slot (or one for the whole mesh)

...and the NAME and the PLACEMENT come from elsewhere: a Geometry is wired to a
Model by Connections ("OO", child, parent), the Model holds the name and the
Lcl Translation/Rotation/Scaling, and Models nest. So a part sitting a metre off
the origin is only in the right place once that chain is walked - which is why
this does walk it, rather than trusting the vertices.
"""
import os, struct, sys, zlib
import numpy as np


class Node:
    __slots__ = ('name', 'props', 'kids')

    def __init__(self, name, props, kids):
        self.name, self.props, self.kids = name, props, kids

    def find(self, name):
        for k in self.kids:
            if k.name == name:
                return k
        return None

    def findall(self, name):
        return [k for k in self.kids if k.name == name]


def _prop(buf, p):
    t = buf[p:p + 1].decode('ascii', 'replace')
    p += 1
    if t in 'YCIFDL':
        fmt = {'Y': '<h', 'C': '<?', 'I': '<i', 'F': '<f', 'D': '<d', 'L': '<q'}[t]
        n = struct.calcsize(fmt)
        return struct.unpack_from(fmt, buf, p)[0], p + n
    if t in 'fdlib':
        ln, enc, clen = struct.unpack_from('<III', buf, p)
        p += 12
        raw = buf[p:p + clen]
        p += clen
        if enc == 1:
            raw = zlib.decompress(raw)
        dt = {'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': 'i1'}[t]
        return np.frombuffer(raw, dtype=dt, count=ln), p
    if t in 'SR':
        ln = struct.unpack_from('<I', buf, p)[0]
        p += 4
        v = buf[p:p + ln]
        return (v.decode('utf-8', 'replace') if t == 'S' else v), p + ln
    raise ValueError('unknown FBX property type %r at %d' % (t, p - 1))


def _nodes(buf, p, end, wide):
    """read sibling records until the NULL record (all-zero header)"""
    out = []
    hdr = '<QQQ' if wide else '<III'
    hn = struct.calcsize(hdr)
    while p + hn + 1 <= end:
        endoff, nprops, plen = struct.unpack_from(hdr, buf, p)
        namelen = buf[p + hn]
        if endoff == 0:                                  # the NULL record: list over
            break
        q = p + hn + 1
        name = buf[q:q + namelen].decode('utf-8', 'replace')
        q += namelen
        props = []
        pend = q + plen
        while q < pend:
            v, q = _prop(buf, q)
            props.append(v)
        kids = _nodes(buf, pend, endoff, wide) if pend < endoff else []
        out.append(Node(name, props, kids))
        p = endoff
    return out


def parse(path):
    buf = open(path, 'rb').read()
    if not buf.startswith(b'Kaydara FBX Binary'):
        raise ValueError('not a binary FBX (ASCII FBX is not supported): ' + path)
    ver = struct.unpack_from('<I', buf, 23)[0]
    return Node('root', [ver], _nodes(buf, 27, len(buf), ver >= 7500)), ver


# ---------------------------------------------------------------- transforms
def _props70(node):
    """Properties70 -> {name: [values...]}"""
    out = {}
    p70 = node.find('Properties70') if node else None
    if not p70:
        return out
    for p in p70.findall('P'):
        if p.props:
            out[p.props[0]] = p.props[4:]
    return out


ORDERS = ['XYZ', 'XZY', 'YZX', 'YXZ', 'ZXY', 'ZYX']


def _euler(rx, ry, rz, order=0):
    """Euler degrees -> 3x3. FBX's default eEulerXYZ applies X, then Y, then Z, each
    in the PARENT frame, which composes as Rz @ Ry @ Rx - the first axis applied is
    the rightmost factor. The other five orders are the same three factors reordered.
    PreRotation and PostRotation are always XYZ regardless of RotationOrder."""
    cx, sx, cy, sy, cz, sz = (np.cos(np.radians(rx)), np.sin(np.radians(rx)),
                              np.cos(np.radians(ry)), np.sin(np.radians(ry)),
                              np.cos(np.radians(rz)), np.sin(np.radians(rz)))
    R = {'X': np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]),
         'Y': np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]),
         'Z': np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])}
    M = np.eye(3)
    for ch in ORDERS[order] if 0 <= order < len(ORDERS) else 'XYZ':
        M = R[ch] @ M
    return M


def _vec(props, key, d):
    v = [float(x) for x in (list(props.get(key, [])) + list(d))[:3]]
    return v


def _scalar(props, key, d=0.0):
    v = props.get(key) or [d]
    try:
        return float(v[0])
    except (TypeError, ValueError):
        return d


def _T(v):
    M = np.eye(4); M[:3, 3] = v; return M


def _R(r, order=0):
    M = np.eye(4); M[:3, :3] = _euler(*r, order=order); return M


def _S(s):
    M = np.eye(4); M[:3, :3] = np.diag(s); return M


def _matrix(props, geometric=False):
    """One node's local matrix.

    FBX does NOT compose a node as plain translate-rotate-scale. The real chain is

        T * Roff * Rp * Rpre * R * Rpost^-1 * Rp^-1 * Soff * Sp * S * Sp^-1

    and the factor that matters most in practice is **Rpre (`PreRotation`)**. A 3ds
    Max export carries `UpAxis: Y` with `OriginalUpAxis: Z` and hangs the -90 degree
    X conversion off EVERY node's PreRotation: the mesh data is still Z-up, the
    `Lcl Translation` beside it is already Y-up, and PreRotation is the only thing
    reconciling the two. Read just `Lcl *` and each part lands 90 degrees out of its
    own placement - which is how turret-02 first came through with its base ring
    standing on edge while the body stacked up +y and the gimbal flew off entirely.
    Pre/PostRotation only count when `RotationActive` is set; that is the SDK rule,
    not an optimisation, and a node with a stale PreRotation and the flag off really
    does want it ignored.

    `geometric=True` returns the Geometric* transform instead, which sits BELOW the
    node (world = node @ geometric) and takes no pivots and no pre-rotation."""
    if geometric:
        return (_T(_vec(props, 'GeometricTranslation', [0, 0, 0]))
                @ _R(_vec(props, 'GeometricRotation', [0, 0, 0]))
                @ _S(_vec(props, 'GeometricScaling', [1, 1, 1])))
    order = int(_scalar(props, 'RotationOrder', 0))
    active = _scalar(props, 'RotationActive', 0) != 0
    neg = lambda v: [-x for x in v]
    Rp, Sp = _vec(props, 'RotationPivot', [0, 0, 0]), _vec(props, 'ScalingPivot', [0, 0, 0])
    pre = _vec(props, 'PreRotation', [0, 0, 0]) if active else [0, 0, 0]
    post = _vec(props, 'PostRotation', [0, 0, 0]) if active else [0, 0, 0]
    return (_T(_vec(props, 'Lcl Translation', [0, 0, 0]))
            @ _T(_vec(props, 'RotationOffset', [0, 0, 0])) @ _T(Rp)
            @ _R(pre) @ _R(_vec(props, 'Lcl Rotation', [0, 0, 0]), order)
            @ _R(post).T                                 # Rpost^-1; a rotation's inverse is its transpose
            @ _T(neg(Rp))
            @ _T(_vec(props, 'ScalingOffset', [0, 0, 0])) @ _T(Sp)
            @ _S(_vec(props, 'Lcl Scaling', [1, 1, 1])) @ _T(neg(Sp)))


# ---------------------------------------------------------------- geometry
def _tris(poly):
    """PolygonVertexIndex -> (tri vertex indices, index into the flat polygon-vertex
    list for each corner, polygon number for each triangle)"""
    pv = np.asarray(poly, dtype=np.int64)
    end = pv < 0
    vidx = np.where(end, ~pv, pv)
    starts = np.concatenate(([0], np.flatnonzero(end)[:-1] + 1))
    stops = np.flatnonzero(end) + 1
    tri, corner, pnum = [], [], []
    for pi, (a, b) in enumerate(zip(starts, stops)):
        n = b - a
        for i in range(1, n - 1):
            tri.append([vidx[a], vidx[a + i], vidx[a + i + 1]])
            corner.append([a, a + i, a + i + 1])
            pnum.append(pi)
    return (np.array(tri, dtype=np.int64).reshape(-1, 3),
            np.array(corner, dtype=np.int64).reshape(-1, 3),
            np.array(pnum, dtype=np.int64))


def _layer(geo, kind, data_name, index_name):
    """one LayerElement* -> (values, index or None, mapping, reference)"""
    el = geo.find(kind)
    if el is None:
        return None, None, '', ''
    d = el.find(data_name)
    i = el.find(index_name) if index_name else None
    mapping = el.find('MappingInformationType')
    ref = el.find('ReferenceInformationType')
    return (np.asarray(d.props[0]) if d and len(d.props) else None,
            np.asarray(i.props[0]) if i and len(i.props) else None,
            mapping.props[0] if mapping and mapping.props else '',
            ref.props[0] if ref and ref.props else '')


def read_fbx(path):
    root, ver = parse(path)
    objects = root.find('Objects')
    conns = root.find('Connections')
    if objects is None:
        return [], {}

    geos, models, mats = {}, {}, {}
    for n in objects.kids:
        if not n.props or not isinstance(n.props[0], int):
            continue
        oid = n.props[0]
        nm = n.props[1].split('\x00')[0] if len(n.props) > 1 and isinstance(n.props[1], str) else ''
        if n.name == 'Geometry':
            geos[oid] = (nm, n)
        elif n.name == 'Model':
            models[oid] = (nm, n)
        elif n.name == 'Material':
            p = _props70(n)
            c = p.get('DiffuseColor') or p.get('Diffuse') or [0.5, 0.5, 0.5]
            mats[oid] = (nm, tuple(int(round(float(x) * 255)) for x in (list(c) + [0.5, 0.5, 0.5])[:3]))

    child_of, mat_of = {}, {}
    if conns is not None:
        for c in conns.findall('C'):
            if len(c.props) >= 3 and c.props[0] == 'OO':
                a, b = c.props[1], c.props[2]
                if a in mats and b in models:
                    mat_of.setdefault(b, []).append(a)
                else:
                    child_of[a] = b

    def world(mid, seen=()):
        """compose Lcl transforms up the Model chain"""
        if mid not in models or mid in seen:
            return np.eye(4)
        nm, node = models[mid]
        M = _matrix(_props70(node))
        parent = child_of.get(mid)
        return (world(parent, seen + (mid,)) @ M) if parent in models else M

    out = {}
    for gid, (gname, geo) in geos.items():
        vnode = geo.find('Vertices')
        pnode = geo.find('PolygonVertexIndex')
        if vnode is None or pnode is None or not len(vnode.props) or not len(pnode.props):
            continue
        verts = np.asarray(vnode.props[0], dtype=np.float64).reshape(-1, 3)
        faces, corner, pnum = _tris(pnode.props[0])
        if not len(faces):
            continue

        mid = child_of.get(gid)
        name = (models.get(mid, (gname, None))[0] or gname or 'geometry%d' % gid)
        M = world(mid) if mid in models else np.eye(4)
        gm = _matrix(_props70(models[mid][1]), geometric=True) if mid in models else np.eye(4)
        T = M @ gm
        if not np.allclose(T, np.eye(4)):
            verts = verts @ T[:3, :3].T + T[:3, 3]

        # ---- material per triangle
        mnames = [mats[m][0] for m in mat_of.get(mid, []) if m in mats]
        mvals, _, mmap, _ = _layer(geo, 'LayerElementMaterial', 'Materials', None)
        if mvals is None or not len(mvals):
            per_tri = [mnames[0] if mnames else None] * len(faces)
        elif mmap == 'AllSame' or len(mvals) == 1:
            s = int(mvals[0])
            per_tri = [mnames[s] if s < len(mnames) else None] * len(faces)
        else:
            slot = np.asarray(mvals, dtype=np.int64)[pnum]
            per_tri = [mnames[s] if 0 <= s < len(mnames) else None for s in slot]

        # ---- uv per triangle corner
        uv = None
        uvv, uvi, umap, uref = _layer(geo, 'LayerElementUV', 'UV', 'UVIndex')
        if uvv is not None and len(uvv):
            uvv = np.asarray(uvv, dtype=np.float64).reshape(-1, 2)
            if umap == 'ByControlPoint':
                src = uvi[faces] if uvi is not None and len(uvi) else faces
            else:                                        # ByPolygonVertex
                src = uvi[corner] if uvi is not None and len(uvi) else corner
            if src.max() < len(uvv):
                uv = uvv[src]

        rec = {'name': name, 'verts': verts, 'faces': faces, 'mat': per_tri, 'uv': uv}
        # two geometries can share a Model name; keep both, numbered
        key = name if name not in out else '%s#%d' % (name, len(out))
        out[key] = rec
        rec['name'] = key
    return list(out.values()), {nm: c for nm, c in mats.values()}


if __name__ == '__main__':
    objs, mats = read_fbx(sys.argv[1])
    for o in objs:
        v = o['verts'][o['faces']].reshape(-1, 3)
        used = sorted({m or '-' for m in o['mat']})
        print('%-34s %6d tris  uv:%-3s  mats:%s' % (o['name'], len(o['faces']),
              'yes' if o['uv'] is not None else 'no', ','.join(used)))
        print('%-34s bbox %s .. %s' % ('', np.round(v.min(0), 3).tolist(), np.round(v.max(0), 3).tolist()))
    if mats:
        print('materials:', list(mats))
