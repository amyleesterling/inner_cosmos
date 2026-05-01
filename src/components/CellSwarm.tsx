import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  type ActivityManifest,
  type ActivityTraces,
  type ActivityCell,
  meshUrl,
  colorForCell,
} from "../data/activityCells";

interface Props {
  manifest: ActivityManifest;
  traces: ActivityTraces;
  /** Wall-clock seconds elapsed in the (looped) trace timeline. Driven by the
   *  parent's transport so the scrubber and play/pause stay in sync. */
  elapsedSec: number;
  /** Reports loading progress 0..1. */
  onProgress?: (loaded: number, total: number) => void;
  /** Reports when the scene is ready to render frames (all GLBs loaded,
   *  camera framed). Used by the headless capture pipeline. */
  onReady?: () => void;
  /** When set, OrbitControls + auto-rotate are disabled and the camera is
   *  driven from this angle instead. theta=0 looks from +Z; θ ↑ orbits east.
   *  Used for deterministic 360° loop captures. */
  captureCameraTheta?: number;
  className?: string;
}

/** Renders the full activity swarm: 200 real MICrONS pyramidal cells positioned
 *  at their true cortical coordinates, glowing in time with their measured 2P
 *  calcium activity. OrbitControls drives the camera (drag to rotate, scroll
 *  to zoom — same interaction model as the rest of the project). */
