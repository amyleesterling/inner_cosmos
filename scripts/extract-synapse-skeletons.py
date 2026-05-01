#!/usr/bin/env python
"""Fetch CAVE skeletons for Aura + Tendril and resample three paths along the
mesh skeleton (NOT straight lines) for the action-potential animation:

  1. tendril       - axon distal tip -> synapse contact
  2. aura_apical   - synapse contact -> Aura soma (down the post-synaptic dendrite)
  3. aura_axon     - Aura soma       -> axon distal tip

Skeletons come back as a graph (vertices + edges, in nm). For each path:
  - find the source/target skeleton vertices (closest to the synapse coord
    or via geodesic-farthest-leaf for the distal tips)
  - Dijkstra over the tree to get the actual sequence of skeleton vertices
  - resample to a uniform-arc-length sequence of N points
  - transform to the shared synapse-centered frame matching the GLBs
    (subtract synapse nm, multiply by SHARED_SCALE, Y-flip)

Output: public/meshes/synapse-skeletons.json
"""
import os
import json
import time
import heapq
from collections import defaultdict
import numpy as np
from caveclient import CAVEclient

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "meshes")
os.makedirs(OUT_DIR, exist_ok=True)

# Same constants as extract-synapse-pair.py - must stay in sync so the
# resampled skeleton paths land in the GLBs' shared frame.
SYN_VOX = np.array([175661, 152147, 21899])
VOXEL_NM = np.array([4, 4, 40])
SYN_NM = SYN_VOX * VOXEL_NM
SHARED_SCALE = 1.0 / 600000.0

AURA_ID = 864691135948123745
TENDRIL_ID = 864691136195546856

# Sample density per path. 200 is well above what the 60Hz animation needs.
N_SAMPLES = 200


def to_shared_frame(verts_nm: np.ndarray) -> np.ndarray:
    v = (verts_nm - SYN_NM) * SHARED_SCALE
    v = v.copy()
    v[:, 1] *= -1
    return v


def build_adj(verts: np.ndarray, edges: np.ndarray):
    adj = defaultdict(list)
    for a, b in edges:
        a = int(a)
        b = int(b)
        d = float(np.linalg.norm(verts[a] - verts[b]))
        adj[a].append((b, d))
        adj[b].append((a, d))
    return adj


def dijkstra_distances(adj, src: int):
    """Return dict of geodesic distance from src to every reachable vertex."""
    dist = {src: 0.0}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist


