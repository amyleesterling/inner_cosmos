#!/usr/bin/env python
"""Fetch CAVE skeletons for Aura + Tendril, transform to the synapse-
centered shared frame, and save as JSON for use in the AP animation.

Skeletons are graphs of vertices + edges in nm. We apply the same
transform extract-synapse-pair.py uses on the meshes:
  vertices = (vertices_nm - synapse_nm) * SHARED_SCALE
  vertices[:,1] *= -1   # Y-flip (matches three.js up = pia)

Output JSON shape per cell:
  { "vertices": [[x,y,z], ...], "edges": [[i,j], ...] }

These can then be loaded in the browser, walked as a graph, and used to
compute path-along-mesh-surface for the action-potential pulse animation
on /explore stage 8 (replacing the current straight-line lerps between
TENDRIL_FAR / origin / AURA_SOMA / AURA_AXON_END).

Usage:
    python scripts/extract-synapse-skeletons.py
"""
import json
import os
import sys
import time

import numpy as np
from caveclient import CAVEclient

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "meshes")

# Same shared frame as extract-synapse-pair.py:
SYN_VOX = np.array([175661, 152147, 21899])
VOXEL_NM = np.array([4, 4, 40])
SYN_NM = SYN_VOX * VOXEL_NM
SHARED_SCALE = 1.0 / 600000.0

CELLS = [
    ("synapse-aura-skeleton",    864691135948123745),
    ("synapse-tendril-skeleton", 864691136195546856),
]


def to_shared_frame(verts_nm: np.ndarray) -> np.ndarray:
    out = (verts_nm - SYN_NM) * SHARED_SCALE
    out[:, 1] *= -1
    return out


def main():
    client = CAVEclient("minnie65_public")
    for slug, seg_id in CELLS:
        print(f"\n[{slug}] seg {seg_id}")
        t = time.time()
        try:
            sk = client.skeleton.get_skeleton(seg_id, output_format="dict")
        except Exception as e:
            print(f"  FAIL: {e}", file=sys.stderr)
            continue
        v = np.asarray(sk["vertices"], dtype=np.float64)
        e = np.asarray(sk["edges"], dtype=np.int32)
        v_local = to_shared_frame(v).astype(np.float32)
        print(f"  {len(v):,} verts / {len(e):,} edges  ({time.time()-t:.1f}s)")
        out = {
            "vertices": v_local.tolist(),
            "edges": e.tolist(),
            "root": int(sk.get("root", 0)),
            "synapseNm": SYN_NM.tolist(),
            "sharedScale": SHARED_SCALE,
        }
        path = os.path.join(OUT_DIR, f"{slug}.json")
        with open(path, "w") as f:
            json.dump(out, f)
        size_kb = os.path.getsize(path) / 1024
        print(f"  wrote {path}  ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
