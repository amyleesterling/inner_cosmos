import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { featuredNeurons, meshUrl } from "../data/neurons";

const PALETTE = [
  new THREE.Color("#7ee0ff"),
  new THREE.Color("#b78bff"),
  new THREE.Color("#ff7ee0"),
  new THREE.Color("#ffd9a8"),
  new THREE.Color("#9af5d8"),
];

const HERO_ID = "lightning-tree";

// Where each cell sits in the cortical column. Lightning Tree at origin, the
// rest in a small cluster around it. After GLB normalization each cell is
// roughly [-1, 1] in size so spacing is in those units.
const CELL_POSITIONS: Record<string, [number, number, number]> = {
  "lightning-tree": [0, 0, 0],
  "coral-fan": [0.65, -0.3, -0.45],
  "candelabra": [-0.55, -0.15, 0.35],
  "reaching-hand": [0.45, -0.55, 0.5],
  "dust-star": [-0.7, 0.55, -0.35],
  "forest-floor": [0.4, 0.6, 0.55],
};

// Brain-shaped point cloud — coronal-ish ellipsoid, surface-biased
function buildBrainPoints(): THREE.Points {
  const count = 28000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;
    if (x * x + y * y + z * z > 1) continue;
    const r = Math.sqrt(x * x + y * y + z * z);
    const surfaceBias = Math.pow(r, 1.5);
    if (Math.random() >= surfaceBias * 0.9) continue;
    positions[i * 3] = x * 6.5;
    positions[i * 3 + 1] = y * 4.5 + Math.abs(x) * 0.5;
    positions[i * 3 + 2] = z * 5;
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    i++;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geom, mat);
}

// Highlighted region (visual cortex): cluster placed on the back-bottom of brain
function buildRegionHighlight(): THREE.Points {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const center = new THREE.Vector3(-4.5, 0.5, 0);
  for (let i = 0; i < count; i++) {
    const r = 0.6 + Math.random() * 0.3;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * 0.8;
    positions[i * 3] = center.x + Math.cos(theta) * r * 0.7;
    positions[i * 3 + 1] = center.y + Math.sin(phi) * r;
    positions[i * 3 + 2] = center.z + Math.sin(theta) * r * 0.7;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color("#7ee0ff"),
    size: 0.06,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geom, mat);
}

// Camera waypoints per stage (position + lookAt). After stage 1 we leave the
// brain coordinate frame and enter the cortical-column frame (origin = where
// the Lightning Tree's soma sits).
const STAGE_CAMERAS: Array<{ pos: [number, number, number]; look: [number, number, number] }> = [
  { pos: [0, 4, 22], look: [0, 0, 0] },             // 0 — whole brain
  { pos: [-2, 2, 8], look: [-4.5, 0.5, 0] },         // 1 — region highlight
  { pos: [0.4, 0.2, 3.6], look: [0, 0, 0] },         // 2 — circuit (6 real cells)
  { pos: [0, 0.1, 2.4], look: [0, 0, 0] },           // 3 — hero cell (Lightning Tree)
  { pos: [0.18, 0.55, 0.65], look: [0.05, 0.45, 0] },// 4 — synapse zoom on dendrite
];

interface Props {
  stage: number;
}

