import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
const INSTANCES_PER_CELL = 3;

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
    camera.position.set(0, 0, 14);

    // Pull camera back for narrow viewports
    const updateCameraForAspect = () => {
      const aspect = camera.aspect;
      const fovV = THREE.MathUtils.degToRad(camera.fov);
      const horizHalf = Math.atan(aspect * Math.tan(fovV / 2));
      const targetHorizUnits = 10;
      const requiredZ = targetHorizUnits / 2 / Math.tan(horizHalf);
      camera.position.z = Math.max(14, Math.min(28, requiredZ));
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

    function placeInstance(group: THREE.Group, i: number) {
      const aspect = camera.aspect;
      const xSpread = aspect > 1 ? 9 : aspect * 9;
      const ySpread = aspect > 1 ? 5 : 5 / aspect;
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * xSpread * 2,
        (Math.random() - 0.5) * ySpread * 2,
        (Math.random() - 0.5) * 10 - 1,
      );
      group.position.copy(pos);
      group.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      const scale = 0.45 + Math.random() * 0.5;
      group.scale.setScalar(scale);

      instances.push({
        group,
        basePos: pos.clone(),
        spinSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.0006,
          (Math.random() - 0.5) * 0.0009,
          (Math.random() - 0.5) * 0.0006,
        ),
        driftPhase: Math.random() * Math.PI * 2 + i,
        driftAmplitude: 0.15 + Math.random() * 0.25,
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
                placeInstance(group, instances.length);
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
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;

      current.lerp(target, 0.04);
      camera.position.x = current.x * 1.5;
      camera.position.y = current.y * 1.5;
      camera.lookAt(0, 0, 0);

      for (const inst of instances) {
        inst.group.rotation.x += inst.spinSpeed.x;
        inst.group.rotation.y += inst.spinSpeed.y;
        inst.group.rotation.z += inst.spinSpeed.z;
        inst.group.position.y =
          inst.basePos.y +
          Math.sin(t * 0.18 + inst.driftPhase) * inst.driftAmplitude;
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
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

  return <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden />;
}
