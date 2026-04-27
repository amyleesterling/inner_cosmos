import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildMorphology, getPreset } from "../lib/morphology";

const PALETTE = [
  new THREE.Color("#7ee0ff"),
  new THREE.Color("#b78bff"),
  new THREE.Color("#ff7ee0"),
  new THREE.Color("#ffd9a8"),
  new THREE.Color("#9af5d8"),
];

// Brain-shaped point cloud — coronal-ish ellipsoid
function buildBrainPoints(): THREE.Points {
  const count = 28000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    // Sample a unit ball, then deform into brain-ish shape
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;
    if (x * x + y * y + z * z > 1) continue;
    // Brain proportions: long anterior-posterior, narrower vertically
    const ax = x * 6.5;
    const ay = y * 4.5 + Math.abs(x) * 0.5;       // taller on sides (cortical bulge)
    const az = z * 5;
    // Bias points toward the surface (cortex is on the outside)
    const r = Math.sqrt(x * x + y * y + z * z);
    const surfaceBias = Math.pow(r, 1.5);
    const useThis = Math.random() < surfaceBias * 0.9;
    if (!useThis) continue;
    positions[i * 3] = ax;
    positions[i * 3 + 1] = ay;
    positions[i * 3 + 2] = az;
    // Color by depth
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

// Highlighted column representing visual cortex (back-bottom of brain)
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

// A small circuit of ~30 simple neurons clustered in the visual cortex spot
function buildCircuit(seed: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-4.5, 0.5, 0);
  const presets = ["pyramidal", "basket", "stellate", "martinotti"];
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 28; i++) {
    const preset = presets[Math.floor(rng() * presets.length)];
    const cfg = { ...getPreset(preset), branchLength: 0.35 + rng() * 0.15, branchDepth: 2 };
    const color = PALETTE[Math.floor(rng() * PALETTE.length)];
    const built = buildMorphology(cfg, color);
    built.group.scale.setScalar(0.18 + rng() * 0.08);
    const r = 0.5 + rng() * 0.5;
    const theta = rng() * Math.PI * 2;
    const phi = (rng() - 0.5) * 0.6;
    built.group.position.set(
      Math.cos(theta) * r,
      Math.sin(phi) * r * 0.6,
      Math.sin(theta) * r,
    );
    built.group.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    group.add(built.group);
  }
  // Initial opacity 0
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      const m = obj.material as THREE.Material;
      m.transparent = true;
      m.opacity = 0;
    }
  });
  return group;
}

// One detailed pyramidal neuron
function buildHeroNeuron(): THREE.Group {
  const cfg = getPreset("pyramidal");
  const built = buildMorphology(cfg, new THREE.Color("#7ee0ff"));
  built.group.position.set(-4.5, 0.5, 0);
  built.group.scale.setScalar(0.55);
  built.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      const m = obj.material as THREE.Material;
      m.transparent = true;
      m.opacity = 0;
    }
  });
  return built.group;
}

// Synapse — two stubby branches meeting, glowing junction points
function buildSynapse(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-4.5, 0.5, 0);

  // Two branch tubes converging
  const curve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, -0.3, 0.0),
    new THREE.Vector3(-0.2, -0.05, 0.05),
    new THREE.Vector3(0.0, 0.0, 0.0),
  ]);
  const curve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, 0.3, 0.0),
    new THREE.Vector3(0.2, 0.08, -0.05),
    new THREE.Vector3(0.05, 0.02, 0.0),
  ]);
  const tubeGeo1 = new THREE.TubeGeometry(curve1, 24, 0.025, 8, false);
  const tubeGeo2 = new THREE.TubeGeometry(curve2, 24, 0.022, 8, false);
  const tubeMat1 = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#7ee0ff"),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tubeMat2 = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#ff7ee0"),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(tubeGeo1, tubeMat1));
  group.add(new THREE.Mesh(tubeGeo2, tubeMat2));

  // Synaptic glowing dot
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd9a8"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sphere.position.set(0.025, 0.01, 0);
  group.add(sphere);

  // Halo around synapse
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd9a8"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.copy(sphere.position);
  halo.userData.isHalo = true;
  group.add(halo);

  return group;
}

