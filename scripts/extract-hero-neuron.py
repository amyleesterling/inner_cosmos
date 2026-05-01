#!/usr/bin/env python
"""Re-extract the hero neuron (Lightning Tree, on /explore stage 6 'A neuron')
at higher resolution so the long axon doesn't appear chopped.

The cluster meshes use target_faces=120000 by default which is fine for the
group view but truncates thin axon tips on the hero. Here we fetch LOD 1
(~2.8M faces, much richer than the default LOD-0-decimated path) and target
400K faces after quadric decimation. File size lands around ~6-8 MB GLB,
acceptable for the single hero close-up stage.

Output: public/meshes/cluster/lightning-tree.glb (replaces the existing).
"""
import os
import sys
import time
import numpy as np
import trimesh
from cloudvolume import CloudVolume

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "meshes", "cluster")
os.makedirs(OUT_DIR, exist_ok=True)

SOURCE = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"
SEG_ID = 864691135572530981  # Lightning Tree
SHARED_SCALE = 2.5 / 1_000_000  # per nm — must match extract-cluster.py
LOD = 1
TARGET_FACES = 400_000


def main():
    print(f"Fetching seg {SEG_ID} at LOD {LOD}...")
    t0 = time.time()
    cv = CloudVolume(SOURCE, use_https=True, parallel=8, progress=False)
    raw = cv.mesh.get(SEG_ID, lod=LOD)
    if isinstance(raw, dict):
        raw = raw.get(SEG_ID) or raw.get(str(SEG_ID)) or next(iter(raw.values()))
    print(f"  fetched: {len(raw.vertices):,} verts, {len(raw.faces):,} faces  ({time.time()-t0:.1f}s)")

    mesh = trimesh.Trimesh(vertices=raw.vertices, faces=raw.faces, process=False)

    # Same transform as extract-cluster.py: per-cell center, shared scale, Y-flip
    bbox_min = mesh.vertices.min(axis=0)
    bbox_max = mesh.vertices.max(axis=0)
    center = (bbox_min + bbox_max) / 2.0
    extent_nm = float(np.max(bbox_max - bbox_min))
    mesh.vertices = (mesh.vertices - center) * SHARED_SCALE
    mesh.vertices[:, 1] *= -1
    mesh.faces = mesh.faces[:, [0, 2, 1]]

    if hasattr(mesh, "simplify_quadric_decimation") and len(mesh.faces) > TARGET_FACES:
        print(f"  decimating to {TARGET_FACES:,} faces...")
        t1 = time.time()
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=TARGET_FACES)
            print(f"  done ({time.time()-t1:.1f}s) — {len(mesh.faces):,} faces")
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    out = os.path.join(OUT_DIR, "lightning-tree.glb")
    mesh.export(out)
    size_mb = os.path.getsize(out) / 1024 / 1024
    final_extent = extent_nm * SHARED_SCALE
    print(f"\nWrote {out}  ({size_mb:.1f} MB)")
    print(f"Real extent: {extent_nm/1000:.0f} um -> scene extent: {final_extent:.2f} units")


if __name__ == "__main__":
    main()
