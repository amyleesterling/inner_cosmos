#!/usr/bin/env python
"""Add the cerebellum (left + right cortex) to the human-brain scene.

Loads the FreeSurfer subcortical OBJ files for the cerebellum cortex and
applies the SAME center + scale + axis transform that was used on the
cortical pial surface in extract-human-brain.py, so the cerebellum lands
in the right place under the back of the cortex.

Inputs (hard-coded):
  Left-Cerebellum-Cortex.obj
  Right-Cerebellum-Cortex.obj

Output:
  public/meshes/human-cerebellum.glb

The transform parameters come from public/meshes/human-brain.json (the
manifest written by extract-human-brain.py). Don't hand-edit those — if
the cortex re-extracts with a new center/scale, just rerun this script.
"""
import os
import json
import sys
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = r"C:\Users\amyle\Downloads\human brain subcortical_obj\subcortical_obj"
SRC_LH = os.path.join(SRC_DIR, "Left-Cerebellum-Cortex.obj")
SRC_RH = os.path.join(SRC_DIR, "Right-Cerebellum-Cortex.obj")

OUT_DIR = os.path.join(ROOT, "public", "meshes")
OUT_GLB = os.path.join(OUT_DIR, "human-cerebellum.glb")
HUMAN_MANIFEST = os.path.join(OUT_DIR, "human-brain.json")

TARGET_FACES = 60000  # cerebellum is smaller than cortex; 60K reads fine


def load_hemi(path: str) -> trimesh.Trimesh:
    print(f"  loading {os.path.basename(path)}")
    mesh = trimesh.load(path, process=False, force="mesh")
    if isinstance(mesh, trimesh.Scene):
        mesh = mesh.dump(concatenate=True)
    print(f"    raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces")
    return mesh


def main():
    if not os.path.exists(HUMAN_MANIFEST):
        sys.exit(f"missing manifest: {HUMAN_MANIFEST} — run extract-human-brain.py first")
    with open(HUMAN_MANIFEST) as f:
        manifest = json.load(f)
    center = np.array(manifest["centerOriginal"])
    scale = float(manifest["scale"])
    print(f"Using cortex transform: center={center.tolist()}, scale={scale:.6f}")

    if not os.path.exists(SRC_LH):
        sys.exit(f"missing: {SRC_LH}")
    if not os.path.exists(SRC_RH):
        sys.exit(f"missing: {SRC_RH}")

    print("Loading cerebellum hemispheres...")
    lh = load_hemi(SRC_LH)
    rh = load_hemi(SRC_RH)

    print("Combining...")
    combined = trimesh.util.concatenate([lh, rh])
    print(f"  combined: {len(combined.vertices):,} verts, {len(combined.faces):,} faces")

    # Apply the SAME transform the cortex used so they line up.
    combined.vertices = combined.vertices - center
    combined.vertices = combined.vertices * scale
    # Same axis swap + flip as extract-human-brain.py
    v = combined.vertices.copy()
    combined.vertices = np.column_stack([v[:, 0], v[:, 2], -v[:, 1]])
    combined.faces = combined.faces[:, [0, 2, 1]]

    print(f"Decimating to {TARGET_FACES:,} faces...")
    if hasattr(combined, "simplify_quadric_decimation"):
        try:
            combined = combined.simplify_quadric_decimation(face_count=TARGET_FACES)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    combined.merge_vertices()
    combined.fix_normals()

    combined.export(OUT_GLB)
    size_kb = os.path.getsize(OUT_GLB) / 1024
    bmin = combined.vertices.min(axis=0)
    bmax = combined.vertices.max(axis=0)
    print(f"  wrote {OUT_GLB}  ({size_kb:.0f} KB, {len(combined.faces):,} faces)")
    print(f"  scene-frame bbox: x={bmin[0]:.2f}-{bmax[0]:.2f}  y={bmin[1]:.2f}-{bmax[1]:.2f}  z={bmin[2]:.2f}-{bmax[2]:.2f}")


if __name__ == "__main__":
    main()
