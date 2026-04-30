#!/usr/bin/env python
"""Convert FreeSurfer human brain pial surfaces (lh + rh) to a web-friendly GLB.

Input: two .pial.obj files (left + right hemispheres) from FreeSurfer.
Output:
  public/meshes/human-brain.glb    — combined hemispheres, decimated
  public/meshes/human-brain.json   — manifest with bbox + transform info

The pial surface is the OUTER cortical surface — the convoluted gray-matter
boundary you see in textbook brain photos.

Usage:
    python scripts/extract-human-brain.py
"""
import os
import json
import sys
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = r"C:\Users\amyle\Downloads\pial_Full_obj\pial_Full_obj"
SRC_LH = os.path.join(SRC_DIR, "human brain lh.pial.obj")
SRC_RH = os.path.join(SRC_DIR, "human bran rh.pial.obj")  # sic — note typo in source filename
OUT_DIR = os.path.join(ROOT, "public", "meshes")
OUT_GLB = os.path.join(OUT_DIR, "human-brain.glb")
OUT_MANIFEST = os.path.join(OUT_DIR, "human-brain.json")

# Pial surfaces are dense (~400K verts each). Decimate for the web — the
# human brain mostly needs to read as a recognizable shape. 150K is roughly
# the point where the gyri/sulci stop reading as polygon facets at the
# default stage-0 camera distance.
TARGET_FACES = 150000

# Approximate "wow facts" for the kid-friendly intro
NEURONS_HUMAN_BRAIN = 86_000_000_000  # 86 billion
NEURONS_MOUSE_BRAIN = 71_000_000      # 71 million (Allen estimate)


def load_hemisphere(path: str) -> trimesh.Trimesh:
    print(f"  loading {os.path.basename(path)}")
    mesh = trimesh.load(path, process=False, force="mesh")
    if isinstance(mesh, trimesh.Scene):
        mesh = mesh.dump(concatenate=True)
    print(f"    raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces")
    return mesh


def main():
    if not os.path.exists(SRC_LH):
        sys.exit(f"missing left hemisphere: {SRC_LH}")
    if not os.path.exists(SRC_RH):
        sys.exit(f"missing right hemisphere: {SRC_RH}")

    print("Loading hemispheres...")
    lh = load_hemisphere(SRC_LH)
    rh = load_hemisphere(SRC_RH)

    print("Combining hemispheres...")
    combined = trimesh.util.concatenate([lh, rh])
    print(f"  combined: {len(combined.vertices):,} verts, {len(combined.faces):,} faces")

    bmin = combined.vertices.min(axis=0)
    bmax = combined.vertices.max(axis=0)
    print(f"  bbox min: {bmin}")
    print(f"  bbox max: {bmax}")
    print(f"  size    : {bmax - bmin}")

    raw_bbox = {
        "min": bmin.tolist(),
        "max": bmax.tolist(),
        "size": (bmax - bmin).tolist(),
    }

    center = (bmin + bmax) / 2.0
    extent = float(np.max(bmax - bmin))
    scale = 2.0 / extent

    # Center + uniform scale so the longest axis maps to 2 (mesh fits ±1).
    combined.vertices = combined.vertices - center
    combined.vertices = combined.vertices * scale
    # FreeSurfer RAS: +Y is anterior, +Z is superior. We want +Y up in three.js.
    # Swap Y and Z so dorsal is up, then flip the Y axis so the brain isn't
    # mirrored.
    v = combined.vertices.copy()
    combined.vertices = np.column_stack([v[:, 0], v[:, 2], -v[:, 1]])
    # Face winding handled by the swap+flip combo (det = -1, so we flip):
    combined.faces = combined.faces[:, [0, 2, 1]]

    print(f"Decimating to {TARGET_FACES:,} faces...")
    if hasattr(combined, "simplify_quadric_decimation"):
        try:
            combined = combined.simplify_quadric_decimation(face_count=TARGET_FACES)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    # Smooth shading: merge coincident vertices so face normals blend across
    # adjacent triangles. Without this, the GLB exporter writes per-face
    # normals and three.js renders every triangle as flat-shaded — the
    # decimated mesh ends up looking like a low-poly disco brain.
    combined.merge_vertices()
    combined.fix_normals()

    combined.export(OUT_GLB)
    size_kb = os.path.getsize(OUT_GLB) / 1024
    print(f"  wrote {OUT_GLB}  ({size_kb:.0f} KB, {len(combined.faces):,} faces)")

    manifest = {
        "source": "FreeSurfer pial surfaces (lh + rh) — human cortex outer surface",
        "rawBbox": raw_bbox,
        "centerOriginal": center.tolist(),
        "scale": scale,
        "axesNote": "swapped Y/Z + flipped Y so +Y is up (dorsal) in three.js",
        "exportedFaces": int(len(combined.faces)),
        "wowFacts": {
            "neuronsApprox": NEURONS_HUMAN_BRAIN,
            "neuronsMouse": NEURONS_MOUSE_BRAIN,
            "humanToMouseRatio": NEURONS_HUMAN_BRAIN / NEURONS_MOUSE_BRAIN,
        },
    }
    with open(OUT_MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  wrote {OUT_MANIFEST}")


if __name__ == "__main__":
    main()
