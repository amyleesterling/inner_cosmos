import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Pastel palette tuned to read at low opacity over the dark hero background.
const PALETTE = [
  new THREE.Color("#7ee0ff"),
  new THREE.Color("#b78bff"),
  new THREE.Color("#ff7ee0"),
  new THREE.Color("#ffd9a8"),
  new THREE.Color("#9af5d8"),
  new THREE.Color("#aedeff"),
];

const BASE = import.meta.env.BASE_URL;

interface AmbientCell {
  segId: string;
  source: string;
  fileKB: number;
  faces: number;
}
interface Manifest {
  cells: AmbientCell[];
}

interface Instance {
  group: THREE.Group;
  basePos: THREE.Vector3;
  spinSpeed: THREE.Vector3;
  driftPhase: number;
  driftAmplitude: number;
}

// We instance each cell N times to fill the field even if the pool is small.
const INSTANCES_PER_CELL = 6;

export default function LandingNeurons() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060c, 0.045);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 9);

    // Pull camera back for narrow viewports — but stay closer than before so
    // cells read as actual cells rather than distant ambient flecks.
    const updateCameraForAspect = () => {
      const aspect = camera.aspect;
      const fovV = THREE.MathUtils.degToRad(camera.fov);
      const horizHalf = Math.atan(aspect * Math.tan(fovV / 2));
      const targetHorizUnits = 7;
      const requiredZ = targetHorizUnits / 2 / Math.tan(horizHalf);
      camera.position.z = Math.max(9, Math.min(18, requiredZ));
    };
    updateCameraForAspect();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // OrbitControls — drag/touch to look around the cell field, scroll/pinch
    // to zoom in. Auto-rotation of individual cells continues underneath.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.minDistance = 4;
    controls.maxDistance = 30;
    // Lock camera vertical motion so the user can pan around horizontally
    // without losing the upright reading of cells.
    controls.minPolarAngle = Math.PI / 2.4;
    controls.maxPolarAngle = Math.PI / 1.7;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", () => {
      renderer.domElement.style.cursor = "grabbing";
    });
    renderer.domElement.addEventListener("pointerup", () => {
      renderer.domElement.style.cursor = "grab";
    });

    // Soft global lights — emissive does most of the work
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(2, 3, 4);
    scene.add(key);

    const instances: Instance[] = [];
    let cancelled = false;

    // Mouse parallax target
    const target = new THREE.Vector2(0, 0);
    const current = new THREE.Vector2(0, 0);

    function placeInstance(group: THREE.Group) {
      const aspect = camera.aspect;
      // Tighter spread so cells stay near the visible field at the closer
      // camera distance — they read as a small nearby population, not a
      // sparse distant cloud.
      const xSpread = aspect > 1 ? 6 : aspect * 6;
      const ySpread = aspect > 1 ? 3.5 : 3.5 / aspect;
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * xSpread * 2,
        (Math.random() - 0.5) * ySpread * 2,
        (Math.random() - 0.5) * 7 - 1,
      );
      group.position.copy(pos);
      // Initial Y rotation only — cells stand upright and pirouette around
      // their vertical axis, like ballerinas. No tipping or rolling.
      group.rotation.set(0, Math.random() * Math.PI * 2, 0);
      // 3x bigger than the prior 1.0–1.9 range → 3.0–5.7. With camera at
      // z=9 these read as nearby cells filling the field rather than distant
      // specks.
      const scale = 3.0 + Math.random() * 2.7;
      group.scale.setScalar(scale);

      instances.push({
        group,
        basePos: pos.clone(),
        // Y-axis only spin — pirouette. X and Z are zeroed so cells never
        // tip or roll, only turn in place around their vertical axis.
        spinSpeed: new THREE.Vector3(
          0,
          (Math.random() < 0.5 ? -1 : 1) * (0.0004 + Math.random() * 0.0008),
          0,
        ),
        driftPhase: 0,
        driftAmplitude: 0, // No vertical drift — cells stay put in space.
      });
    }

    fetch(`${BASE}meshes/ambient/manifest.json`)
      .then((r) => r.json())
      .then((manifest: Manifest) => {
        if (cancelled) return;
        const loader = new GLTFLoader();
        manifest.cells.forEach((cell, cellIdx) => {
          loader.load(
            `${BASE}meshes/ambient/${cell.segId}.glb`,
            (gltf) => {
              if (cancelled) return;

              // Collect source meshes BEFORE wrapping (avoid traverse infinite recursion)
              const sourceMeshes: THREE.Mesh[] = [];
              gltf.scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
              });

              // Re-center the geometry once (shared across all instances)
              const bbox = new THREE.Box3().setFromObject(gltf.scene);
              const center = new THREE.Vector3();
              bbox.getCenter(center);
              for (const obj of sourceMeshes) {
                obj.geometry.translate(-center.x, -center.y, -center.z);
              }

              // Build INSTANCES_PER_CELL groups, each with a different color +
              // independent material so hover/age effects don't bleed across.
              for (let i = 0; i < INSTANCES_PER_CELL; i++) {
                const color = PALETTE[(cellIdx * INSTANCES_PER_CELL + i) % PALETTE.length].clone();
                const group = new THREE.Group();
                for (const src of sourceMeshes) {
                  const mat = new THREE.MeshStandardMaterial({
                    color,
                    emissive: color.clone().multiplyScalar(0.45),
                    metalness: 0.0,
                    roughness: 0.7,
                    transparent: true,
                    opacity: 0.65,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                  });
                  // Shared geometry, per-instance material
                  const mesh = new THREE.Mesh(src.geometry, mat);
                  group.add(mesh);

                  // Faint wireframe overlay
                  const wireMat = new THREE.MeshBasicMaterial({
                    color,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.08,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                  });
                  const wireMesh = new THREE.Mesh(src.geometry, wireMat);
                  group.add(wireMesh);
                }
                placeInstance(group);
                scene.add(group);
              }
            },
            undefined,
            (err) => console.error(`failed to load ${cell.segId}`, err),
          );
        });
      })
      .catch((e) => console.error("ambient manifest", e));

    const onMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.4;
      target.y = -(e.clientY / window.innerHeight - 0.5) * 0.25;
    };
    window.addEventListener("mousemove", onMove);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      updateCameraForAspect();
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frameId = 0;
    const animate = () => {
      // Mouse parallax is now subordinate to OrbitControls — when the user
      // hasn't grabbed the canvas, parallax still nudges the camera. Once
      // they drag, OrbitControls owns the camera until they release.
      current.lerp(target, 0.04);

      // Cells: Y-axis only rotation in place. No drift — they pirouette.
      for (const inst of instances) {
        inst.group.rotation.y += inst.spinSpeed.y;
      }

      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      for (const inst of instances) {
        inst.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            // Geometry is shared across instances — only dispose materials here;
            // geometry will be GC'd when the last reference drops.
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else (m as THREE.Material).dispose();
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Removed pointer-events-none and aria-hidden — the canvas is now interactive
  // (drag/touch to look around, scroll/pinch to zoom).
  return <div ref={containerRef} className="fixed inset-0 z-0" />;
}
