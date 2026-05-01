#!/usr/bin/env python
"""Build the /activity dataset: 200 real MICrONS cells with calcium imaging traces.

Pipeline (no CAVE token needed — fully public sources):
  1. Stream session-9, scan-4 NWB from DANDI 000402 (S3, anonymous).
  2. Read plane segmentations 2/4/6 → matched ROIs with (pt_root_id_v117, pt_xyz, mask_id).
  3. For each soma point, look up the v1300 root_id in seg_m1300 (anonymous GCS).
  4. Fetch + decimate the v1300 mesh, write GLB (~6k faces).
  5. Pull fluorescence traces for the same ROIs, convert to ΔF/F, clip negatives
     for a deconvolved-style glow trace, downsample to 30 fps × 60 s.
  6. Write public/meshes/activity/{slug}.glb + public/data/activity-manifest.json
     + public/data/activity-traces.bin (Float32Array, frame-major, [0,1]-normalized).

Why position-based mesh resolution (not the raw pt_root_id)?
  pt_root_id in the NWB is the v117 segmentation root, encoded as float64. v1300
  root IDs change with every proofreading edit, so we re-resolve each soma point
  in seg_m1300 to get a current root that has a static mesh.
"""
from __future__ import annotations
import os
import sys
import json
import time
import struct
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from concurrent.futures.process import BrokenProcessPool
from pathlib import Path

import h5py
import fsspec
import numpy as np
import trimesh
from cloudvolume import CloudVolume
from fsspec.implementations.cached import CachingFileSystem

ROOT = Path(__file__).resolve().parent.parent
MESH_DIR = ROOT / "public" / "meshes" / "activity"
DATA_DIR = ROOT / "public" / "data"
# Caches live OUTSIDE public/ so Vite doesn't copy them into the build.
CACHE_DIR = ROOT / ".functional-cache"
MESH_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ses-9-scan-4 — the file the DANDI demo notebook uses; fields 2/4/6 carry
# ~640 manually coregistered ROIs across L2/3, L4, L5.
NWB_S3 = "https://dandiarchive.s3.amazonaws.com/blobs/058/2e9/0582e94c-190b-46c7-bae4-28c684f396ff"
SEG_SRC = "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300"
COREG_FIELDS = (2, 4, 6)

TARGET_CELLS = 200
# Per-cell face budget. 6K turned out to be too few — at this density the
# fine dendrites collapse into jagged origami in the renderer. 60K (10× the
# initial budget) reads as a real cell with resolvable spines and dendrites,
# at the cost of bigger files (~700 KB per cell, ~140 MB across 200 cells).
TARGET_FACES = 60000
TRACE_FPS = 30                # output playback rate
TRACE_SECONDS = 30            # 30-second loop

# Same shared scale as scripts/extract-cluster.py so this scene mixes well
# with the existing project. 1 mm of cortex = 2.5 scene units.
SHARED_SCALE = 2.5 / 1_000_000  # per nm


def open_nwb():
    fs = CachingFileSystem(fs=fsspec.filesystem("http"), cache_storage=str(CACHE_DIR / "nwb"))
    return h5py.File(fs.open(NWB_S3, "rb"), "r")


def collect_matched_rois(nwb) -> list[dict]:
    """Pull every ROI that has a non-NaN pt_position from fields 2/4/6.

    Returns rows of {field, mask_idx, pt_voxel (4,4,40 nm), pt_root_v117_lossy}.
    """
    rows = []
    img_seg = nwb["processing/ophys/ImageSegmentation"]
    for field in COREG_FIELDS:
        ps = img_seg[f"PlaneSegmentation{field}"]
        pt_root = ps["pt_root_id"][:]
        px = ps["pt_x_position"][:]
        py = ps["pt_y_position"][:]
        pz = ps["pt_z_position"][:]
        valid = ~np.isnan(pt_root) & ~np.isnan(px)
        for i in np.where(valid)[0]:
            rows.append({
                "field": field,
                "mask_idx": int(i),     # column index into RoiResponseSeries{field}.data
                "pt_voxel_4nm": (int(px[i]), int(py[i]), int(pz[i])),
                "pt_root_v117_lossy": int(pt_root[i]),
            })
    return rows