export default function ZoomScene({ stage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060c, 0.02);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.01,
      200,
    );
    camera.position.set(...STAGE_CAMERAS[0].pos);
    camera.lookAt(...STAGE_CAMERAS[0].look);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting (only matters for cell meshes; points are unlit)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color("#7ee0ff"), 0.3);
    fill.position.set(-3, 1, -2);
    scene.add(fill);

    const brainPoints = buildBrainPoints();
    const region = buildRegionHighlight();
    scene.add(brainPoints);
    scene.add(region);

    // Real cell groups, populated as their GLBs load
    const cellGroups: Record<string, THREE.Group> = {};
    let cellsLoaded = 0;

    const loader = new GLTFLoader();
    featuredNeurons.forEach((n) => {
      const url = meshUrl(n);
      loader.load(
        url,
        (gltf) => {
          const cellColor = new THREE.Color(n.color);
          const group = new THREE.Group();
          group.position.set(...CELL_POSITIONS[n.id]);

          // Re-center via bounding box
          const bbox = new THREE.Box3().setFromObject(gltf.scene);
          const center = new THREE.Vector3();
          bbox.getCenter(center);

          // Collect first, mutate after — adding wire children mid-traverse loops forever.
          const sourceMeshes: THREE.Mesh[] = [];
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
          });

          for (const obj of sourceMeshes) {
            obj.geometry.translate(-center.x, -center.y, -center.z);

            const mainMat = new THREE.MeshStandardMaterial({
              color: cellColor,
              emissive: cellColor.clone().multiplyScalar(0.18),
              metalness: 0.1,
              roughness: 0.55,
              transparent: true,
              opacity: 0,
              side: THREE.DoubleSide,
            });
            obj.material = mainMat;

            const wireMat = new THREE.MeshBasicMaterial({
              color: cellColor,
              wireframe: true,
              transparent: true,
              opacity: 0,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const wireMesh = new THREE.Mesh(obj.geometry, wireMat);
            wireMesh.userData.isWire = true;
            obj.add(wireMesh);

            group.add(obj);
          }

          cellGroups[n.id] = group;
          scene.add(group);
          cellsLoaded++;
          setProgress(cellsLoaded / featuredNeurons.length);
        },
        undefined,
        (err) => console.error(`failed to load ${url}`, err),
      );
    });

    // Per-stage opacity targets per layer
    const stageOpacities = [
      // 0 — whole brain
      { brain: 0.7, region: 0.0, cells: 0.0, hero: 0.0 },
      // 1 — region highlight inside brain
      { brain: 0.55, region: 0.95, cells: 0.0, hero: 0.0 },
      // 2 — cluster of 6 real cells
      { brain: 0.0, region: 0.0, cells: 0.9, hero: 0.9 },
      // 3 — single hero cell, others dim for context
      { brain: 0.0, region: 0.0, cells: 0.07, hero: 0.95 },
      // 4 — synapse zoom (same hero cell, super close so dendritic spines = synapses)
      { brain: 0.0, region: 0.0, cells: 0.0, hero: 0.95 },
    ];

    const setCellOpacity = (id: string, isHero: boolean, opacity: number) => {
      const group = cellGroups[id];
      if (!group) return;
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const m = obj.material as THREE.Material;
          if (obj.userData.isWire) {
            m.opacity = opacity * 0.18;
          } else {
            m.opacity = opacity;
          }
        }
      });
      group.visible = opacity > 0.001;
      // Hero gets a slight extra emissive boost when alone
      if (isHero) {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && !obj.userData.isWire) {
            const m = obj.material as THREE.MeshStandardMaterial;
            m.emissiveIntensity = stageRef.current >= 3 ? 1.5 : 1.0;
          }
        });
      }
    };

    // Smoothed values
    const cur = { brain: 0.7, region: 0, cells: 0, hero: 0 };
    const targetCamPos = new THREE.Vector3(...STAGE_CAMERAS[0].pos);
    const targetCamLook = new THREE.Vector3(...STAGE_CAMERAS[0].look);
    const curCamLook = new THREE.Vector3(...STAGE_CAMERAS[0].look);

    let lastStage = -1;
    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;

      const s = Math.max(0, Math.min(stageOpacities.length - 1, stageRef.current));
      if (s !== lastStage) {
        const tc = STAGE_CAMERAS[s];
        targetCamPos.set(...tc.pos);
        targetCamLook.set(...tc.look);
        lastStage = s;
      }

      // Lerp opacities
      const target = stageOpacities[s];
      const k = 0.04;
      cur.brain += (target.brain - cur.brain) * k;
      cur.region += (target.region - cur.region) * k;
      cur.cells += (target.cells - cur.cells) * k;
      cur.hero += (target.hero - cur.hero) * k;
      (brainPoints.material as THREE.PointsMaterial).opacity = cur.brain;
      (region.material as THREE.PointsMaterial).opacity = cur.region;

      for (const n of featuredNeurons) {
        if (n.id === HERO_ID) {
          setCellOpacity(n.id, true, cur.hero);
        } else {
          setCellOpacity(n.id, false, cur.cells);
        }
      }

      // Idle motion
      brainPoints.rotation.y = t * 0.04;
      region.rotation.y = t * 0.04;
      // Slight drift on the cell cluster
      for (const n of featuredNeurons) {
        const g = cellGroups[n.id];
        if (g) g.rotation.y = t * 0.05;
      }

      // Camera lerp — slower for the long stage 0-1 traversal, snappier later
      const camK = s <= 1 ? 0.025 : 0.045;
      camera.position.lerp(targetCamPos, camK);
      curCamLook.lerp(targetCamLook, camK * 1.5);
      camera.lookAt(curCamLook);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      [brainPoints, region].forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
      Object.values(cellGroups).forEach((g) => {
        g.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else (m as THREE.Material).dispose();
          }
        });
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden>
      {progress < 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40 pointer-events-none">
          Loading cortex · {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}
