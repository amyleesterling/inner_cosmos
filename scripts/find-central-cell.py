#!/usr/bin/env python
"""Find a Layer 4 cell that sits near the center of the MICrONS minnie65 volume.

Some seg IDs in the gallery's layer4_cells.json are right at the edge of the
imaged volume and have visibly truncated dendrites. This picks the one whose
bbox center sits closest to the volume center AND whose mesh stays inside.
"""
import json
import sys
from cloudvolume import CloudVolume
import numpy as np

SOURCE = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"

# First ~25 IDs from gs://microns-static-links/mm3/layer4_cells.json
CANDIDATES = [
    864691135104015693,
    864691135100073504,
    864691135977309763,
    864691135181775362,
    864691135013881494,
    864691136135505291,
    864691135323902108,
    864691135279086497,
    864691135345158047,
    864691135345198495,
    864691136952628191,
    864691135292628150,
    864691135866178942,
    864691134885517050,
    864691135571683309,
    864691136175994374,
    864691135467553164,
    864691135349064663,
    864691135591256843,
    864691135494012304,
    864691135468803724,
    864691135742189163,
    864691136312608061,
    864691135520216306,
    864691135919627440,
]

def main():
    cv = CloudVolume(SOURCE, use_https=True, parallel=8, progress=False)
    # Volume bounds in nm = shape (voxels) * resolution (nm/voxel)
    shape = cv.shape[:3]
    res = cv.resolution
    vol_size_nm = np.array([shape[i] * res[i] for i in range(3)])
    vol_center_nm = vol_size_nm / 2.0
    print(f"Volume size (nm): {vol_size_nm.astype(int)}")
    print(f"Volume center (nm): {vol_center_nm.astype(int)}")
    print()

    # Margin (nm) — if any vertex is within this distance of a face we count it as cut off
    MARGIN_NM = 8000

    results = []
    for sid in CANDIDATES:
        try:
            raw = cv.mesh.get(sid)
            if isinstance(raw, dict):
                mesh = raw.get(sid) or raw.get(str(sid)) or next(iter(raw.values()))
            else:
                mesh = raw
            v = np.asarray(mesh.vertices)
            bbox_min = v.min(axis=0)
            bbox_max = v.max(axis=0)
            center = (bbox_min + bbox_max) / 2.0
            extent = bbox_max - bbox_min
            dist = float(np.linalg.norm(center - vol_center_nm))
            # Cut-off check: any face of bbox closer than MARGIN_NM to volume face
            cut_off = bool(
                np.any(bbox_min < MARGIN_NM) or
                np.any(bbox_max > vol_size_nm - MARGIN_NM)
            )
            results.append({
                "segId": sid,
                "centerUm": (center / 1000).astype(int).tolist(),
                "extentUm": (extent / 1000).astype(int).tolist(),
                "distFromVolCenterUm": int(dist / 1000),
                "cutOff": cut_off,
                "rawFaces": len(mesh.faces),
            })
            tag = "CUT" if cut_off else "ok "
            print(f"  [{tag}] {sid}  center {(center/1000).astype(int).tolist()} um  extent {(extent/1000).astype(int).tolist()} um  dist {dist/1000:.0f} um  faces {len(mesh.faces):,}")
        except Exception as e:
            print(f"  FAIL  {sid}: {e}", file=sys.stderr)

    print("\n=== Best candidates (interior, near center) ===")
    interior = [r for r in results if not r["cutOff"]]
    interior.sort(key=lambda r: r["distFromVolCenterUm"])
    for r in interior[:5]:
        print(f"  seg {r['segId']}  dist {r['distFromVolCenterUm']} um  extent {r['extentUm']} um")

    print(f"\nWriting candidate set to scripts/layer4-candidates.json")
    with open("scripts/layer4-candidates.json", "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    main()
