#!/usr/bin/env python
"""Re-extract Aura + Tendril in a shared synapse-centered frame.

The featured-cell GLBs (aura.glb, tendril.glb) are each centered on their
own bbox — fine for solo display in the cluster, but they're not in spatial
correspondence so you can't actually look at the contact between them.

This script re-fetches both meshes and, instead of centering each on its own
centroid, centers BOTH on the synapse coordinate Amy provided. Same uniform
scale factor for both, so when loaded into the scene at the same transform
they line up the way they do in the EM volume.

Inputs (hard-coded):
  Aura    seg 864691135948123745  (L5 thick-tufted pyramidal)
  Tendril seg 864691136195546856  (inhibitory axon contacting Aura)
  Synapse 175661 / 152147 / 21899  voxels  →  nm at 4×4×40

Outputs:
  public/meshes/synapse-aura.glb
  public/meshes/synapse-tendril.glb
  public/meshes/synapse.json   manifest (scale + cell extents)
"""
import os
import json
import sys
import time
import numpy as np
import trimesh
from cloudvolume import CloudVolume

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "meshes")
os.makedirs(OUT_DIR, exist_ok=True)

SOURCE = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"

# Spelunker voxel coords for the synapse (4×4×40 nm voxels)
SYN_VOX = np.array([175661, 152147, 21899])
VOXEL_NM = np.array([4, 4, 40])
SYN_NM = SYN_VOX * VOXEL_NM  # → [702644, 608588, 875960]

CELLS = [
    ("synapse-aura",    864691135948123745, 100000),
    ("synapse-tendril", 864691136195546856, 100000),
]

# Uniform scale for both: pick something that makes the union of both meshes
# fit comfortably in a [-1, 1] cube around the synapse, but is tight enough
# that the synapse contact is visible at default zoom. Both cells are
# ~700-750 µm in extent and the synapse sits ~80-300 µm from each cell's
# centroid, so 1/600000 nm⁻¹ (≈1 unit per 600 µm) is a sensible starting
# scale — most of each cell ends up in [-1, 1] but tendrils extend further.
SHARED_SCALE = 1.0 / 600000.0


def fetch(cv, seg_id):
    raw = cv.mesh.get(seg_id)
    if isinstance(raw, dict):
        m = raw.get(seg_id) or raw.get(str(seg_id)) or next(iter(raw.values()))
    else:
        m = raw
    return trimesh.Trimesh(vertices=m.vertices, faces=m.faces, process=False)


def export(slug, seg_id, target_faces):
    print(f"\n[{slug}] seg {seg_id}")
    t0 = time.time()
    cv = CloudVolume(SOURCE, use_https=True, parallel=8, progress=False)
    mesh = fetch(cv, seg_id)
    print(f"  raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces  ({time.time()-t0:.1f}s)")

    # Center on the synapse, not on each cell's centroid.
    mesh.vertices = mesh.vertices - SYN_NM
    mesh.vertices = mesh.vertices * SHARED_SCALE
    # Match the rest of the project — Y-flip (so apicals point up in three.js)
    mesh.vertices[:, 1] *= -1
    mesh.faces = mesh.faces[:, [0, 2, 1]]

    if hasattr(mesh, "simplify_quadric_decimation") and len(mesh.faces) > target_faces:
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=target_faces)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    out_path = os.path.join(OUT_DIR, f"{slug}.glb")
    mesh.export(out_path)
    size_kb = os.path.getsize(out_path) / 1024
    bbox = (
        np.array([mesh.vertices.min(axis=0).tolist(), mesh.vertices.max(axis=0).tolist()])
    )
    print(f"  wrote {out_path}  ({size_kb:.0f} KB, {len(mesh.faces):,} faces)")
    print(f"  shared-frame bbox: {bbox.tolist()}")
    return {
        "slug": slug,
        "segId": str(seg_id),
        "faces": int(len(mesh.faces)),
        "fileKB": round(size_kb, 1),
        "bbox": bbox.tolist(),
    }


def main():
    cells = []
    for slug, seg_id, target in CELLS:
        try:
            cells.append(export(slug, seg_id, target))
        except Exception as e:
            print(f"  FAIL: {e}", file=sys.stderr)
            cells.append({"slug": slug, "segId": str(seg_id), "error": str(e)})

    manifest = {
        "synapseVoxel": SYN_VOX.tolist(),
        "voxelNm": VOXEL_NM.tolist(),
        "synapseNm": SYN_NM.tolist(),
        "sharedScale": SHARED_SCALE,
        "frameNote": "Both meshes are centered on the synapse coordinate, scaled uniformly, Y-flipped to match three.js up.",
        "cells": cells,
    }
    out = os.path.join(OUT_DIR, "synapse.json")
    with open(out, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest: {out}")
    for c in cells:
        if "error" in c:
            print(f"  [FAIL] {c['slug']}: {c['error']}")
        else:
            print(f"  [OK]   {c['slug']}: {c['fileKB']} KB / {c['faces']:,} faces")


if __name__ == "__main__":
    main()
