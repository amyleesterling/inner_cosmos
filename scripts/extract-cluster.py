#!/usr/bin/env python
"""Re-extract the /explore stage-5 cluster cells with a SHARED scale factor.

Each cell's mesh is centered on its own centroid (so the soma is at origin),
then uniformly scaled by SHARED_SCALE (same for every cell), then Y-flipped
to match the rest of the scene. Result: when loaded into the cluster, cells
appear at their TRUE relative sizes — the small Layer 2/3 pyramidal looks
small next to the big Layer 5 thick-tufted, just like in real tissue.

The /meet page keeps using the per-cell-normalized GLBs at public/meshes/{slug}.glb;
this script writes to public/meshes/cluster/{slug}.glb only.

Scale chosen so the largest cells (~700-800µm extent) read as ~1.5-1.8 units
in the scene at the stage-5 camera distance. Smaller cells are proportionally
smaller.

Usage:
    python scripts/extract-cluster.py
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

# 1mm = 2.5 units. So a 700µm cell (typical L5 pyramidal extent) → 1.75 units.
# A 400µm cell (typical L2/3 pyramidal extent) → 1.0 units. A 300µm cell
# (Layer 4 stellate) → 0.75 units. Real-world relative sizes preserved.
SHARED_SCALE = 2.5 / 1_000_000  # per nm

# (slug, seg_id, target_face_count) — cluster members only.
# Face counts copied from the per-cell extracts so the visual fidelity is the
# same; only the scaling changes.
CELLS = [
    ("lightning-tree", 864691135572530981, 120000),
    ("crown",          864691135855890478,  90000),
    ("dust-star",      864691135279086497,  80000),
    ("spire",          864691135214123064, 100000),
    ("aura",           864691135948123745, 100000),
    ("coral-fan",      864691136662432990, 100000),
    ("candelabra",     864691135572094189, 220000),
    ("reaching-hand",  864691135919630768, 200000),
    ("spindle",        864691135407923657,  80000),
    ("tendril",        864691136195546856, 100000),
]


def fetch_mesh(cv, seg_id):
    raw = cv.mesh.get(seg_id)
    if isinstance(raw, dict):
        return raw.get(seg_id) or raw.get(str(seg_id)) or next(iter(raw.values()))
    return raw


def export(slug, seg_id, target_faces):
    print(f"\n[{slug}] seg {seg_id}")
    t0 = time.time()
    cv = CloudVolume(SOURCE, use_https=True, parallel=8, progress=False)
    raw = fetch_mesh(cv, seg_id)
    mesh = trimesh.Trimesh(vertices=raw.vertices, faces=raw.faces, process=False)
    print(f"  raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces  ({time.time()-t0:.1f}s)")

    # Per-cell centering (so soma is at origin) but shared scaling
    # (so real-world sizes are preserved relative to each other).
    bbox_min = mesh.vertices.min(axis=0)
    bbox_max = mesh.vertices.max(axis=0)
    center = (bbox_min + bbox_max) / 2.0
    extent_nm = float(np.max(bbox_max - bbox_min))
    mesh.vertices = (mesh.vertices - center) * SHARED_SCALE
    # Y-flip + face-winding flip (match the rest of the project's convention)
    mesh.vertices[:, 1] *= -1
    mesh.faces = mesh.faces[:, [0, 2, 1]]

    if hasattr(mesh, "simplify_quadric_decimation") and len(mesh.faces) > target_faces:
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=target_faces)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    out = os.path.join(OUT_DIR, f"{slug}.glb")
    mesh.export(out)
    size_kb = os.path.getsize(out) / 1024
    final_extent_units = extent_nm * SHARED_SCALE
    print(f"  wrote {out}  ({size_kb:.0f} KB, {len(mesh.faces):,} faces)")
    print(f"  real extent {extent_nm/1000:.0f} um → scene extent {final_extent_units:.2f} units")
    return final_extent_units


def main():
    print(f"Shared scale: {SHARED_SCALE:.2e} per nm  ({2.0/SHARED_SCALE/1000:.0f} um per 2 scene units)")
    extents = []
    for slug, seg_id, target in CELLS:
        try:
            extents.append((slug, export(slug, seg_id, target)))
        except Exception as e:
            print(f"  FAIL {slug}: {e}", file=sys.stderr)
            extents.append((slug, None))

    print("\n=== Relative sizes (scene units, longest axis) ===")
    for slug, ext in sorted(extents, key=lambda x: -(x[1] or 0)):
        if ext is None:
            print(f"  {slug}: FAILED")
        else:
            bar = "#" * int(ext * 20)
            print(f"  {slug:18s} {ext:.2f}  {bar}")


if __name__ == "__main__":
    main()