def resolve_v1300_roots(rows: list[dict]) -> list[dict]:
    """Vectorized voxel-lookup of every soma point in seg_m1300."""
    cv_seg = CloudVolume(SEG_SRC, mip=0, use_https=True, parallel=1, progress=False, fill_missing=True)

    print(f"resolving {len(rows)} soma points in seg_m1300 (mip 0)...", file=sys.stderr)
    t0 = time.time()
    out = []
    for i, row in enumerate(rows):
        x4, y4, z = row["pt_voxel_4nm"]
        # 4nm voxels → 8nm voxels for mip 0
        sx, sy = x4 // 2, y4 // 2
        try:
            chunk = cv_seg[sx:sx+1, sy:sy+1, z:z+1]
            seg_id = int(chunk[0, 0, 0, 0])
        except Exception as e:
            print(f"  [{i}] voxel read failed: {e}", file=sys.stderr)
            continue
        if seg_id == 0:
            continue
        # Soma point in nm (the centre of the soma, which we use as the cell's
        # spatial position — accurate within ~5µm).
        soma_nm = (x4 * 4.0, y4 * 4.0, z * 40.0)
        out.append({**row, "v1300_root": seg_id, "soma_nm": soma_nm})
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(rows)} resolved ({time.time()-t0:.0f}s)", file=sys.stderr)
    print(f"  done: {len(out)}/{len(rows)} ({time.time()-t0:.0f}s)", file=sys.stderr)
    # Dedupe by v1300_root — multiple ROIs can map to the same EM cell across fields
    seen = set()
    unique = []
    for r in out:
        if r["v1300_root"] in seen:
            continue
        seen.add(r["v1300_root"])
        unique.append(r)
    print(f"  unique v1300 cells: {len(unique)}", file=sys.stderr)
    return unique


