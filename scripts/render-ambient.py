#!/usr/bin/env python
"""Render orthographic previews of the landing-page ambient cells so we can
spot which one is glia (isotropic, fluffy, no clear apical/axon).

Reads public/meshes/ambient/manifest.json and renders each listed cell to
public/previews/ambient-<segId>.png.
"""
import os
import json
import numpy as np
import trimesh
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AMBIENT_DIR = os.path.join(ROOT, "public", "meshes", "ambient")
OUT_DIR = os.path.join(ROOT, "public", "previews")
os.makedirs(OUT_DIR, exist_ok=True)


def load(slug: str) -> trimesh.Trimesh:
    path = os.path.join(AMBIENT_DIR, f"{slug}.glb")
    obj = trimesh.load(path, force="mesh")
    if isinstance(obj, trimesh.Scene):
        return trimesh.util.concatenate(list(obj.geometry.values()))
    return obj


def aspect_metrics(mesh: trimesh.Trimesh) -> dict:
    v = mesh.vertices
    ext = v.max(axis=0) - v.min(axis=0)
    sorted_e = np.sort(ext)[::-1]
    return {
        "extent_xyz": [round(float(e), 3) for e in ext],
        "aspect_max_to_min": round(float(sorted_e[0] / max(sorted_e[2], 1e-6)), 2),
        "isotropy": round(float(sorted_e[2] / sorted_e[0]), 2),  # 1.0 = perfectly cube-like
    }


def render_view(ax, verts, axes_pair, title, color):
    h, v_, d = axes_pair
    order = np.argsort(verts[:, d])
    verts = verts[order]
    depth = verts[:, d]
    dnorm = (depth - depth.min()) / (depth.ptp() + 1e-9)
    alpha = 0.18 + 0.55 * dnorm
    ax.scatter(verts[:, h], verts[:, v_], s=0.6, c=color, alpha=alpha, linewidths=0, marker=".")
    ax.set_facecolor("#04060c")
    ax.set_aspect("equal")
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(title, color="#cfd6e6", fontsize=9)
    for s in ax.spines.values():
        s.set_color("#1a2236")


def render_cell(seg_id: str, label_extra: str = ""):
    mesh = load(seg_id)
    metrics = aspect_metrics(mesh)
    iso = metrics["isotropy"]
    # Heuristic: glia / astrocyte-like = isotropic (>0.55), small-aspect (<2)
    glia_score = iso if metrics["aspect_max_to_min"] < 2 else 0
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.4), facecolor="#04060c")
    color = "#7eecff" if glia_score < 0.55 else "#ffd1a8"  # peach if glial
    render_view(axes[0], mesh.vertices, (0, 1, 2), "Front (Z depth)", color)
    render_view(axes[1], mesh.vertices, (2, 1, 0), "Side (X depth)", color)
    render_view(axes[2], mesh.vertices, (0, 2, 1), "Top (Y depth)", color)
    fig.suptitle(
        f"seg {seg_id}{label_extra}\n"
        f"verts {len(mesh.vertices):,}  faces {len(mesh.faces):,}  "
        f"extents {metrics['extent_xyz']}  aspect {metrics['aspect_max_to_min']}  "
        f"isotropy {iso}  glia-suspect {'YES' if glia_score >= 0.55 else 'no'}",
        color="#dfe4ee", fontsize=10, y=0.98
    )
    fig.subplots_adjust(left=0.02, right=0.98, top=0.86, bottom=0.04, wspace=0.05)
    out = os.path.join(OUT_DIR, f"ambient-{seg_id}.png")
    fig.savefig(out, dpi=120, facecolor="#04060c")
    plt.close(fig)
    return {"segId": seg_id, **metrics, "glia_suspect": glia_score >= 0.55, "preview": out}


def main():
    with open(os.path.join(AMBIENT_DIR, "manifest.json")) as f:
        manifest = json.load(f)
    results = [render_cell(c["segId"]) for c in manifest["cells"]]
    print("\n=== Ambient cell metrics ===")
    for r in results:
        flag = "🟠 glia-suspect" if r["glia_suspect"] else "  "
        print(f"  {flag}  {r['segId']}  aspect {r['aspect_max_to_min']}  isotropy {r['isotropy']}")
        print(f"            preview: {r['preview']}")


if __name__ == "__main__":
    main()
