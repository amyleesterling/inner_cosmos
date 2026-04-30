#!/usr/bin/env python
"""Render the human-brain GLB to a favicon PNG.

Projects the decimated brain mesh into 2D (front view) and uses matplotlib's
tripcolor for a smooth gouraud-shaded silhouette. Output is transparent
PNG, sized for retina favicon use.

Outputs:
  public/brain-favicon.png   256x256, transparent background
"""
import os
import numpy as np
import trimesh
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.tri import Triangulation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "meshes", "human-brain.glb")
OUT = os.path.join(ROOT, "public", "brain-favicon.png")

# Same warm pink-violet palette as the in-scene human brain
PURPLE = LinearSegmentedColormap.from_list(
    "brain_purple",
    ["#2a1840", "#6b3a8a", "#c89cd0", "#f0d8f0"],
)


def main():
    mesh = trimesh.load(SRC, force="mesh")
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(list(mesh.geometry.values()))

    v = mesh.vertices
    f = mesh.faces

    # Front view = look down +Z onto the X-Y plane. After the extract-brain
    # transform the brain has +Y up (dorsal), so this matches matplotlib's
    # axis orientation directly.
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    shade = (z - z.min()) / (z.ptp() + 1e-9)

    triang = Triangulation(x, y, f)

    fig, ax = plt.subplots(figsize=(4, 4), facecolor="none", frameon=False)
    ax.tripcolor(triang, shade, cmap=PURPLE, shading="gouraud")
    ax.set_aspect("equal")
    ax.axis("off")
    pad = 0.04
    ax.set_xlim(x.min() - pad, x.max() + pad)
    ax.set_ylim(y.min() - pad, y.max() + pad)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    fig.savefig(OUT, dpi=64, transparent=True, pad_inches=0, bbox_inches="tight")
    plt.close(fig)
    size_kb = os.path.getsize(OUT) / 1024
    print(f"  wrote {OUT}  ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
