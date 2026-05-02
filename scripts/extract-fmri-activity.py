#!/usr/bin/env python
"""Build the /brain dataset: real fMRI BOLD activity painted onto the cortex.

Pipeline (no auth required — fully public sources):
  1. Stream-download a window of the preprocessed BOLD volume from one
     Naturalistic Neuroimaging Database (NNDb, OpenNeuro ds002837)
     participant via S3. NNDb is CC0; the BOLD is already preprocessed
     (AFNI: blur + bandpass + ICA censoring), MNI N27 aligned at 3 mm.
  2. Reverse the FreeSurfer-pial transform stored in
     public/meshes/human-brain.json to get the cortex mesh's vertices
     back in anatomical mm. Sample the BOLD volume at each vertex via
     nearest-voxel lookup.
  3. Z-score each voxel's time series, clip to ±3σ, parcellate the cortex
     into K=512 spatial parcels via k-means on vertex coords. Mean within
     each parcel. Smooth temporally by a 3-tap triangular kernel.
  4. Write public/data/brain-activity.bin (header + per-vertex parcel id +
     uint8 frame-major activity) and public/data/brain-activity.json.

The output binary is ~225 KB for a 160 s loop, 512 parcels, 75K vertices —
small enough to ship in the deploy. Front-end consumes it via
src/data/brainActivity.ts.

Why parcellate? Per-vertex traces would be 75K × 160 × 2 = 24 MB, too large
to ship. K=512 parcels is the sweet spot where each parcel is small enough
(~150 vertices) for the activity to read as smoothly varying across the
cortex, while the activity table is ~80 KB.

Why FreeSurfer-RAS as a stand-in for MNI N27?  These are different spaces
in principle, but for a visualization (not a research analysis) the offset
is small enough that the gross spatial pattern of activity reads correctly
on the cortex. Doing a proper registration would mean shipping a 3D warp
field, which we'd rather not do.

Usage:
    python scripts/extract-fmri-activity.py
    python scripts/extract-fmri-activity.py --subject sub-1 --task 500daysofsummer --frames 160
    python scripts/extract-fmri-activity.py --subject sub-21 --task citizenfour
"""
from __future__ import annotations
import argparse
import gzip
import json
import os
import struct
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np

# pygltflib is the same parser used by the other extract-*.py scripts.
try:
    from pygltflib import GLTF2
except ImportError:
    sys.exit("pip install pygltflib")

ROOT = Path(__file__).resolve().parent.parent
MESH_DIR = ROOT / "public" / "meshes"
DATA_DIR = ROOT / "public" / "data"
CACHE_DIR = ROOT / ".fmri-cache"  # outside public/ — Vite shouldn't bundle this
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

GLB_PATH = MESH_DIR / "human-brain.glb"
MANIFEST_PATH = MESH_DIR / "human-brain.json"
OUT_BIN = DATA_DIR / "brain-activity.bin"
OUT_JSON = DATA_DIR / "brain-activity.json"

# NNDb subjects-to-task map — taken from participants.tsv. Listed here so the
# CLI can validate without a network round-trip; the comment next to each row
# is the pretty-printed movie title that ends up in the manifest.
NNDB_TASKS = {
    "500daysofsummer": "(500) Days of Summer",
    "citizenfour": "Citizenfour",
    "12yearsaslave": "12 Years a Slave",
    "backtothefuture": "Back to the Future",
    "littlemisssunshine": "Little Miss Sunshine",
    "pulpfiction": "Pulp Fiction",
    "split": "Split",
    "theprestige": "The Prestige",
    "theshawshankredemption": "The Shawshank Redemption",
    "theusualsuspects": "The Usual Suspects",
}