def _decimate(verts: np.ndarray, faces: np.ndarray, target: int) -> tuple[np.ndarray, np.ndarray]:
    """Aggressive multi-pass decimation via fast_simplification.

    Going straight from ~4 M faces to 6 K in one pass occasionally returns
    a partially-decimated result, so we step down through ~50× ratios.
    """
    import fast_simplification
    v = np.asarray(verts, dtype=np.float32)
    f = np.asarray(faces, dtype=np.int32)
    while len(f) > target * 1.05:
        step_target = max(target, len(f) // 50)
        v, f = fast_simplification.simplify(v, f, target_count=step_target)
    return v, f


def fetch_and_export(row: dict, centroid_nm: np.ndarray) -> dict | None:
    """Fetch a v1300 mesh, decimate, export as GLB. Returns enriched row or None."""
    seg_id = row["v1300_root"]
    out_path = MESH_DIR / f"{seg_id}.glb"
    if out_path.exists() and out_path.stat().st_size < 500_000:
        # Already decimated to a sensible size — accept it.
        return {**row, "glb": out_path.name, "skipped": True}

    # parallel=1 — cloud-volume's internal multiprocess pool conflicts with
    # the outer ThreadPoolExecutor (BrokenPipeError as the parent process
    # tears the pool down between jobs). Single-stream fetch per worker is
    # plenty when we have 8 workers in flight already.
    cv = CloudVolume(SEG_SRC, use_https=True, parallel=1, progress=False)
    try:
        raw = cv.mesh.get(seg_id)
        if isinstance(raw, dict):
            raw = raw.get(seg_id) or next(iter(raw.values()))
    except Exception as e:
        print(f"  fetch fail {seg_id}: {e}", file=sys.stderr)
        return None

    n_v_raw = len(raw.vertices)
    if n_v_raw < 5000:
        return None

    soma = np.array(row["soma_nm"], dtype=np.float64)
    verts = np.asarray(raw.vertices, dtype=np.float64) - soma
    faces = np.asarray(raw.faces, dtype=np.int32)

    try:
        verts32, faces32 = _decimate(verts, faces, TARGET_FACES)
    except Exception as e:
        print(f"  decimate fail {seg_id}: {e}", file=sys.stderr)
        return None
    if len(faces32) < 200:
        return None

    # Scene-unit transform: shared scale + Y-flip (so pia is up) + face winding flip.
    verts64 = verts32.astype(np.float64) * SHARED_SCALE
    verts64[:, 1] *= -1
    faces_out = faces32[:, [0, 2, 1]].astype(np.int32)

    # Bake world translation so the GLB lands at the cell's real cortical location.
    world = (soma - centroid_nm) * SHARED_SCALE
    world[1] *= -1
    verts64 = verts64 + world

    tm = trimesh.Trimesh(vertices=verts64, faces=faces_out, process=False)
    tm.export(str(out_path))
    return {
        **row,
        "glb": out_path.name,
        "world": world.tolist(),
        "n_faces": int(len(faces_out)),
        "kb": round(out_path.stat().st_size / 1024, 1),
    }


def deconvolve_traces(F: np.ndarray, fps_in: float) -> np.ndarray:
    """Crude in-house deconvolution — robust baseline, ΔF/F, half-wave rectify.

    The DANDI release ships raw fluorescence only; the deconvolved spike-rate
    we'd ideally use lives in DataJoint. This is a visual approximation: it
    reads as the same kind of sparse spiky activity, normalised per cell.

    F shape: (T, N).  Returns same shape, values in [0, 1] per cell.
    """
    T, N = F.shape
    # Baseline: rolling 8th percentile over a 30s window.
    win = max(1, int(30 * fps_in))
    base = np.empty_like(F)
    # Cheap rolling percentile via decimated samples — exact enough for normalisation.
    step = max(1, win // 8)
    for s in range(0, T, step):
        e = min(T, s + win)
        base[s:e] = np.percentile(F[s:e], 8, axis=0)
    dff = (F - base) / np.maximum(base, 1e-3)
    # High-pass: subtract a slow rolling mean (~3s) to kill drift.
    slow_win = max(1, int(3 * fps_in))
    if slow_win > 1:
        kernel = np.ones(slow_win, dtype=np.float32) / slow_win
        for j in range(N):
            dff[:, j] = dff[:, j] - np.convolve(dff[:, j], kernel, mode="same")
    # Half-wave rectify, soft-thresh.
    act = np.clip(dff, 0, None)
    # Normalise per cell to [0,1] using 99th percentile so a couple of huge
    # transients don't crush the rest of the trace.
    p99 = np.percentile(act, 99, axis=0)
    p99 = np.where(p99 < 1e-6, 1.0, p99)
    return np.clip(act / p99, 0.0, 1.0).astype(np.float32)


def resample_traces(traces: np.ndarray, t_in: np.ndarray, fps_out: int, seconds: int) -> np.ndarray:
    """Linear-resample (T_in, N) → (fps_out * seconds, N) on an evenly spaced grid.

    Uses the most-active 60-s window across the cell population so the loop
    feels alive instead of starting on a quiet patch.
    """
    pop_activity = traces.mean(axis=1)
    win_in = int(seconds * (1.0 / np.median(np.diff(t_in))))
    if traces.shape[0] > win_in:
        # Pick the contiguous win_in-frame window with the largest mean activity.
        kernel = np.ones(win_in) / win_in
        smoothed = np.convolve(pop_activity, kernel, mode="valid")
        s = int(np.argmax(smoothed))
        e = s + win_in
    else:
        s, e = 0, traces.shape[0]
    seg = traces[s:e]
    seg_t = t_in[s:e] - t_in[s]

    out_t = np.linspace(0, seconds, fps_out * seconds, endpoint=False, dtype=np.float64)
    # Vectorised linear interp per cell
    out = np.empty((len(out_t), seg.shape[1]), dtype=np.float32)
    for j in range(seg.shape[1]):
        out[:, j] = np.interp(out_t, seg_t, seg[:, j])
    return out


def select_cells(unique: list[dict], target: int) -> list[dict]:
    """Stratified sample — proportional across fields 2/4/6 — for layer variety."""
    rng = np.random.default_rng(0xCA1C1)
    by_field: dict[int, list[dict]] = {}
    for r in unique:
        by_field.setdefault(r["field"], []).append(r)
    total = sum(len(v) for v in by_field.values())
    out = []
    for f, rows in by_field.items():
        share = round(target * len(rows) / total)
        idx = rng.choice(len(rows), size=min(share, len(rows)), replace=False)
        out.extend([rows[i] for i in idx])
    return out[:target]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-cells", type=int, default=TARGET_CELLS)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    cache_path = CACHE_DIR / "resolved_roots.json"
    if cache_path.exists():
        unique = json.loads(cache_path.read_text())
        print(f"loaded {len(unique)} resolved roots from cache ({cache_path})", file=sys.stderr)
    else:
        print("opening NWB stream...", file=sys.stderr)
        nwb = open_nwb()
        rows = collect_matched_rois(nwb)
        print(f"  {len(rows)} matched ROIs across fields {COREG_FIELDS}", file=sys.stderr)
        unique = resolve_v1300_roots(rows)
        cache_path.write_text(json.dumps(unique))
        nwb.close()

    # Over-sample so failed mesh fetches don't push us under 200.
    targets = select_cells(unique, args.max_cells * 2)
    print(f"selected {len(targets)} candidate cells", file=sys.stderr)

    # Centroid for relative positioning
    pts = np.array([r["soma_nm"] for r in targets], dtype=np.float64)
    centroid = pts.mean(axis=0)

    # Fetch + decimate in parallel — ProcessPoolExecutor so a segfault in a
    # cloud-volume C extension only kills one worker; the pool restarts it.
    print(f"fetching meshes ({args.workers} workers, in chunks of 40)...", file=sys.stderr)
    t0 = time.time()
    enriched: list[dict] = []
    chunk_size = 40
    cursor = 0
    seen_segs: set[int] = set()
    while cursor < len(targets) and len(enriched) < args.max_cells:
        chunk = targets[cursor:cursor + chunk_size]
        cursor += chunk_size
        try:
            with ProcessPoolExecutor(max_workers=args.workers) as ex:
                futures = {ex.submit(fetch_and_export, r, centroid): r for r in chunk}
                for fut in as_completed(futures):
                    try:
                        res = fut.result(timeout=180)
                    except Exception as e:
                        print(f"  worker error: {type(e).__name__}: {e}", file=sys.stderr)
                        res = None
                    if res is not None and res["v1300_root"] not in seen_segs:
                        seen_segs.add(res["v1300_root"])
                        enriched.append(res)
        except BrokenProcessPool as e:
            # A worker segfaulted hard enough to take the pool with it. Skip
            # this chunk and continue with the next.
            print(f"  pool broken on chunk; continuing: {e}", file=sys.stderr)
        print(f"  chunk done — {len(enriched)} ok, {cursor}/{len(targets)} considered ({time.time()-t0:.0f}s)", file=sys.stderr)
    enriched = enriched[: args.max_cells]
    print(f"finalised {len(enriched)} cells", file=sys.stderr)

    # Re-open NWB for traces
    print("pulling fluorescence traces...", file=sys.stderr)
    nwb = open_nwb()
    fluor = nwb["processing/ophys/Fluorescence"]
    by_field: dict[int, list[int]] = {}
    for i, r in enumerate(enriched):
        by_field.setdefault(r["field"], []).append(i)

    # Read each field's RoiResponseSeries{N} only at the columns we need
    T_total = fluor[f"RoiResponseSeries{COREG_FIELDS[0]}"]["data"].shape[0]
    F = np.zeros((T_total, len(enriched)), dtype=np.float32)
    timestamps = fluor[f"RoiResponseSeries{COREG_FIELDS[0]}"]["timestamps"][:]
    for field, idxs in by_field.items():
        rrs = fluor[f"RoiResponseSeries{field}"]
        cols = [enriched[i]["mask_idx"] for i in idxs]
        # Pull contiguous slices to amortise HDF5 overhead — chunk by 50 cells
        for chunk_start in range(0, len(cols), 50):
            chunk_cols = cols[chunk_start:chunk_start+50]
            chunk_idx = idxs[chunk_start:chunk_start+50]
            order = np.argsort(chunk_cols)
            sorted_cols = [chunk_cols[k] for k in order]
            data = rrs["data"][:, sorted_cols]  # (T, len(chunk))
            for k, oi in enumerate(order):
                F[:, chunk_idx[oi]] = data[:, k]
            print(f"  field {field}: {chunk_start+len(chunk_cols)}/{len(cols)}", file=sys.stderr)
    nwb.close()

    fps_in = float(1.0 / np.median(np.diff(timestamps)))
    print(f"  trace shape={F.shape}, fps_in={fps_in:.2f}", file=sys.stderr)
    print("deconvolving + normalising...", file=sys.stderr)
    act = deconvolve_traces(F, fps_in)
    print("resampling to 30 fps × 60 s...", file=sys.stderr)
    out = resample_traces(act, timestamps, TRACE_FPS, TRACE_SECONDS)
    print(f"  out shape={out.shape}", file=sys.stderr)

    # Write traces.bin: little-endian header [u32 cells, u32 frames, f32 fps] then float32 frame-major.
    bin_path = DATA_DIR / "activity-traces.bin"
    n_frames, n_cells = out.shape
    with open(bin_path, "wb") as f:
        f.write(struct.pack("<IIf", n_cells, n_frames, float(TRACE_FPS)))
        f.write(out.astype(np.float32, copy=False).tobytes(order="C"))
    print(f"wrote {bin_path} ({bin_path.stat().st_size/1024:.0f} KB)", file=sys.stderr)

    # Manifest
    manifest = {
        "fps": TRACE_FPS,
        "frames": n_frames,
        "seconds": TRACE_SECONDS,
        "centroidNm": centroid.tolist(),
        "cells": [
            {
                "segId": str(r["v1300_root"]),
                "field": r["field"],
                "world": r["world"],          # scene-unit position relative to swarm centroid
                "somaNm": r["soma_nm"],
                "kb": r.get("kb"),
                "faces": r.get("n_faces"),
            }
            for r in enriched
        ],
    }
    manifest_path = DATA_DIR / "activity-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"wrote {manifest_path}", file=sys.stderr)
    print(f"\nDONE: {len(enriched)} cells, {n_frames} frames @ {TRACE_FPS}fps", file=sys.stderr)


if __name__ == "__main__":
    main()
