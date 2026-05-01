# Eyewire II — three.js animation layer over Neuroglancer

Render time-series animations (calcium activity, AP propagation, synaptic events)
directly on top of Neuroglancer's EM volume + segmentation, so the cinematic
three.js art layer and the scientific connectomics inspector live in the same view.

## Status

**Phase 0 — design + scaffold.** Plan is written, build tooling is ready,
hello-cube is stubbed. Camera sync (the hard part) is documented but not
implemented.

## Why

Neuroglancer is the de-facto viewer for connectomics — every MICrONS / FlyWire /
H01 paper points there. But it's a static-state inspector: no animation, no
time scrubbing, no way to drive cell colour from a trace.

Three.js is the opposite — beautifully animated but missing the science chrome
(proper EM, segmentation, click-to-inspect, layer toggles, the standard URL
state that scientists already share with each other).

This repo prototypes a way to keep both: Neuroglancer underneath, three.js
composited on top, sharing one camera.

## Architecture

```
┌─────────────────────────────────────────┐
│  page                                   │
│  ┌───────────────────────────────────┐  │
│  │  three.js canvas (overlay)        │  │
│  │  pointer-events: none             │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  neuroglancer (iframe)      │  │  │
│  │  │  pointer-events: auto       │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

camera-sync.ts:
  every frame
    read NG view state (position, orientation, zoom)
    translate to three.js camera projection matrix
    render three.js scene
```

Three.js draws a transparent canvas that sits on top of the Neuroglancer
iframe. Pointer events pass through to Neuroglancer so all the existing
interaction (drag-to-pan, scroll-to-zoom, alt-drag-to-rotate, click-to-select)
keeps working. Each frame, the overlay reads Neuroglancer's view state, mirrors
it into a `THREE.PerspectiveCamera`, and renders.

## Phases

### Phase 1 — Hello cube *(this scaffold)*
- Vite + TS + three.js skeleton.
- Neuroglancer in iframe with a known volume open.
- Three.js canvas positioned over it with one cube at a fixed world coord.
- Manual `Sync` button reads NG state once, computes three.js camera, redraws.
- Goal: prove the overlay positions correctly at *one* moment in time.

### Phase 2 — Live camera sync
- Poll NG state every 33 ms (or hook into NG's draw event via cross-frame
  messaging if accessible — see Open Questions).
- Match three.js projection to NG's view matrix exactly. Likely best to
  bypass three.js's `PerspectiveCamera` projection abstraction entirely:
  build the projection matrix manually from NG's state, assign it to
  `camera.projectionMatrix` directly with `matrixAutoUpdate = false`.
- Verify cube stays glued to its world coord under pan / rotate / zoom.

### Phase 3 — Animation primitives
Port from `inner_cosmos`:
- Per-segment colour driven by a time-indexed activity array (the /activity
  glow effect — already prototyped in `src/components/CellSwarm.tsx`).
- Spike-burst particles at action-potential moments (already prototyped in
  the AP-pulse hero of /explore).
- Synapse-event ripples.

All three are `THREE.Object3D`s, all positioned in NG world coordinates.

### Phase 4 — Data model
A simple JSON manifest:
```json
{
  "ngState": "<full neuroglancer state url or json>",
  "tracks": [
    { "type": "trace", "segId": "...", "fps": 30, "data": [...] },
    { "type": "spike", "atPoint": [x,y,z], "times": [t1, t2, ...] },
    { "type": "synapse", "atPoint": [x,y,z], "times": [...] }
  ]
}
```
Drop a manifest URL on a Neuroglancer view → animation appears.

### Phase 5 — Inner Cosmos integration
Once Phase 3 works:
- `/activity` becomes a "deep dive" mode: click a glowing cell, the camera
  dives into Neuroglancer with the surrounding circuit visible — but the
  glow effect persists, now sitting on real EM.
- `/explore` stage 5 (synapse close-up) gets a Neuroglancer-anchored variant
  where the AP path travels along real reconstructed cells through a real
  synapse.

## Open questions

### Camera-sync fidelity
Neuroglancer's projection isn't a standard perspective — it scales dynamically
with `crossSectionScale` / `projectionScale`. In 3D mode it's perspective-ish
but the FOV is implicit in the scale parameter and the canvas height.

Easiest fix: skip three.js's projection abstraction entirely, build the
projection matrix manually from NG's state and feed it to `camera.projectionMatrix`
directly with `matrixAutoUpdate = false`.

To pull the matrix out of NG: load NG with the `noUserMessages` URL flag,
then `viewer.display.panels` (NG's internal API) exposes the active panel's
`renderViewport` + `viewMatrix`. There's also a [postMessage API](https://github.com/google/neuroglancer/blob/master/src/python_integration/state_share_with_python.ts)
used by the Python integration that exposes view state — same data, more
public surface.

### Coordinate frames
NG voxel coords are right-handed, z-up; three.js defaults y-up. We need a
basis swap in the camera transform. Pin one cell at a known seg position
in both views and verify they line up before moving on.

### Resize handling
NG iframe resize must trigger `renderer.setSize()`. Use `ResizeObserver` on
the iframe element.

### Touch events
Overlay canvas with `pointer-events: none` should let touches reach NG.
iOS Safari sometimes routes wheel events oddly across iframes — needs
testing on real hardware.

### Performance
Rendering on every NG frame is fine on desktop, but stacked WebGL contexts
on mobile can chew battery. Profile early; if needed, throttle the overlay
to 30 fps independent of NG's redraw rate.

### NG embed surface
Two options for embedding NG:
1. `<iframe src="https://neuroglancer-demo.appspot.com/...">` — easy, but
   loses fine control over render hooks.
2. Self-host the Neuroglancer bundle and import it as a library. Gives full
   programmatic control (you can subscribe to `viewer.display.changed.add`
   for redraw events) but requires building Neuroglancer.

Phase 1 should use option 1; Phase 2+ probably needs option 2 for proper
event coupling.

## Stack

- Vite 8 + TypeScript
- `three` (no react-three-fiber — direct API, same as inner_cosmos)
- Neuroglancer loaded from `https://neuroglancer-demo.appspot.com/` (Phase 1)
  or self-hosted bundle (Phase 2+)

## Run locally

```bash
cd eyewire-ii
npm install
npm run dev
```

## Spin-out into its own repo

Until this lives at `github.com/<you>/eyewire-ii` it's vendored under
`inner_cosmos/eyewire-ii/`. To extract into a fresh repo with full history:

```bash
# from the inner_cosmos repo root, after this directory has commits:
git subtree split --prefix=eyewire-ii -b eyewire-ii-split

# create empty repo elsewhere, then:
git clone --bare /path/to/inner_cosmos eyewire-ii.git
cd eyewire-ii.git
git push https://github.com/<you>/eyewire-ii.git eyewire-ii-split:main
```

## Roadmap signal

Once Phase 2 (live sync) works on a single fixed cube, this repo proves the
approach. After that, the actual content is mostly a port of the inner_cosmos
animation primitives.
