/**
 * Translate a Neuroglancer view state into a three.js camera transform.
 *
 * Phase 0 implementation is a *deliberate* approximation: it positions the
 * three.js camera on the +Z axis from the NG focus point at a distance
 * derived from `projectionScale`. Good enough to verify the cube is in the
 * right neighbourhood. Far from frame-perfect.
 *
 * Phase 2 will replace this with direct projection-matrix mirroring. The
 * gnarly bits to get right then:
 *   - NG voxel coords → world coords: multiply by the per-axis voxel size
 *     in metres (the `dimensions` field).
 *   - NG axis convention is z-up, right-handed. three.js defaults are y-up.
 *     Either swap basis vectors or just rotate the scene root.
 *   - NG's projection isn't a fixed-FOV perspective; it's a custom matrix
 *     parameterised by projectionScale + canvas height. Best path:
 *       camera.projectionMatrix.fromArray(ngProjectionMatrix);
 *       camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 *       camera.matrixAutoUpdate = false;
 *     and write `camera.matrixWorld` directly from NG's view matrix.
 */
import * as THREE from "three";
import type { NgViewState } from "./ng-bridge.ts";

export function syncCameraFromNgState(
  state: NgViewState,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  // Convert NG voxel position → "scene" coords (still in nanometres, since
  // the cube in main.ts is also placed in voxel-nm space). Multiplying by
  // dimensions[i] would convert to metres; keep nm here for symmetry.
  const focus = new THREE.Vector3(
    state.position[0],
    state.position[1],
    state.position[2],
  );

  // Phase-0 hack: ignore orientation, place camera on +Y from focus, looking
  // back. Distance proportional to projectionScale (which is roughly the
  // half-width of the orthographic frustum in NG voxel units).
  const dist = Math.max(state.projectionScale, 1) * 1.5;
  const offset = new THREE.Vector3(dist * 0.6, dist * 0.4, dist * 0.85);
  const camPos = focus.clone().add(offset);

  camera.position.copy(camPos);
  camera.up.set(0, 0, 1); // NG is z-up; keep three's up vector aligned for now
  camera.lookAt(focus);
  camera.updateMatrix();
  camera.updateMatrixWorld();

  // Adjust near/far for the very large coordinate ranges (positions are in nm).
  const range = dist * 8;
  camera.near = Math.max(0.001, dist * 0.01);
  camera.far = range;
  camera.updateProjectionMatrix();

  // Match canvas size to the iframe (resize is handled in main.ts but
  // re-asserting here is cheap).
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
