#!/usr/bin/env python
"""Extract MICrONS minnie65 cell meshes as web-optimized GLBs.

Pulls each featured cell from the MICrONS public bucket via cloud-volume,
decimates with quadric simplification, centers + scales to fit a unit cube,
and writes a GLB file ready for three.js's GLTFLoader.

Cells are sourced from https://www.microns-explorer.org/gallery-mm3 .

Usage:
    python scripts/extract-meshes.py
"""
import os
import sys
import json
import time
import traceback
import numpy as np
import trimesh
from cloudvolume import CloudVolume

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "meshes")
os.makedirs(OUT_DIR, exist_ok=True)

SOURCE = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"

# (slug, seg_id, target_face_count)
# Bigger cells (pyramidal, astrocyte) get a higher face budget.
CELLS = [
    # Higher face budgets here — at ~30K the dendrites looked piecewise-linear
    # under zoom. ~100K keeps spines visible without making files unreasonable.
    # Astrocytes have so many fine processes that they need substantially more
    # detail than a typical neuron to read as fluffy rather than blobby.
    ("lightning-tree", 864691135572530981, 120000),
    ("coral-fan",      864691136662432990, 100000),
    ("candelabra",     864691135572094189, 220000), # Chandelier cell — extensive axon cartridges; needs high face count to read as cartridges, not blobs
    ("reaching-hand",  864691135919630768, 90000),
    # 864691135104015693 was visibly cut off at volume edge; this one is
    # at ~172um from the volume center and intact (see find-central-cell.py).
    ("dust-star",      864691135279086497, 80000),
    ("forest-floor",   864691135113162137, 350000),
    # Newer additions, sourced from microns-explorer.org/gallery-mm3 :
    ("crown",          864691135855890478, 90000),  # Layer 2/3 pyramidal
    ("spindle",        864691135407923657, 80000),  # Bipolar interneuron
    # 864691133190214690 was a 22-face stub (proofread away); this one is intact.
    ("watcher",        864691136194411734, 100000), # Microglia
    # Spelunker-shared circuit motif (pyramidal + 2 inhibitory neighbors).
    # The other 3 IDs from the share state are post-seg_m1300 proofread roots
    # that have no static mesh and need a live graphene fetch — skipped here.
    ("spire",          864691135214123064, 100000), # Pyramidal — central cell
    ("aura",           864691135948123745, 100000), # Inhibitory interneuron
    ("tendril",        864691136195546856, 100000), # Long-axon interneuron
]


def fetch_mesh(cv: CloudVolume, seg_id: int):
    """cloud-volume returns either a Mesh object or a dict; normalize."""
    raw = cv.mesh.get(seg_id)
    if isinstance(raw, dict):
        # Some sources return {seg_id: Mesh}
        if seg_id in raw:
            return raw[seg_id]
        # Or {str(seg_id): Mesh}
        if str(seg_id) in raw:
            return raw[str(seg_id)]
        # Fall back to first value
        return next(iter(raw.values()))
    return raw


def decimate(tm: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    """Try several decimation paths in order of availability."""
    if len(tm.faces) <= target_faces:
        return tm
    # trimesh ≥4 — direct method
    if hasattr(tm, "simplify_quadric_decimation"):
        try:
            return tm.simplify_quadric_decimation(face_count=target_faces)
        except Exception as e:
            print(f"  quadric_decimation failed: {e}", file=sys.stderr)
    # Try open3d if available
    try:
        import open3d as o3d
        m = o3d.geometry.TriangleMesh()
        m.vertices = o3d.utility.Vector3dVector(tm.vertices)
        m.triangles = o3d.utility.Vector3iVector(tm.faces)
        m = m.simplify_quadric_decimation(target_faces)
        return trimesh.Trimesh(
            vertices=np.asarray(m.vertices),
            faces=np.asarray(m.triangles),
            process=False,
        )
    except ImportError:
        print("  (open3d not available)", file=sys.stderr)
    print(f"  WARNING: shipping un-decimated mesh ({len(tm.faces)} faces)", file=sys.stderr)
    return tm


def export_cell(slug: str, seg_id: int, target_faces: int) -> dict:
    print(f"\n[{slug}] seg {seg_id}")
    t0 = time.time()
    cv = CloudVolume(SOURCE, use_https=True, parallel=8, progress=False)
    print("  fetching mesh...")
    mesh = fetch_mesh(cv, seg_id)
    fetch_secs = time.time() - t0
    n_v_raw = len(mesh.vertices)
    n_f_raw = len(mesh.faces)
    print(f"  raw: {n_v_raw:,} verts, {n_f_raw:,} faces  ({fetch_secs:.1f}s)")

    tm = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=False)

    # Center on centroid (vertex-mean — robust against weighted soma bias)
    centroid = tm.vertices.mean(axis=0)
    tm.vertices = tm.vertices - centroid

    # MICrONS minnie65 stores positions in nm. Scale so the longest axis maps
    # to ~2 units (so the mesh fits a [-1, 1] cube). We also flip Y so the
    # apical dendrite of pyramidal cells points up in three.js (Y-up).
    extent = float(np.max(np.ptp(tm.vertices, axis=0)))
    if extent > 0:
        tm.vertices = tm.vertices * (2.0 / extent)
    # In MICrONS, Y is depth (negative = pia / cortex surface). Flip so up = pia.
    tm.vertices[:, 1] *= -1
    # Also flip the face winding so normals point out after Y-flip.
    tm.faces = tm.faces[:, [0, 2, 1]]

    print(f"  decimating to {target_faces:,} faces...")
    tm = decimate(tm, target_faces)
    n_f_final = len(tm.faces)

    out_path = os.path.join(OUT_DIR, f"{slug}.glb")
    tm.export(out_path)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  wrote {out_path}  ({size_kb:.0f} KB, {n_f_final:,} faces)")

    return {
        "slug": slug,
        "segId": str(seg_id),
        "rawFaces": n_f_raw,
        "rawVerts": n_v_raw,
        "decimatedFaces": n_f_final,
        "fileKB": round(size_kb, 1),
        "extentNm": round(extent, 1),
    }


def main():
    results = []
    for slug, seg_id, target in CELLS:
        try:
            results.append(export_cell(slug, seg_id, target))
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            traceback.print_exc()
            results.append({"slug": slug, "segId": str(seg_id), "error": str(e)})

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(results, f, indent=2)
    print("\n=== Summary ===")
    for r in results:
        if "error" in r:
            print(f"  [FAIL] {r['slug']}: {r['error']}")
        else:
            print(f"  [OK]   {r['slug']}: {r['fileKB']} KB / {r['decimatedFaces']:,} faces")
    print(f"\nManifest: {manifest_path}")


if __name__ == "__main__":
    main()