// Camera waypoints per stage (position + lookAt)
const STAGE_CAMERAS: Array<{ pos: [number, number, number]; look: [number, number, number] }> = [
  { pos: [0, 4, 22], look: [0, 0, 0] },           // 0 — whole brain
  { pos: [-2, 2, 8], look: [-4.5, 0.5, 0] },       // 1 — region
  { pos: [-3.5, 0.7, 3.5], look: [-4.5, 0.5, 0] }, // 2 — circuit
  { pos: [-4.0, 0.6, 1.8], look: [-4.5, 0.5, 0] }, // 3 — single neuron
  { pos: [-4.45, 0.51, 0.6], look: [-4.5, 0.5, 0] },// 4 — synapse
];

interface Props {
  stage: number;
}

export default function ZoomScene({ stage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060c, 0.02);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.05,
      200,
    );
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    camPos.set(...STAGE_CAMERAS[0].pos);
    camLook.set(...STAGE_CAMERAS[0].look);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

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

    // Stage content
    const brainPoints = buildBrainPoints();
    const region = buildRegionHighlight();
    const circuit = buildCircuit(42);
    const heroNeuron = buildHeroNeuron();
    const synapse = buildSynapse();
    scene.add(brainPoints);
    scene.add(region);
    scene.add(circuit);
    scene.add(heroNeuron);
    scene.add(synapse);

    // Per-stage opacity targets
    // Index = stage, value = { brain, region, circuit, hero, synapse }
    const stageOpacities = [
      { brain: 0.7, region: 0.0, circuit: 0.0, hero: 0.0, synapse: 0.0 },
      { brain: 0.55, region: 0.95, circuit: 0.0, hero: 0.0, synapse: 0.0 },
      { brain: 0.0, region: 0.0, circuit: 0.95, hero: 0.0, synapse: 0.0 },
      { brain: 0.0, region: 0.0, circuit: 0.25, hero: 0.95, synapse: 0.0 },
      { brain: 0.0, region: 0.0, circuit: 0.0, hero: 0.25, synapse: 0.95 },
    ];

    // Helper to set opacity on all materials in a group (multiplied by base opacity)
    const setGroupOpacity = (root: THREE.Object3D, opacity: number) => {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          const m = obj.material as THREE.Material;
          // Halo mesh has lower base opacity
          if ((obj as THREE.Mesh).userData?.isHalo) m.opacity = opacity * 0.4;
          else m.opacity = opacity;
        }
      });
    };

    // Smoothed values
    const cur = { brain: 0.7, region: 0, circuit: 0, hero: 0, synapse: 0 };
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
      cur.circuit += (target.circuit - cur.circuit) * k;
      cur.hero += (target.hero - cur.hero) * k;
      cur.synapse += (target.synapse - cur.synapse) * k;
      (brainPoints.material as THREE.PointsMaterial).opacity = cur.brain;
      (region.material as THREE.PointsMaterial).opacity = cur.region;
      setGroupOpacity(circuit, cur.circuit);
      setGroupOpacity(heroNeuron, cur.hero);
      setGroupOpacity(synapse, cur.synapse);

      // Slow rotation of brain so it's alive
      brainPoints.rotation.y = t * 0.04;
      region.rotation.y = t * 0.04;

      // Circuit gently rotates
      circuit.rotation.y = t * 0.08;

      // Hero neuron breathes
      heroNeuron.rotation.y = t * 0.15;

      // Synapse pulses
      synapse.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.userData.isHalo) {
          child.scale.setScalar(1 + 0.18 * Math.sin(t * 2.0));
        }
      });

      // Camera lerp
      camera.position.lerp(targetCamPos, 0.025);
      curCamLook.lerp(targetCamLook, 0.04);
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
      [circuit, heroNeuron, synapse].forEach((g) => {
        g.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
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

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
}
