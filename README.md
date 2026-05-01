# Inner Cosmos

A public-facing brain explorer that lets anyone wander through real connectomics data with no log-in, no jargon, and no microscope required.

**Live demo:** [amyleesterling.github.io/inner_cosmos/](https://amyleesterling.github.io/inner_cosmos/)

Every neuron you see is a real cell from the [MICrONS minnie65](https://www.microns-explorer.org/) volume — every dendrite, every spine, reconstructed from electron microscopy. Nothing on screen is illustrative.

## What's in it

- **Landing** — cinematic hero with drifting neurons in the background.
- **Meet a Neuron** — six characters from the cortex with shape-nicknames (Lightning Tree, Coral Fan, Candelabra, Reaching Hand, Dust Star, Forest Floor). Each rotates as a real EM-reconstructed mesh.
- **Explorer** — a 5-stage guided zoom: whole brain → visual cortex → cubic millimeter → single neuron → synapse. Use ← → to step through.

## Stack

- Vite + React + TypeScript
- Tailwind v4 (theme tokens in `src/index.css`)
- Three.js for all 3D (no react-three-fiber)
- Framer Motion for UI motion
- React Router for `/`, `/meet`, `/meet/:id`, `/explore`

## Data pipeline

Each featured cell ships as a web-optimized `.glb` in `public/meshes/`. They're produced offline by `scripts/extract-meshes.py`, which:

1. Pulls the assembled mesh from `gs://iarpa_microns/minnie/minnie65/seg_m1300` via [`cloud-volume`](https://github.com/seung-lab/cloud-volume).
2. Centers + scales + flips Y so the apical dendrite of pyramidal cells points up in three.js.
3. Decimates with [`fast_simplification`](https://github.com/pyvista/fast-simplification)'s quadric edge collapse to ~80–130K faces (per-cell budget tuned for visible spines).
4. Exports as binary glTF via `trimesh`.

To regenerate the meshes (e.g. swap in a different seg ID, change the face budget):

```bash
python scripts/extract-meshes.py
```

`scripts/find-central-cell.py` is a small helper that scans candidate seg IDs and picks the one closest to the volume center, useful when a chosen cell turns out to be cut off at the imaged-volume edge.

## Run locally

```bash
npm install
npm run dev
```

Then open the dev URL it prints.

## Pre-render the /activity 360° loop to MP4

The `/activity` page can be captured to a video file using a headless
browser. The capture mode hides all UI chrome and drives the camera +
calcium time deterministically — one full revolution per loop, the
calcium activity playing simultaneously.

```bash
# one-time setup (downloads ~150 MB of Chromium for Playwright)
npx playwright install chromium

# in one terminal — leave running
npm run dev

# in another terminal — outputs public/activity-loop.mp4
npm run render-video
```

By default the script captures at 1280×800 / 30 fps. Override:

```bash
npm run render-video -- --width 1080 --height 1080 --fps 30
```

The render takes ~2–5 minutes on a machine with a real GPU; software
WebGL (e.g. inside a container with no GPU passthrough) is dramatically
slower. Requires `ffmpeg` on your `PATH` for encoding.

## Build & deploy

```bash
npm run build
npm run preview
```

The site auto-deploys to GitHub Pages on push to `master` via `.github/workflows/deploy.yml`.

## Cell credits

| Card | Type | MICrONS minnie65 seg ID |
|---|---|---|
| Lightning Tree | Layer 5 thick-tufted pyramidal | `864691135572530981` |
| Coral Fan | Parvalbumin basket | `864691136662432990` |
| Candelabra | Chandelier | `864691135572094189` |
| Reaching Hand | Martinotti | `864691135919630768` |
| Dust Star | Layer 4 cell | `864691135279086497` |
| Forest Floor | Protoplasmic astrocyte | `864691135113162137` |

All sourced from the curated [MICrONS Explorer mm3 gallery](https://www.microns-explorer.org/gallery-mm3).