def shortest_path(adj, src: int, dst: int):
    dist = {src: 0.0}
    prev = {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if dst != src and dst not in prev:
        raise RuntimeError(f"no path from {src} to {dst}")
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    path.reverse()
    return path


def find_leaves(edges: np.ndarray, n: int) -> np.ndarray:
    deg = np.zeros(n, dtype=int)
    for a, b in edges:
        deg[int(a)] += 1
        deg[int(b)] += 1
    return np.where(deg == 1)[0]


def resample(verts_shared: np.ndarray, path, n: int):
    """Resample N evenly-spaced points along a polyline in shared-frame coords."""
    pts = verts_shared[path]
    cum = np.zeros(len(pts))
    for i in range(1, len(pts)):
        cum[i] = cum[i - 1] + float(np.linalg.norm(pts[i] - pts[i - 1]))
    total = cum[-1]
    if total <= 0:
        return [pts[0].tolist()] * n
    samples = np.linspace(0.0, total, n)
    out = np.zeros((n, 3))
    j = 0
    for i, s in enumerate(samples):
        while j < len(cum) - 1 and cum[j + 1] < s:
            j += 1
        if j >= len(cum) - 1:
            out[i] = pts[-1]
        else:
            denom = cum[j + 1] - cum[j]
            t = 0.0 if denom <= 0 else (s - cum[j]) / denom
            out[i] = pts[j] * (1 - t) + pts[j + 1] * t
    return out.tolist()


def fetch_skel(client: CAVEclient, seg_id: int):
    t0 = time.time()
    sk = client.skeleton.get_skeleton(seg_id, output_format="dict")
    print(f"  fetched seg {seg_id} in {time.time()-t0:.1f}s")
    verts = np.array(sk["vertices"], dtype=float)
    edges = np.array(sk["edges"], dtype=int)
    root = int(sk["root"])
    compartment = np.array(sk["compartment"], dtype=int)
    return verts, edges, root, compartment


def main():
    client = CAVEclient("minnie65_public")

    # ---- AURA - postsynaptic pyramidal cell -------------------------------
    print(f"\n[Aura  {AURA_ID}]")
    aura_verts, aura_edges, aura_root, aura_comp = fetch_skel(client, AURA_ID)
    aura_adj = build_adj(aura_verts, aura_edges)
    print(f"  verts={len(aura_verts):,}  edges={len(aura_edges):,}  root={aura_root}")

    # Synapse vertex on Aura: skeleton vertex closest to the synapse coord.
    syn_dists_aura = np.linalg.norm(aura_verts - SYN_NM, axis=1)
    aura_syn_idx = int(syn_dists_aura.argmin())
    print(f"  synapse vertex: idx={aura_syn_idx}  dist={syn_dists_aura.min():.0f} nm")

    # Axon distal tip: leaf vertex along compartment 2 (axon) at greatest
    # geodesic distance from the soma.
    aura_dist_from_soma = dijkstra_distances(aura_adj, aura_root)
    leaves = find_leaves(aura_edges, len(aura_verts))
    axon_leaves = [int(l) for l in leaves if aura_comp[l] == 2]
    if not axon_leaves:
        axon_leaves = [int(l) for l in leaves if l != aura_root]
    aura_axon_end = max(axon_leaves, key=lambda l: aura_dist_from_soma.get(l, 0.0))
    print(
        f"  axon distal tip: idx={aura_axon_end}  "
        f"dist from soma={aura_dist_from_soma[aura_axon_end]:.0f} nm  "
        f"compartment={aura_comp[aura_axon_end]}"
    )

    apical_path = shortest_path(aura_adj, aura_syn_idx, aura_root)
    axon_path = shortest_path(aura_adj, aura_root, aura_axon_end)
    print(f"  apical path: {len(apical_path)} verts")
    print(f"  axon path:   {len(axon_path)} verts")

    aura_shared = to_shared_frame(aura_verts)
    apical_pts = resample(aura_shared, apical_path, N_SAMPLES)
    axon_pts = resample(aura_shared, axon_path, N_SAMPLES)

    # ---- TENDRIL - presynaptic long-range axon ----------------------------
    print(f"\n[Tendril {TENDRIL_ID}]")
    t_verts, t_edges, t_root, t_comp = fetch_skel(client, TENDRIL_ID)
    t_adj = build_adj(t_verts, t_edges)
    print(f"  verts={len(t_verts):,}  edges={len(t_edges):,}  root={t_root}")

    syn_dists_t = np.linalg.norm(t_verts - SYN_NM, axis=1)
    tendril_syn_idx = int(syn_dists_t.argmin())
    print(f"  synapse vertex: idx={tendril_syn_idx}  dist={syn_dists_t.min():.0f} nm")

    # Far end: geodesic-farthest leaf from the synapse vertex
    t_dist_from_syn = dijkstra_distances(t_adj, tendril_syn_idx)
    t_leaves = find_leaves(t_edges, len(t_verts))
    tendril_far = max([int(l) for l in t_leaves], key=lambda l: t_dist_from_syn.get(l, 0.0))
    print(
        f"  far end: idx={tendril_far}  "
        f"dist from synapse={t_dist_from_syn[tendril_far]:.0f} nm"
    )

    tendril_path = shortest_path(t_adj, tendril_far, tendril_syn_idx)
    print(f"  tendril path: {len(tendril_path)} verts")

    tendril_shared = to_shared_frame(t_verts)
    tendril_pts = resample(tendril_shared, tendril_path, N_SAMPLES)

    # ---- Save -------------------------------------------------------------
    payload = {
        "meta": {
            "synapseNm": SYN_NM.tolist(),
            "sharedScale": SHARED_SCALE,
            "nSamples": N_SAMPLES,
            "frameNote": (
                "Points are in the same shared synapse-centered frame as "
                "synapse-aura.glb / synapse-tendril.glb (subtract synapseNm, "
                "scale by sharedScale, Y-flip)."
            ),
            "auraSegId": str(AURA_ID),
            "tendrilSegId": str(TENDRIL_ID),
        },
        "tendril": {
            "description": "Tendril axon distal tip to synapse contact",
            "fromIdx": int(tendril_far),
            "toIdx": int(tendril_syn_idx),
            "lengthNm": float(t_dist_from_syn[tendril_far]),
            "points": tendril_pts,
        },
        "aura_apical": {
            "description": "Aura post-synaptic dendrite: synapse contact to soma",
            "fromIdx": int(aura_syn_idx),
            "toIdx": int(aura_root),
            "lengthNm": float(aura_dist_from_soma[aura_syn_idx]),
            "points": apical_pts,
        },
        "aura_axon": {
            "description": "Aura axon: soma to distal tip",
            "fromIdx": int(aura_root),
            "toIdx": int(aura_axon_end),
            "lengthNm": float(aura_dist_from_soma[aura_axon_end]),
            "points": axon_pts,
        },
    }

    out_path = os.path.join(OUT_DIR, "synapse-skeletons.json")
    with open(out_path, "w") as f:
        json.dump(payload, f)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"\nWrote {out_path}  ({size_kb:.1f} KB)")

    for key in ("tendril", "aura_apical", "aura_axon"):
        p = payload[key]["points"]
        print(
            f"  {key}: start={[round(c, 3) for c in p[0]]}  "
            f"end={[round(c, 3) for c in p[-1]]}  "
            f"length={payload[key]['lengthNm']/1000:.0f} um"
        )


if __name__ == "__main__":
    main()
