#!/usr/bin/env python
"""Extract a pool of low-poly cells for the landing-page ambient drift.

These are the 13 cells curated by Amy in
  https://ngl.microns-explorer.org/#!middleauth+https://global.daf-apis.com/nglstate/api/v1/5717639258177536

5 of them are from minnie65 (seg_m1300), 8 are from minnie35 (seg).
Lower face budget than featured-cell extraction since these are background
ambient — visible small + dim, behind hero text.
"""
import os
import json
import sys
import numpy as np
import trimesh
from cloudvolume import CloudVolume

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "meshes", "ambient")
os.makedirs(OUT_DIR, exist_ok=True)

# (segId, source) tuples
M65 = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"
M35 = "precomputed://gs://iarpa_microns/minnie/minnie35/seg"

CELLS = [
    # minnie65 cells (from seg_m1300) — curated subset Amy picked.
    # Skipping minnie35 cells from the same state (different volume).
    (864691134064155671, M65),
    (864691136144674612, M65),
    (864691135307555142, M65),
    (864691135937286404, M65),
    (864691136812081779, M65),
]

TARGET_FACES = 20000  # low-poly for ambient


def fetch_mesh(cv: CloudVolume, seg_id: int) -> trimesh.Trimesh:
    raw = cv.mesh.get(seg_id)
    if isinstance(raw, dict):
        m = raw.get(seg_id) or raw.get(str(seg_id)) or next(iter(raw.values()))
    else:
        m = raw
    return trimesh.Trimesh(vertices=m.vertices, faces=m.faces, process=False)


def export(seg_id: int, source: str):
    out_path = os.path.join(OUT_DIR, f"{seg_id}.glb")
    print(f"\n[seg {seg_id}] source: {source.split('/')[-2]}/{source.split('/')[-1]}")
    cv = CloudVolume(source, use_https=True, parallel=4, progress=False)
    t0 = __import__("time").time()
    mesh = fetch_mesh(cv, seg_id)
    print(f"  raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces  ({__import__('time').time()-t0:.1f}s)")

    if len(mesh.faces) == 0:
        return {"segId": str(seg_id), "source": source, "error": "empty mesh"}

    # Center + scale + Y-flip (same as featured cells)
    bbox_min = mesh.vertices.min(axis=0)
    bbox_max = mesh.vertices.max(axis=0)
    center = (bbox_min + bbox_max) / 2.0
    extent = float(np.max(bbox_max - bbox_min))
    if extent <= 0:
        return {"segId": str(seg_id), "source": source, "error": "zero extent"}
    mesh.vertices = (mesh.vertices - center) * (2.0 / extent)
    mesh.vertices[:, 1] *= -1
    mesh.faces = mesh.faces[:, [0, 2, 1]]

    if len(mesh.faces) > TARGET_FACES:
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=TARGET_FACES)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    mesh.export(out_path)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  wrote {out_path}  ({size_kb:.0f} KB, {len(mesh.faces):,} faces)")
    return {
        "segId": str(seg_id),
        "source": source,
        "fileKB": round(size_kb, 1),
        "faces": int(len(mesh.faces)),
        "extentNm": float(extent),
    }


def main():
    results = []
    for seg_id, source in CELLS:
        try:
            results.append(export(seg_id, source))
        except Exception as e:
            print(f"  FAIL {seg_id}: {e}", file=sys.stderr)
            results.append({"segId": str(seg_id), "source": source, "error": str(e)})

    # Manifest the landing page reads — drop stubs (proofread-away segments
    # that come back as a few-face placeholder) and any errors.
    MIN_FACES = 1000
    manifest = {
        "cells": [r for r in results if "error" not in r and r.get("faces", 0) >= MIN_FACES],
        "errors": [r for r in results if "error" in r],
        "stubs": [r for r in results if "error" not in r and r.get("faces", 0) < MIN_FACES],
    }
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n=== Summary ===")
    for r in results:
        if "error" in r:
            print(f"  [FAIL] {r['segId']}: {r['error']}")
        else:
            print(f"  [OK]   {r['segId']}: {r['fileKB']} KB / {r['faces']:,} faces")
    print(f"\nManifest: {manifest_path}")
    print(f"Cells available for landing rotation: {len(manifest['cells'])}")


if __name__ == "__main__":
    main()
