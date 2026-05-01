#!/usr/bin/env python
"""Build a manifest + traces.bin for whatever GLBs are already on disk.

Useful for sanity-checking the /activity page without waiting for the full
200-cell extraction. The companion script extract-functional-cells.py writes
the 200-cell production dataset; this one just stitches together what's
already been fetched.
"""
from __future__ import annotations
import json
import struct
import sys
import time
from pathlib import Path

import h5py
import fsspec
import numpy as np
from fsspec.implementations.cached import CachingFileSystem

ROOT = Path(__file__).resolve().parent.parent
MESH_DIR = ROOT / "public" / "meshes" / "activity"
DATA_DIR = ROOT / "public" / "data"
CACHE_DIR = ROOT / ".functional-cache"

NWB_S3 = "https://dandiarchive.s3.amazonaws.com/blobs/058/2e9/0582e94c-190b-46c7-bae4-28c684f396ff"
COREG_FIELDS = (2, 4, 6)
TRACE_FPS = 30
TRACE_SECONDS = 60
SHARED_SCALE = 2.5 / 1_000_000


def main():
    # Index resolved roots by v1300_root → row (so we can look up positions).
    cache_path = CACHE_DIR / "resolved_roots.json"
    if not cache_path.exists():
        print(f"missing {cache_path} — run extract-functional-cells.py at least once", file=sys.stderr)
        sys.exit(1)
    rows = json.loads(cache_path.read_text())
    by_seg = {int(r["v1300_root"]): r for r in rows}

    # Pick up every GLB on disk that we have a row for.
    glbs = sorted(MESH_DIR.glob("*.glb"))
    on_disk: list[dict] = []
    for p in glbs:
        seg = int(p.stem)
        row = by_seg.get(seg)
        if row is None:
            print(f"  skip {seg} — no row in resolved_roots.json", file=sys.stderr)
            continue
        on_disk.append(row)
    print(f"found {len(on_disk)} cells on disk with metadata", file=sys.stderr)
    if not on_disk:
        sys.exit(2)

    # Centroid of THIS subset (so the swarm is centered for whatever we have).
    pts = np.array([r["soma_nm"] for r in on_disk], dtype=np.float64)
    centroid = pts.mean(axis=0)

    # NB: the GLB vertex positions were baked relative to the FULL pipeline's
    # centroid (over all 400 candidates), not this subset. For an alpha that
    # may differ by tens of microns; close enough to verify the page works.

    # Stream NWB and pull each cell's trace
    print("opening NWB stream...", file=sys.stderr)
    fs = CachingFileSystem(fs=fsspec.filesystem("http"), cache_storage=str(CACHE_DIR / "nwb"))
    f = h5py.File(fs.open(NWB_S3, "rb"), "r")
    fluor = f["processing/ophys/Fluorescence"]

    # Group on_disk cells by field for efficient slicing.
    by_field: dict[int, list[tuple[int, int]]] = {}  # field → list of (out_idx, mask_idx)
    for out_idx, r in enumerate(on_disk):
        by_field.setdefault(r["field"], []).append((out_idx, r["mask_idx"]))

    T_total = fluor[f"RoiResponseSeries{COREG_FIELDS[0]}"]["data"].shape[0]
    timestamps = fluor[f"RoiResponseSeries{COREG_FIELDS[0]}"]["timestamps"][:]
    F = np.zeros((T_total, len(on_disk)), dtype=np.float32)

    for field, pairs in by_field.items():
        rrs = fluor[f"RoiResponseSeries{field}"]
        cols = sorted(set(p[1] for p in pairs))
        print(f"  field {field}: pulling {len(cols)} cols ({len(pairs)} cells)...", file=sys.stderr)
        t0 = time.time()
        data = rrs["data"][:, cols]  # (T, len(cols))
        col_to_pos = {c: i for i, c in enumerate(cols)}
        for out_idx, mask_idx in pairs:
            F[:, out_idx] = data[:, col_to_pos[mask_idx]]
        print(f"    done ({time.time()-t0:.1f}s)", file=sys.stderr)
    f.close()

    fps_in = float(1.0 / np.median(np.diff(timestamps)))
    print(f"trace shape={F.shape}, fps_in={fps_in:.2f}", file=sys.stderr)

    # ΔF/F + half-wave + per-cell normalise (same recipe as the main script).
    print("deconvolving...", file=sys.stderr)
    win = max(1, int(30 * fps_in))
    base = np.empty_like(F)
    step = max(1, win // 8)
    for s in range(0, F.shape[0], step):
        e = min(F.shape[0], s + win)
        base[s:e] = np.percentile(F[s:e], 8, axis=0)
    dff = (F - base) / np.maximum(base, 1e-3)
    slow_win = max(1, int(3 * fps_in))
    if slow_win > 1:
        kernel = np.ones(slow_win, dtype=np.float32) / slow_win
        for j in range(F.shape[1]):
            dff[:, j] = dff[:, j] - np.convolve(dff[:, j], kernel, mode="same")
    act = np.clip(dff, 0, None)
    p99 = np.percentile(act, 99, axis=0)
    p99 = np.where(p99 < 1e-6, 1.0, p99)
    act = np.clip(act / p99, 0.0, 1.0).astype(np.float32)

    # Pick the most-active 60s window across the population
    pop = act.mean(axis=1)
    win_in = int(TRACE_SECONDS * fps_in)
    if act.shape[0] > win_in:
        kernel = np.ones(win_in) / win_in
        smoothed = np.convolve(pop, kernel, mode="valid")
        s = int(np.argmax(smoothed))
        e = s + win_in
    else:
        s, e = 0, act.shape[0]
    seg = act[s:e]
    seg_t = timestamps[s:e] - timestamps[s]
    out_t = np.linspace(0, TRACE_SECONDS, TRACE_FPS * TRACE_SECONDS, endpoint=False, dtype=np.float64)
    out = np.empty((len(out_t), seg.shape[1]), dtype=np.float32)
    for j in range(seg.shape[1]):
        out[:, j] = np.interp(out_t, seg_t, seg[:, j])
    print(f"resampled → {out.shape}", file=sys.stderr)

    # Write traces.bin: u32 cells, u32 frames, f32 fps, then float32 frame-major.
    bin_path = DATA_DIR / "activity-traces.bin"
    n_frames, n_cells = out.shape
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(bin_path, "wb") as fp:
        fp.write(struct.pack("<IIf", n_cells, n_frames, float(TRACE_FPS)))
        fp.write(out.astype(np.float32, copy=False).tobytes(order="C"))
    print(f"wrote {bin_path} ({bin_path.stat().st_size/1024:.0f} KB)", file=sys.stderr)

    # Manifest
    manifest_cells = []
    for r in on_disk:
        soma = np.array(r["soma_nm"], dtype=np.float64)
        world = (soma - centroid) * SHARED_SCALE
        world[1] *= -1
        manifest_cells.append({
            "segId": str(r["v1300_root"]),
            "field": r["field"],
            "world": world.tolist(),
            "somaNm": list(soma),
        })
    manifest = {
        "fps": TRACE_FPS,
        "frames": n_frames,
        "seconds": TRACE_SECONDS,
        "centroidNm": list(centroid),
        "cells": manifest_cells,
        "alpha": True,
    }
    manifest_path = DATA_DIR / "activity-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"wrote {manifest_path}", file=sys.stderr)
    print(f"\nDONE: {len(on_disk)} cells in alpha bundle", file=sys.stderr)


if __name__ == "__main__":
    main()
