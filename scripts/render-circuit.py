#!/usr/bin/env python
"""Render orthographic previews of the circuit GLBs for visual confirmation.

For each cell, generates a single PNG with three views (front / side / top)
using a depth-shaded scatter so morphology is readable without a GL backend.

Usage:
    python scripts/render-circuit.py
"""
import os
import numpy as np
import trimesh
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESH_DIR = os.path.join(ROOT, "public", "meshes")
OUT_DIR = os.path.join(ROOT, "public", "previews")
os.makedirs(OUT_DIR, exist_ok=True)

CELLS = [
    ("spire",   "Spire (864691135214123064) — claimed PYRAMIDAL"),
    ("aura",    "Aura (864691135948123745) — claimed INHIBITORY"),
    ("tendril", "Tendril (864691136195546856) — claimed INHIBITORY"),
]


def load_mesh(slug: str) -> trimesh.Trimesh:
    path = os.path.join(MESH_DIR, f"{slug}.glb")
    obj = trimesh.load(path, force="mesh")
    if isinstance(obj, trimesh.Scene):
        meshes = list(obj.geometry.values())
        return trimesh.util.concatenate(meshes)
    return obj


def render_view(ax, mesh: trimesh.Trimesh, axes_pair, title: str, color: str):
    """Plot a 2D scatter of mesh vertices projected to two axes.
    axes_pair = (horizontal_axis_idx, vertical_axis_idx, depth_axis_idx)."""
    h, v, d = axes_pair
    verts = mesh.vertices
    # Sort by depth so points near the viewer overdraw distant ones.
    depth = verts[:, d]
    order = np.argsort(depth)
    verts = verts[order]
    depth = depth[order]
    # Brightness ramps with depth (front = brighter)
    dnorm = (depth - depth.min()) / (depth.ptp() + 1e-9)
    alpha = 0.15 + 0.55 * dnorm

    ax.scatter(
        verts[:, h], verts[:, v],
        s=0.4, c=color, alpha=alpha, linewidths=0, marker="."
    )
    ax.set_facecolor("#04060c")
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title(title, color="#cfd6e6", fontsize=9)
    for spine in ax.spines.values():
        spine.set_color("#1a2236")


def render_cell(slug: str, label: str, color: str = "#9bd9ff"):
    mesh = load_mesh(slug)
    n_v = len(mesh.vertices)
    n_f = len(mesh.faces)
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.4), facecolor="#04060c")

    # Mesh has been Y-flipped during extract → +Y is "up" (toward pia).
    # Front view  = look down -Z   →  X-horizontal, Y-vertical, Z-depth
    # Side view   = look down +X   →  Z-horizontal, Y-vertical, X-depth
    # Top view    = look down -Y   →  X-horizontal, Z-vertical, Y-depth
    render_view(axes[0], mesh, (0, 1, 2), "Front (looking along Z)", color)
    render_view(axes[1], mesh, (2, 1, 0), "Side (looking along X)", color)
    render_view(axes[2], mesh, (0, 2, 1), "Top (looking along Y)", color)

    fig.suptitle(
        f"{label}\n{n_v:,} verts · {n_f:,} faces",
        color="#dfe4ee", fontsize=11, y=0.98
    )
    fig.subplots_adjust(left=0.02, right=0.98, top=0.86, bottom=0.04, wspace=0.05)

    out = os.path.join(OUT_DIR, f"{slug}-preview.png")
    fig.savefig(out, dpi=120, facecolor="#04060c")
    plt.close(fig)
    print(f"  wrote {out}")
    return out


def main():
    palette = {"spire": "#c8a8ff", "aura": "#7eecff", "tendril": "#ff9fdb"}
    for slug, label in CELLS:
        render_cell(slug, label, palette.get(slug, "#9bd9ff"))


if __name__ == "__main__":
    main()
