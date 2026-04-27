#!/usr/bin/env python
"""Convert the Allen Institute mouse brain OBJ to a web-friendly GLB.

Input: a "root" compartment mesh (whole-brain surface) exported from Allen
CCF, in micrometer coordinates. Allen CCF is approximately:
    X:  0 .. 13200 µm   (AP)   anterior → posterior
    Y:  0 .. 8000  µm   (DV)   dorsal → ventral (low Y = top of brain)
    Z:  0 .. 11400 µm   (ML)   left → right

Output: `public/meshes/mouse-brain.glb`, decimated and re-centered, plus a
`public/meshes/mouse-brain.json` manifest with the original Allen CCF
bounding box and our rescale factor (so we can place anatomical landmarks
like primary visual cortex in three.js coords later).
"""
import os
import json
import sys
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"C:\Users\amyle\Downloads\3D mouse brain allen institute.obj"
OUT_DIR = os.path.join(ROOT, "public", "meshes")
OUT_GLB = os.path.join(OUT_DIR, "mouse-brain.glb")
OUT_MANIFEST = os.path.join(OUT_DIR, "mouse-brain.json")

TARGET_FACES = 60000  # whole brain only needs medium fidelity for context


def to_local(points: np.ndarray, center: np.ndarray, scale: float) -> np.ndarray:
    """Apply the same world→local transform we apply to the mesh."""
    out = (points - center) * scale
    out[:, 1] *= -1
    return out


def main():
    print(f"Loading {SRC}")
    mesh = trimesh.load(SRC, process=False)
    if isinstance(mesh, trimesh.Scene):
        mesh = mesh.dump(concatenate=True)
    print(f"  raw: {len(mesh.vertices):,} verts, {len(mesh.faces):,} faces")

    bmin = mesh.vertices.min(axis=0)
    bmax = mesh.vertices.max(axis=0)
    print(f"  bbox min (Allen um): {bmin}")
    print(f"  bbox max (Allen um): {bmax}")
    print(f"  size              :  {bmax - bmin}")

    allen_bbox = {
        "min": bmin.tolist(),
        "max": bmax.tolist(),
        "size": (bmax - bmin).tolist(),
    }

    center = (bmin + bmax) / 2.0
    extent = float(np.max(bmax - bmin))
    scale = 2.0 / extent

    # ---- Inside-brain neuron-position dots ----------------------------------
    # Voxelize the brain at a coarse pitch and pick voxel centers as our dots.
    # MUCH faster than mesh.contains rejection sampling (which is O(N) ray casts
    # per point and is dog slow without embree).
    n_dots = 16000
    print("Voxelizing brain at 180um pitch...")
    rng = np.random.default_rng(42)
    voxel_grid = mesh.voxelized(pitch=180.0).fill()
    voxel_centers = np.asarray(voxel_grid.points)
    print(f"  {len(voxel_centers):,} interior voxel centers")
    if len(voxel_centers) >= n_dots:
        idx = rng.choice(len(voxel_centers), size=n_dots, replace=False)
        dots = voxel_centers[idx]
    else:
        dots = voxel_centers
    # Jitter within ±half a voxel so the sampling doesn't read as a grid
    dots = dots + rng.uniform(-90, 90, size=dots.shape)
    print(f"  sampled {len(dots):,} interior points")
    dots_local = to_local(dots, center, scale).astype(np.float32)
    dots_path = os.path.join(OUT_DIR, "brain-points.bin")
    with open(dots_path, "wb") as f:
        f.write(dots_local.tobytes())
    print(f"  wrote {dots_path}  ({os.path.getsize(dots_path)/1024:.0f} KB, {len(dots_local):,} dots)")

    # ---- Anatomical landmarks ----------------------------------------------
    # Approximate primary visual cortex (VISp) center in Allen CCF um. Axes
    # in this mesh are X=ML (left-right), Y=DV (dorsal-ventral), Z=AP (anterior-posterior).
    # Right hemisphere V1 is roughly at ML ~7700, DV ~1700 (dorsal), AP ~8500.
    v1_right_um = np.array([7700.0, 1700.0, 8500.0])
    v1_left_um = np.array([3700.0, 1700.0, 8500.0])
    v1_right = to_local(v1_right_um[None, :], center, scale)[0]
    v1_left = to_local(v1_left_um[None, :], center, scale)[0]

    # ---- Mesh transform + decimation + GLB ---------------------------------
    mesh.vertices = mesh.vertices - center
    mesh.vertices = mesh.vertices * scale
    mesh.vertices[:, 1] *= -1
    mesh.faces = mesh.faces[:, [0, 2, 1]]

    print(f"  decimating to {TARGET_FACES:,} faces...")
    if hasattr(mesh, "simplify_quadric_decimation"):
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=TARGET_FACES)
        except Exception as e:
            print(f"  decimation failed: {e}", file=sys.stderr)

    mesh.export(OUT_GLB)
    size_kb = os.path.getsize(OUT_GLB) / 1024
    print(f"  wrote {OUT_GLB}  ({size_kb:.0f} KB, {len(mesh.faces):,} faces)")

    manifest = {
        "source": "Allen Institute mouse brain (root compartment, structure 997)",
        "axes": {"X": "ML", "Y": "DV", "Z": "AP"},
        "allenBboxUm": allen_bbox,
        "centerUm": center.tolist(),
        "scale": scale,
        "yFlipped": True,
        "exportedFaces": int(len(mesh.faces)),
        "nInteriorDots": int(len(dots_local)),
        "landmarks": {
            "visp_right": v1_right.tolist(),
            "visp_left": v1_left.tolist(),
        },
    }
    with open(OUT_MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  wrote {OUT_MANIFEST}")
    print(f"  V1 right hemisphere (local coords): {v1_right}")


if __name__ == "__main__":
    main()
