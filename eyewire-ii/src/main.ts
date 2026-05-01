/**
 * Eyewire II — three.js animation overlay over Neuroglancer.
 *
 * Phase 0 / hello-cube:
 *   - Loads a Neuroglancer view in an iframe.
 *   - Stacks a transparent three.js canvas on top with pointer-events: none.
 *   - Drops a single cube at a known voxel coordinate inside the volume.
 *   - "Sync once" reads NG's view state and computes a three.js camera
 *     transform; "Toggle live sync" runs the same loop every animation frame.
 *
 * The hard part — exact projection-matrix mirroring — is intentionally
 * left as a stub here. See README.md "Phase 2 — Live camera sync" and
 * "Camera-sync fidelity" for the path forward.
 */
import * as THREE from "three";
import { syncCameraFromNgState, type NgViewState } from "./camera-sync.ts";
import { readNgState } from "./ng-bridge.ts";

// Default Neuroglancer state — small MICrONS minnie65 segmentation view as
// a starting volume. Replace with whatever volume you're animating.
const DEFAULT_NG_URL =
  "https://neuroglancer-demo.appspot.com/#!%7B%22dimensions%22:%7B%22x%22:%5B8e-9,%22m%22%5D,%22y%22:%5B8e-9,%22m%22%5D,%22z%22:%5B4e-8,%22m%22%5D%7D,%22position%22:%5B161000,99000,21000%5D,%22crossSectionScale%22:8,%22projectionScale%22:131072,%22layers%22:%5B%7B%22type%22:%22image%22,%22source%22:%22precomputed://gs://iarpa_microns/minnie/minnie65/em%22,%22name%22:%22em%22%7D,%7B%22type%22:%22segmentation%22,%22source%22:%22precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300%22,%22segments%22:%5B%22864691135572530981%22%5D,%22name%22:%22seg%22%7D%5D,%22selectedLayer%22:%7B%22visible%22:true,%22layer%22:%22seg%22%7D,%22layout%22:%223d%22%7D";

const ngFrame = document.getElementById("ng-frame") as HTMLIFrameElement;
const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
const status = document.getElementById("status")!;
const btnSync = document.getElementById("btn-sync")!;
const btnLive = document.getElementById("btn-live")!;

ngFrame.src = DEFAULT_NG_URL;

// Three.js scene — one cube at a fixed world position. Once camera sync
// works, this cube should stay glued to that point as you pan/rotate NG.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1e9);
camera.matrixAutoUpdate = false; // we'll write the matrix directly

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);

// Cube positioned at the same MICrONS voxel coordinate as the NG view's
// `position` above (in NG's voxel space). Phase 2 turns this into a
// proper world-space registration.
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2000, 2000, 800), // ~16 µm cube in nm
  new THREE.MeshBasicMaterial({ color: 0xffaa3e, transparent: true, opacity: 0.85 }),
);
cube.position.set(161000, 99000, 21000);
scene.add(cube);

const axes = new THREE.AxesHelper(20000);
axes.position.copy(cube.position);
scene.add(axes);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

let liveSync = false;

async function syncOnce(): Promise<void> {
  const state: NgViewState | null = await readNgState(ngFrame);
  if (!state) {
    status.textContent = "could not read NG state — see console";
    console.warn("readNgState returned null");
    return;
  }
  syncCameraFromNgState(state, camera, renderer);
  status.textContent = `pos=[${state.position.map((v) => v.toFixed(0)).join(", ")}]  scale=${state.projectionScale.toFixed(1)}`;
}

btnSync.addEventListener("click", () => void syncOnce());
btnLive.addEventListener("click", () => {
  liveSync = !liveSync;
  btnLive.textContent = liveSync ? "Live sync: ON" : "Toggle live sync";
});

function tick() {
  if (liveSync) void syncOnce();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
