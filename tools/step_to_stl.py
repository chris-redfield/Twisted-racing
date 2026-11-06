#!/usr/bin/env python3
"""step_to_stl.py SRC_DIR OUT_DIR - mesh every *.stp in SRC_DIR to STL with gmsh (OpenCascade).
pip install gmsh; on WSL gmsh also wants libGLU/libOpenGL (apt download + LD_LIBRARY_PATH works without sudo)."""
import gmsh, sys, os, glob
src, out = sys.argv[1], sys.argv[2]
gmsh.initialize(); gmsh.option.setNumber("General.Terminal",0)
for f in sorted(glob.glob(os.path.join(src,"*.stp"))):
    name=os.path.basename(f)[:-4]
    gmsh.clear(); gmsh.model.add(name)
    try:
        gmsh.model.occ.importShapes(f); gmsh.model.occ.synchronize()
        bb=gmsh.model.getBoundingBox(-1,-1)
        size=max(bb[3]-bb[0],bb[4]-bb[1],bb[5]-bb[2])
        gmsh.option.setNumber("Mesh.MeshSizeMax", size/40)
        gmsh.option.setNumber("Mesh.Algorithm", 6)
        gmsh.model.mesh.generate(2)
        gmsh.write(os.path.join(out,name+".stl"))
        nt=sum(len(t)//3 for _,t in [gmsh.model.mesh.getElementsByType(2)])
        print(f"{name:14s} tris={nt:7d} bbox=({bb[0]:.0f},{bb[1]:.0f},{bb[2]:.0f})..({bb[3]:.0f},{bb[4]:.0f},{bb[5]:.0f})", flush=True)
    except Exception as e: print(name,"FAIL",e, flush=True)
gmsh.finalize()