def stream_download_nifti_prefix(url: str, target_bytes: int, out_path: Path) -> None:
    """Stream-decompress a gzipped NIfTI from S3 to disk, stopping after roughly
    `target_bytes` of decompressed data. Used to grab just the prefix of a
    multi-GB BOLD scan — enough for the loop window we want."""
    if out_path.exists() and out_path.stat().st_size >= target_bytes:
        print(f"  cached: {out_path} ({out_path.stat().st_size/1e6:.1f} MB)")
        return
    print(f"  streaming {url} → {out_path}")
    t0 = time.time()
    req = urllib.request.Request(url)
    written = 0
    with urllib.request.urlopen(req, timeout=60) as r, open(out_path, "wb") as f:
        decomp = gzip.GzipFile(fileobj=r, mode="rb")
        while written < target_bytes:
            chunk = decomp.read(2 * 1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            written += len(chunk)
    print(f"  decompressed {written/1e6:.1f} MB in {time.time()-t0:.1f}s")


def parse_nifti_header(path: Path) -> dict:
    """Return shape, voxel→mm affine, dtype, and where the data starts."""
    hdr = path.open("rb").read(352)
    dim = struct.unpack("<8h", hdr[40:56])
    nx, ny, nz, nt = dim[1], dim[2], dim[3], dim[4]
    datatype = struct.unpack("<h", hdr[70:72])[0]
    if datatype != 16:  # NIFTI_TYPE_FLOAT32
        raise SystemExit(f"unexpected NIfTI datatype {datatype} (want 16/float32)")
    vox_offset = int(struct.unpack("<f", hdr[108:112])[0])
    srow_x = struct.unpack("<4f", hdr[280:296])
    srow_y = struct.unpack("<4f", hdr[296:312])
    srow_z = struct.unpack("<4f", hdr[312:328])
    affine = np.array(
        [srow_x, srow_y, srow_z, [0.0, 0.0, 0.0, 1.0]], dtype=np.float64
    )
    return {
        "nx": nx, "ny": ny, "nz": nz, "nt": nt,
        "vox_offset": vox_offset,
        "affine": affine,
    }


def load_cortex_vertices() -> tuple[np.ndarray, dict]:
    """Read public/meshes/human-brain.glb + manifest, return vertices in
    original FreeSurfer-RAS mm coordinates (the inverse of the centering and
    axis-swap done by extract-human-brain.py)."""
    if not GLB_PATH.exists() or not MANIFEST_PATH.exists():
        sys.exit(
            f"missing {GLB_PATH} / {MANIFEST_PATH} — run extract-human-brain.py first"
        )
    manifest = json.loads(MANIFEST_PATH.read_text())
    gltf = GLTF2().load(str(GLB_PATH))
    prim = gltf.meshes[0].primitives[0]
    pos_acc = gltf.accessors[prim.attributes.POSITION]
    bv = gltf.bufferViews[pos_acc.bufferView]
    blob = gltf.binary_blob()
    start = bv.byteOffset + (pos_acc.byteOffset or 0)
    verts_scene = np.frombuffer(
        blob, dtype=np.float32, count=pos_acc.count * 3, offset=start
    ).reshape(-1, 3)

    # Reverse: extract-human-brain.py did v_scene = swap_yz_flip_y((v - center) * scale).
    # Inverse: undo the axis swap, then divide by scale and add the center back.
    center = np.array(manifest["centerOriginal"])
    scale = manifest["scale"]
    v_unaxis = np.column_stack([verts_scene[:, 0], -verts_scene[:, 2], verts_scene[:, 1]])
    v_mm = v_unaxis / scale + center
    return v_mm.astype(np.float64), manifest


def kmeans_cortex(verts: np.ndarray, mask: np.ndarray, k: int, *, seed: int = 42,
                  iterations: int = 25) -> tuple[np.ndarray, np.ndarray]:
    """Lloyd's k-means on the in-brain vertices' 3D coords. Returns
    (parcel_id_per_in_brain_vertex (uint16), centroids (k,3))."""
    rng = np.random.default_rng(seed)
    in_brain = verts[mask]
    init = rng.choice(len(in_brain), size=k, replace=False)
    centroids = in_brain[init].copy()
    assign = np.zeros(len(in_brain), dtype=np.int64)
    for it in range(iterations):
        # (M, k) distances. Could chunk for >100K verts; we have ~75K so fine.
        d = np.linalg.norm(in_brain[:, None, :] - centroids[None, :, :], axis=2)
        new_assign = d.argmin(axis=1)
        new_C = np.zeros_like(centroids)
        counts = np.zeros(k, dtype=np.int64)
        np.add.at(new_C, new_assign, in_brain)
        np.add.at(counts, new_assign, 1)
        ok = counts > 0
        new_C[ok] /= counts[ok, None]
        new_C[~ok] = centroids[~ok]
        shift = float(np.linalg.norm(new_C - centroids, axis=1).mean())
        centroids = new_C
        assign = new_assign
        if it % 5 == 0:
            print(f"    iter {it:>2}: shift {shift:.3f} mm, "
                  f"{(~ok).sum()} empty parcels")
        if shift < 0.05:
            break
    return assign.astype(np.uint16), centroids


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", default="sub-1",
                    help="NNDb subject id (sub-1 .. sub-86)")
    ap.add_argument("--task", default="500daysofsummer",
                    help=f"NNDb task; one of: {', '.join(NNDB_TASKS.keys())}")
    ap.add_argument("--frames", type=int, default=160,
                    help="Number of BOLD volumes (TR=1s ⇒ seconds) to use")
    ap.add_argument("--parcels", type=int, default=512,
                    help="K for k-means cortex parcellation")
    args = ap.parse_args()

    if args.task not in NNDB_TASKS:
        sys.exit(f"unknown task '{args.task}'. Choose from: {list(NNDB_TASKS)}")
    movie = NNDB_TASKS[args.task]

    url = (
        f"https://s3.amazonaws.com/openneuro.org/ds002837/derivatives/"
        f"{args.subject}/func/"
        f"{args.subject}_task-{args.task}_bold_blur_censor.nii.gz"
    )
    nii_cache = CACHE_DIR / f"{args.subject}_{args.task}_prefix.nii"

    # 1) Cortex vertices in mm
    print("Loading cortex vertices from human-brain.glb")
    v_mm, _ = load_cortex_vertices()
    N = v_mm.shape[0]
    print(f"  {N:,} vertices, bbox (mm): {v_mm.min(0)} → {v_mm.max(0)}")

    # 2) Stream just enough of the BOLD scan for `frames` volumes plus header.
    # One float32 volume = 64*76*64*4 ≈ 1.2 MB; over-fetch a hair so the
    # last frame isn't a partial read.
    voxels_per_vol = 64 * 76 * 64
    target_bytes = 200_000 + (args.frames + 8) * voxels_per_vol * 4
    print(f"\nStreaming BOLD prefix (≈{target_bytes/1e6:.0f} MB decompressed)…")
    stream_download_nifti_prefix(url, target_bytes, nii_cache)

    # 3) Header + memmapped data
    h = parse_nifti_header(nii_cache)
    nx, ny, nz = h["nx"], h["ny"], h["nz"]
    A_inv = np.linalg.inv(h["affine"])
    available = (nii_cache.stat().st_size - h["vox_offset"]) // (nx * ny * nz * 4)
    n_frames = int(min(available, args.frames))
    print(f"  parsed: {nx}×{ny}×{nz} × {h['nt']}T (using {n_frames} frames)")
    vol = np.memmap(
        nii_cache, dtype=np.float32, mode="r",
        offset=h["vox_offset"], shape=(n_frames, nz, ny, nx),
    )

    # 4) Per-vertex voxel index (nearest-neighbour); collapse to unique voxels
    # so we sample each only once.
    mm_h = np.column_stack([v_mm, np.ones(N)])
    vox_f = (A_inv @ mm_h.T).T[:, :3]
    i = np.clip(np.round(vox_f[:, 0]).astype(int), 0, nx - 1)
    j = np.clip(np.round(vox_f[:, 1]).astype(int), 0, ny - 1)
    k = np.clip(np.round(vox_f[:, 2]).astype(int), 0, nz - 1)
    keys = k.astype(np.int64) * nx * ny + j.astype(np.int64) * nx + i.astype(np.int64)
    uk, inverse = np.unique(keys, return_inverse=True)
    ui = (uk % nx).astype(int)
    uj = ((uk // nx) % ny).astype(int)
    uuk = (uk // (nx * ny)).astype(int)
    print(f"  {len(uk):,} unique voxels touched by cortex vertices")

    # 5) Sample voxel time series, z-score, clip
    print("Sampling voxel time series…")
    t0 = time.time()
    ts = np.zeros((len(uk), n_frames), dtype=np.float32)
    for f in range(n_frames):
        ts[:, f] = vol[f][uuk, uj, ui]
    print(f"  done in {time.time()-t0:.1f}s")
    voxel_std = ts.std(axis=1)
    in_brain_voxel = voxel_std > 0.05
    zs = (ts - ts.mean(axis=1, keepdims=True)) / (voxel_std[:, None] + 1e-6)
    zs = np.clip(zs, -3.0, 3.0)

    # Per-vertex z-scored time series + brain-mask
    zs_v = zs[inverse]                        # (N, n_frames)
    mask_v = in_brain_voxel[inverse]          # (N,)
    print(f"  {mask_v.sum():,} of {N:,} cortex vertices land in real BOLD signal")

    # 6) K-means parcellate the in-brain vertices
    print(f"\nParcellating cortex into K={args.parcels}…")
    assign_brain, _ = kmeans_cortex(v_mm, mask_v, args.parcels)
    parcel_id = np.full(N, args.parcels, dtype=np.uint16)  # K = "no signal" sentinel
    parcel_id[mask_v] = assign_brain
    sizes = np.bincount(assign_brain, minlength=args.parcels)
    print(f"  parcel sizes: median {np.median(sizes):.0f}, max {sizes.max()}")

    # 7) Per-parcel mean trace
    parcel_ts = np.zeros((args.parcels, n_frames), dtype=np.float32)
    counts = np.zeros(args.parcels, dtype=np.float32)
    np.add.at(parcel_ts, assign_brain, zs_v[mask_v])
    np.add.at(counts, assign_brain, 1.0)
    parcel_ts[counts > 0] /= counts[counts > 0, None]

    # 8) Map to [0, 1] and smooth in time (3-tap triangular)
    activity_01 = (parcel_ts + 3.0) / 6.0
    smoothed = np.zeros_like(activity_01)
    kern = np.array([0.25, 0.5, 0.25])
    for f in range(n_frames):
        s, e = max(0, f - 1), min(n_frames, f + 2)
        w = kern[(s - (f - 1)):(e - (f - 1))]
        smoothed[:, f] = activity_01[:, s:e] @ w / w.sum()
    activity_01 = smoothed

    # 9) Encode + write
    print(f"\nWriting {OUT_BIN}")
    with open(OUT_BIN, "wb") as f:
        f.write(b"FMRI")
        f.write(struct.pack("<I", 1))                   # version
        f.write(struct.pack("<I", args.parcels))        # parcels
        f.write(struct.pack("<I", n_frames))            # frames
        f.write(struct.pack("<f", 1.0))                 # TR seconds (NNDb is 1 s)
        f.write(struct.pack("<I", N))                   # vertex count
        f.write(struct.pack("<I", 0))                   # reserved
        f.write(struct.pack("<I", 0))                   # reserved
        f.write(parcel_id.astype("<u2").tobytes())
        u8 = np.clip(activity_01 * 255.0, 0, 255).astype(np.uint8)
        f.write(u8.T.tobytes())  # frame-major: row = frame, col = parcel
    size_kb = OUT_BIN.stat().st_size / 1024
    print(f"  {size_kb:.1f} KB")

    manifest = {
        "schema": "brain-activity/1",
        "dataset": {
            "name": "Naturalistic Neuroimaging Database (NNDb)",
            "openneuroId": "ds002837",
            "doi": "10.18112/openneuro.ds002837.v2.0.0",
            "license": "CC0",
            "citation": (
                "Aliko, S., Huang, J., Gheorghiu, F., Meliss, S., & Skipper, J. I. "
                "(2020). A naturalistic neuroimaging database for understanding the "
                "brain using ecological stimuli. Scientific Data, 7(1), 347."
            ),
        },
        "subject": args.subject,
        "task": args.task,
        "movie": movie,
        "fileSourceUrl": url,
        "preprocessingNotes": (
            "BOLD preprocessed by NNDb authors (AFNI: blur + bandpass + ICA "
            "censoring), MNI N27 alignment at 3 mm. Sampled to FreeSurfer pial "
            "vertices via nearest-voxel lookup. Z-scored per voxel, clipped to "
            f"±3σ, parcellated into K={args.parcels} k-means clusters on cortex "
            "coordinates, mean per parcel, smoothed temporally (3-tap triangular)."
        ),
        "parcels": args.parcels,
        "frames": n_frames,
        "trSeconds": 1.0,
        "durationSeconds": float(n_frames),
        "vertexCount": int(N),
        "valueRange": "[0, 255] uint8 → maps linearly to z-score [-3, +3]",
        "fmriVoxelsTouched": int(len(uk)),
        "fmriVoxelsInBrain": int(in_brain_voxel.sum()),
    }
    OUT_JSON.write_text(json.dumps(manifest, indent=2))
    print(f"Writing {OUT_JSON}")
    print(f"\nDone. {N:,} verts → {args.parcels} parcels × {n_frames} frames "
          f"({n_frames}s of {movie}).")


if __name__ == "__main__":
    main()