export default function CellSwarm({
  manifest,
  traces,
  elapsedSec,
  onProgress,
  onReady,
  captureCameraTheta,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(elapsedSec);
  const captureThetaRef = useRef(captureCameraTheta);
  const [ready, setReady] = useState(false);

  // Keep the latest elapsedSec + capture angle in refs so the rAF loop reads
  // them without re-binding (re-creating the scene on every parent render
  // would be a disaster with 100+ GLBs).
  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);
  useEffect(() => { captureThetaRef.current = captureCameraTheta; }, [captureCameraTheta]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 200);

    // Initial camera placement; auto-frames to the swarm bounding box once
    // the first few meshes have loaded so a single cell or 200 of them both
    // fill the canvas.
    camera.position.set(4.2, 2.8, 5.5);
    let framed = false;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const isCapture = captureThetaRef.current !== undefined;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isCapture;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = !isCapture;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 1.5;
    controls.maxDistance = 18;
    controls.enabled = !isCapture;
    // Pause auto-rotate while the user is interacting, then resume after idle.
    let resumeTimer: number | undefined;
    const stopAuto = () => {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer);
    };
    const resumeAuto = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => { controls.autoRotate = true; }, 2200);
    };
    renderer.domElement.addEventListener("pointerdown", stopAuto);
    renderer.domElement.addEventListener("pointerup", resumeAuto);
    renderer.domElement.addEventListener("pointercancel", resumeAuto);
    renderer.domElement.addEventListener("wheel", () => {
      stopAuto();
      resumeAuto();
    }, { passive: true });
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", () => { renderer.domElement.style.cursor = "grabbing"; });
    renderer.domElement.addEventListener("pointerup", () => { renderer.domElement.style.cursor = "grab"; });

    // Lighting — gentle ambient + warm key from above (mimics the cortical
    // surface direction). Most of the visible signal comes from each cell's
    // own emissive material when it's firing.
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(2.5, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6080ff, 0.25);
    fill.position.set(-3, -1, -3);
    scene.add(fill);

    // Per-cell state, indexed parallel to manifest.cells.
    const cells: Array<{
      cell: ActivityCell;
      group: THREE.Group;
      materials: THREE.MeshStandardMaterial[];
      baseColor: THREE.Color;
      hotColor: THREE.Color;
    }> = [];

    const loader = new GLTFLoader();
    let cancelled = false;
    let loadedCount = 0;
    const total = manifest.cells.length;

    // Distribute loads across a small concurrency window so the network
    // doesn't bottleneck on a single inflight request and we stream in
    // visibly.
    const CONCURRENCY = 8;
    const queue = [...manifest.cells];

    function loadNext() {
      if (cancelled) return;
      const cell = queue.shift();
      if (!cell) return;
      const baseColor = new THREE.Color(colorForCell(cell.segId));
      // Peak colour: the cell's own hue, brightened — keeps each cell's
      // identity visible at the moment it fires. (Lerping all to white at
      // peak homogenised the swarm; a saturated palette deserves saturated
      // peaks too.)
      const hotColor = baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.45);
      loader.load(
        meshUrl(cell),
        (gltf) => {
          if (cancelled) return;
          const group = new THREE.Group();
          const materials: THREE.MeshStandardMaterial[] = [];
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              const mat = new THREE.MeshStandardMaterial({
                color: baseColor,
                emissive: baseColor.clone().multiplyScalar(0.35),
                emissiveIntensity: 0.5,
                metalness: 0.05,
                roughness: 0.6,
                transparent: true,
                opacity: 0.92,
              });
              obj.material = mat;
              materials.push(mat);
              group.add(obj);
            }
          });
          scene.add(group);
          cells.push({ cell, group, materials, baseColor, hotColor });
          loadedCount += 1;
          onProgress?.(loadedCount, total);
          // First-frame camera positioning: once all (or a meaningful prefix
          // of) meshes have loaded, fit the swarm bbox into the viewport.
          if (!framed && (loadedCount === total || loadedCount >= 12)) {
            framed = true;
            const bbox = new THREE.Box3();
            for (const c of cells) bbox.expandByObject(c.group);
            if (!bbox.isEmpty()) {
              const size = new THREE.Vector3();
              bbox.getSize(size);
              bbox.getCenter(swarmCenter);
              const radius = Math.max(size.x, size.y, size.z) * 0.6 + 0.4;
              const fov = (camera.fov * Math.PI) / 180;
              swarmRadius = radius / Math.tan(fov / 2);
              camera.position.set(
                swarmCenter.x + swarmRadius * 0.7,
                swarmCenter.y + swarmRadius * 0.45,
                swarmCenter.z + swarmRadius * 0.85,
              );
              camera.lookAt(swarmCenter);
              controls.target.copy(swarmCenter);
              controls.minDistance = Math.max(0.4, swarmRadius * 0.25);
              controls.maxDistance = swarmRadius * 6;
              controls.update();
            }
          }
          if (loadedCount === total) {
            setReady(true);
            onReady?.();
          }
          loadNext();
        },
        undefined,
        () => {
          // Skip silently — bad GLB, just move on.
          loadedCount += 1;
          onProgress?.(loadedCount, total);
          if (loadedCount === total) setReady(true);
          loadNext();
        },
      );
    }
    for (let i = 0; i < CONCURRENCY; i++) loadNext();

    // Pre-allocated scratch color so we don't allocate every frame.
    const scratch = new THREE.Color();

    // Swarm bounding sphere — populated once meshes start landing. The
    // capture-mode camera orbits at swarmRadius around swarmCenter so the
    // recorded loop tracks the swarm as it gets discovered, even if the
    // camera was queued before all cells were loaded.
    const swarmCenter = new THREE.Vector3();
    let swarmRadius = 6;

    let frameId = 0;
    const animate = () => {
      const theta = captureThetaRef.current;
      if (theta !== undefined) {
        // Drive camera deterministically — one full revolution per loop.
        // Slight upward tilt so the swarm reads as 3D, not flat.
        const tiltY = swarmRadius * 0.35;
        camera.position.set(
          swarmCenter.x + swarmRadius * Math.cos(theta),
          swarmCenter.y + tiltY,
          swarmCenter.z + swarmRadius * Math.sin(theta),
        );
        camera.lookAt(swarmCenter);
      } else {
        controls.update();
      }

      // Look up activity at the current looped time.
      const totalSec = manifest.seconds;
      const t = ((elapsedRef.current % totalSec) + totalSec) % totalSec;
      const fIdx = Math.min(traces.frames - 1, Math.floor(t * traces.fps));
      const rowOffset = fIdx * traces.cells;

      // Drive each cell's emissive intensity from its trace value. We map
      // [0,1] activity → [0.4, 4.5] emissiveIntensity, and lerp the emissive
      // color from the cell's base hue toward warm-white at peak — together
      // these read as a glow that pulses with the calcium signal.
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const a = traces.data[rowOffset + i] ?? 0;
        const intensity = 0.4 + a * a * 4.1; // gamma > 1 makes peaks pop
        scratch.copy(c.baseColor).lerp(c.hotColor, Math.min(1, a * 1.3));
        for (let m = 0; m < c.materials.length; m++) {
          c.materials[m].emissive.copy(scratch);
          c.materials[m].emissiveIntensity = intensity;
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(resumeTimer);
      observer.disconnect();
      controls.dispose();
      for (const c of cells) {
        c.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m.dispose();
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
    // We intentionally bind manifest+traces ONCE; updates would invalidate
    // the entire scene. Caller is expected to remount on dataset change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, traces]);

  return (
    <div ref={containerRef} className={className}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/40 text-xs uppercase tracking-[0.3em]">loading swarm…</div>
        </div>
      )}
    </div>
  );
}
