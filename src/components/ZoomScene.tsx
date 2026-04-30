import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { featuredNeurons, meshUrl } from "../data/neurons";

const HERO_ID = "lightning-tree";
const BASE = import.meta.env.BASE_URL;

// Same cluster layout as before, but offset/scaled separately from the brain
// coordinate frame — stages 2-4 leave the brain frame entirely.
const CELL_POSITIONS: Record<string, [number, number, number]> = {
  "lightning-tree": [0, 0, 0],
  "coral-fan": [0.65, -0.3, -0.45],
  "candelabra": [-0.55, -0.15, 0.35],
  "reaching-hand": [0.45, -0.55, 0.5],
  "dust-star": [-0.7, 0.55, -0.35],
  "forest-floor": [0.4, 0.6, 0.55],
  // Spelunker-circuit additions — clustered toward the back-left so they read
  // as a coherent motif within the larger cluster.
  "spire":   [-0.5, -0.55, -0.55],
  "aura":    [ 0.7,  0.4,  -0.6],
  "tendril": [-0.6,  0.05,  0.55],
};

// Brain-frame cell-cluster anchor — used for camera framing in stage 1
// (camera ends pointed at V1 right hemisphere) and stage 2 (cells re-center
// to origin, camera resets to look at the cluster).

type BrainManifest = {
  axes: { X: string; Y: string; Z: string };
  landmarks: {
    visp_right: [number, number, number];
    visp_left: [number, number, number];
  };
  nInteriorDots: number;
};

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
    scene.fog = new THREE.FogExp2(0x04060c, 0.015);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.005,
      200,
    );

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(2, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color("#7ee0ff"), 0.3);
    fill.position.set(-3, 1, -2);
    scene.add(fill);

    // ---- Brain meshes + interior neuron dots ------------------------------
    // Stage 0 = human brain (the intro). Stages 1+ = mouse brain (where the
    // actual MICrONS data lives). They live in the same scene origin and
    // cross-fade between stages. Stage 5 swaps to a third pair of meshes —
    // Aura + Tendril, re-extracted in a synapse-centered shared frame.
    let humanBrainShell: THREE.Group | null = null;
    const humanBrainSolidMaterials: THREE.MeshStandardMaterial[] = [];
    const humanBrainWireMaterials: THREE.MeshBasicMaterial[] = [];

    // Synapse-stage meshes (Aura + Tendril, both centered on the synapse coord)
    let synapseAuraGroup: THREE.Group | null = null;
    let synapseTendrilGroup: THREE.Group | null = null;
    const synapseAuraMaterials: THREE.MeshStandardMaterial[] = [];
    const synapseTendrilMaterials: THREE.MeshStandardMaterial[] = [];
    // Tiny glowing sphere at origin marks the actual contact point.
    const synapseMarkerMat = new THREE.MeshBasicMaterial({
      color: 0xffe88a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const synapseMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 24, 24),
      synapseMarkerMat,
    );
    scene.add(synapseMarker);
    let brainShell: THREE.Group | null = null;
    const brainShellWireMaterials: THREE.MeshBasicMaterial[] = [];
    const brainShellSolidMaterials: THREE.MeshStandardMaterial[] = [];
    let brainPoints: THREE.Points | null = null;
    let brainPointsMaterial: THREE.PointsMaterial | null = null;
    const v1Right = new THREE.Vector3(0.31, 0.28, 0.29); // updated when manifest loads
    let manifestLoaded = false;
    let dotsLoaded = false;
    let brainLoaded = false;
    let humanBrainLoaded = false;
    let synapseAuraLoaded = false;
    let synapseTendrilLoaded = false;

    const updateProgress = () => {
      const cells = Object.keys(cellGroups).length;
      const total = featuredNeurons.length + 5; // human + mouse + dots + 2 synapse meshes
      let done = cells;
      if (humanBrainLoaded) done++;
      if (manifestLoaded && brainLoaded) done++;
      if (manifestLoaded && dotsLoaded) done++;
      if (synapseAuraLoaded) done++;
      if (synapseTendrilLoaded) done++;
      setProgress(done / total);
    };

    const loader = new GLTFLoader();

    // 0) Human brain — the stage-0 intro mesh
    loader.load(
      `${BASE}meshes/human-brain.glb`,
      (gltf) => {
        humanBrainShell = new THREE.Group();
        const sourceMeshes: THREE.Mesh[] = [];
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
        });
        for (const obj of sourceMeshes) {
          // Warm pink-violet, glow from emissive so the gyri+sulci read in
          // the dark scene without needing the wireframe to define them.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#d8a8d8"),
            emissive: new THREE.Color("#6b3a8a"),
            emissiveIntensity: 0.35,
            roughness: 0.55,
            metalness: 0.05,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: true,
          });
          obj.material = mat;
          humanBrainSolidMaterials.push(mat);

          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ffd8ff"),
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const wireMesh = new THREE.Mesh(obj.geometry, wireMat);
          obj.add(wireMesh);
          humanBrainWireMaterials.push(wireMat);
          humanBrainShell.add(obj);
        }
        scene.add(humanBrainShell);
        humanBrainLoaded = true;
        updateProgress();
      },
      undefined,
      (e) => console.error("human brain mesh", e),
    );

    // 1) Brain manifest (gives us V1 location + axes)
    fetch(`${BASE}meshes/mouse-brain.json`)
      .then((r) => r.json())
      .then((m: BrainManifest) => {
        v1Right.fromArray(m.landmarks.visp_right);
        manifestLoaded = true;
        updateProgress();
      })
      .catch((e) => console.error("brain manifest", e));

    // 2) Brain shell mesh
    loader.load(
      `${BASE}meshes/mouse-brain.glb`,
      (gltf) => {
        brainShell = new THREE.Group();
        const sourceMeshes: THREE.Mesh[] = [];
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
        });
        for (const obj of sourceMeshes) {
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#9bb6dc"),
            emissive: new THREE.Color("#1a2640"),
            roughness: 0.85,
            metalness: 0.0,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          obj.material = mat;
          brainShellSolidMaterials.push(mat);

          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#7ee0ff"),
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const wireMesh = new THREE.Mesh(obj.geometry, wireMat);
          obj.add(wireMesh);
          brainShellWireMaterials.push(wireMat);
          brainShell.add(obj);
        }
        scene.add(brainShell);
        brainLoaded = true;
        updateProgress();
      },
      undefined,
      (e) => console.error("brain mesh", e),
    );

    // 3) Brain interior point cloud — colored by distance to V1
    fetch(`${BASE}meshes/brain-points.bin`)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const positions = new Float32Array(buf);
        const n = positions.length / 3;
        const colors = new Float32Array(n * 3);
        // Initial color is a soft white-blue; we tint per-stage in animate().
        const baseColor = new THREE.Color("#a8c8ff");
        for (let i = 0; i < n; i++) {
          colors[i * 3] = baseColor.r;
          colors[i * 3 + 1] = baseColor.g;
          colors[i * 3 + 2] = baseColor.b;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
          size: 0.012,
          vertexColors: true,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        brainPointsMaterial = mat;
        brainPoints = new THREE.Points(geom, mat);
        scene.add(brainPoints);
        dotsLoaded = true;
        updateProgress();

        // Pre-compute distance to V1 for color shifting once manifest loads.
        // This may run before manifest is loaded — schedule a lazy retint.
        retintByV1();
      })
      .catch((e) => console.error("brain points", e));

    function retintByV1() {
      if (!brainPoints) return;
      const geom = brainPoints.geometry;
      const positions = geom.getAttribute("position") as THREE.BufferAttribute;
      const colors = geom.getAttribute("color") as THREE.BufferAttribute;
      const cyan = new THREE.Color("#7ee0ff");
      const dim = new THREE.Color("#3b475e");
      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - v1Right.x;
        const dy = positions.getY(i) - v1Right.y;
        const dz = positions.getZ(i) - v1Right.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Inside ~0.18 units of V1 → cyan; outside → dim
        const t = Math.max(0, Math.min(1, (d - 0.05) / 0.25));
        const r = cyan.r * (1 - t) + dim.r * t;
        const g = cyan.g * (1 - t) + dim.g * t;
        const b = cyan.b * (1 - t) + dim.b * t;
        // Store the V1-tinted color in attribute slot 0 (we'll lerp toward
        // it in stage 1 and away in stages 0/2). Actually we need TWO color
        // attributes; simpler: store ONLY the V1 tint and adjust per-stage
        // via material color blend… but we already use vertexColors.
        // For simplicity, just store the V1 tint and let opacity sell it.
        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    }

    // ---- Synapse-pair meshes (stage 5) ------------------------------------
    // Both centered on the synapse coordinate so the contact lands at origin.
    const SYNAPSE_PAIR: Array<{ url: string; color: string; setRef: (g: THREE.Group) => void; mats: THREE.MeshStandardMaterial[]; setLoaded: () => void }> = [
      {
        url: `${BASE}meshes/synapse-aura.glb`,
        color: "#5ed8ff",
        setRef: (g) => { synapseAuraGroup = g; },
        mats: synapseAuraMaterials,
        setLoaded: () => { synapseAuraLoaded = true; },
      },
      {
        url: `${BASE}meshes/synapse-tendril.glb`,
        color: "#ff9fdb",
        setRef: (g) => { synapseTendrilGroup = g; },
        mats: synapseTendrilMaterials,
        setLoaded: () => { synapseTendrilLoaded = true; },
      },
    ];
    SYNAPSE_PAIR.forEach((spec) => {
      loader.load(
        spec.url,
        (gltf) => {
          const group = new THREE.Group();
          const cellColor = new THREE.Color(spec.color);
          const sourceMeshes: THREE.Mesh[] = [];
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
          });
          for (const obj of sourceMeshes) {
            const mainMat = new THREE.MeshStandardMaterial({
              color: cellColor,
              emissive: cellColor.clone().multiplyScalar(0.22),
              metalness: 0.1,
              roughness: 0.55,
              transparent: true,
              opacity: 0,
              side: THREE.DoubleSide,
            });
            obj.material = mainMat;
            spec.mats.push(mainMat);

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
          spec.setRef(group);
          scene.add(group);
          spec.setLoaded();
          updateProgress();
        },
        undefined,
        (err) => console.error(`failed to load ${spec.url}`, err),
      );
    });

    // ---- Real cell cluster (existing) -------------------------------------
    const cellGroups: Record<string, THREE.Group> = {};

    featuredNeurons.forEach((n) => {
      const pos = CELL_POSITIONS[n.id];
      if (!pos) return; // cell isn't in the cluster — skip silently
      loader.load(
        meshUrl(n),
        (gltf) => {
          const cellColor = new THREE.Color(n.color);
          const group = new THREE.Group();
          group.position.set(...pos);

          const bbox = new THREE.Box3().setFromObject(gltf.scene);
          const center = new THREE.Vector3();
          bbox.getCenter(center);

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
          updateProgress();
        },
        undefined,
        (err) => console.error(`failed to load ${meshUrl(n)}`, err),
      );
    });

    // ---- Per-stage targets ------------------------------------------------
    type Targets = {
      humanSolid: number;       // human-brain shell solid opacity (stage 0 only)
      humanWire: number;        // human-brain shell wireframe opacity
      brainSolid: number;       // mouse-brain shell solid opacity
      brainWire: number;        // mouse-brain shell wireframe opacity
      brainDots: number;        // interior dots opacity
      dotSize: number;          // point size
      cells: number;            // cluster cells opacity
      hero: number;             // hero cluster cell opacity
      synapsePair: number;      // synapse-aura + synapse-tendril opacity (stage 5)
      synapseMarker: number;    // glow sphere at the synapse contact (stage 5)
    };
    const stageOpacities: Targets[] = [
      // 0 — human brain alone. Solid-dominant so cortical folds read.
      { humanSolid: 0.55, humanWire: 0.08, brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
      // 1 — comparison: human + small mouse to scale, dots off
      { humanSolid: 0.50, humanWire: 0.06, brainSolid: 0.55, brainWire: 0.10, brainDots: 0,    dotSize: 0.011, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
      // 2 — mouse alone (full size)
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0.10, brainWire: 0.30, brainDots: 0.85, dotSize: 0.011, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
      // 3 — V1 close
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0.06, brainWire: 0.22, brainDots: 0.95, dotSize: 0.018, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
      // 4 — circuit
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0.9,  hero: 0.9,  synapsePair: 0,    synapseMarker: 0    },
      // 5 — single neuron
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0.07, hero: 0.95, synapsePair: 0,    synapseMarker: 0    },
      // 6 — synapse: cluster gone, hero gone, synapse pair + contact marker visible.
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0.0,  hero: 0,    synapsePair: 0.85, synapseMarker: 0.85 },
    ];

    // Mouse-brain transform per stage. The brain mesh is normally at origin
    // with scale 1, but in stage 1 (comparison) we shrink + offset it so it
    // sits next to the human brain at its real-world size ratio: 1/15 of
    // human linear (mouse ~12mm vs human ~180mm), which is ~3,375× smaller
    // in volume. Stage 0 keeps it at the small pos so when we transition to
    // stage 1 it doesn't fly in from elsewhere.
    type MouseTransform = { pos: THREE.Vector3; scale: number };
    const MOUSE_SCALE_VS_HUMAN = 1 / 15;
    const stageMouseTransforms: MouseTransform[] = [
      { pos: new THREE.Vector3(1.45, -0.4, 0.2), scale: MOUSE_SCALE_VS_HUMAN }, // 0 — invisible, preset for stage 1
      { pos: new THREE.Vector3(1.45, -0.4, 0.2), scale: MOUSE_SCALE_VS_HUMAN }, // 1 — comparison
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 2 — full size
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 3
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 4
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 5
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 6
    ];
    const curMousePos = stageMouseTransforms[0].pos.clone();
    let curMouseScale = stageMouseTransforms[0].scale;
    const targetMousePos = stageMouseTransforms[0].pos.clone();
    let targetMouseScale = stageMouseTransforms[0].scale;

    // Camera waypoints (positions + look-at). Stage 3 is recomputed per-frame
    // in animate() because the brain's rotation moves V1's world position.
    const stageCameras = (s: number, v1: THREE.Vector3): { pos: THREE.Vector3; look: THREE.Vector3 } => {
      switch (s) {
        case 0:
          // Human brain — wide shot from a slight 3/4 angle so folds read.
          return { pos: new THREE.Vector3(0.4, 0.3, 2.9), look: new THREE.Vector3(0, 0, 0) };
        case 1:
          // Comparison — pull back so both human (centered) and tiny mouse
          // (offset to lower-right) are framed together. Look-at is between
          // the two so the human fills most of the frame on the left.
          return { pos: new THREE.Vector3(0.6, 0.2, 4.6), look: new THREE.Vector3(0.5, -0.1, 0) };
        case 2:
          // Mouse whole brain
          return { pos: new THREE.Vector3(1.6, 1.0, 2.6), look: new THREE.Vector3(0, 0, 0) };
        case 3: {
          // Tight on V1 — along V1's outward normal so it fills the frame.
          const outward = v1.clone().normalize();
          const pos = v1.clone().addScaledVector(outward, 0.45);
          return { pos, look: v1.clone() };
        }
        case 4:
          // Cell cluster
          return { pos: new THREE.Vector3(0.4, 0.2, 3.6), look: new THREE.Vector3(0, 0, 0) };
        case 5:
          // Single neuron
          return { pos: new THREE.Vector3(0, 0.1, 2.4), look: new THREE.Vector3(0, 0, 0) };
        case 6:
          // Synapse — close to origin (the actual contact). User can drag/zoom
          // to explore Aura's dendrite + Tendril's axon meeting at this point.
          return { pos: new THREE.Vector3(0.12, 0.04, 0.32), look: new THREE.Vector3(0, 0, 0) };
        default:
          return { pos: new THREE.Vector3(0, 0, 5), look: new THREE.Vector3(0, 0, 0) };
      }
    };

    const setCellOpacity = (id: string, opacity: number) => {
      const group = cellGroups[id];
      if (!group) return;
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const m = obj.material as THREE.Material;
          m.opacity = obj.userData.isWire ? opacity * 0.18 : opacity;
        }
      });
      group.visible = opacity > 0.001;
    };

    const cur: Targets = {
      humanSolid: stageOpacities[0].humanSolid,
      humanWire: stageOpacities[0].humanWire,
      brainSolid: stageOpacities[0].brainSolid,
      brainWire: stageOpacities[0].brainWire,
      brainDots: stageOpacities[0].brainDots,
      dotSize: stageOpacities[0].dotSize,
      cells: 0,
      hero: 0,
      synapsePair: 0,
      synapseMarker: 0,
    };
    const initCam = stageCameras(0, v1Right);
    camera.position.copy(initCam.pos);
    const targetCamPos = initCam.pos.clone();
    const targetCamLook = initCam.look.clone();
    const curCamLook = initCam.look.clone();
    camera.lookAt(curCamLook);

    // OrbitControls — drag/touch to orbit, scroll/pinch to zoom. Stays passive
    // until the user actually interacts; otherwise scripted stage lerping
    // (below) drives the camera.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.05;
    controls.maxDistance = 12;
    controls.target.copy(curCamLook);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    // Once the user grabs the canvas (drag OR scroll-wheel), they own the
    // camera until the next stage transition — otherwise scroll-zoom would
    // snap back to the scripted waypoint immediately after the wheel event,
    // since OrbitControls fires start/end synchronously around wheel input.
    let userOwnsCamera = false;
    controls.addEventListener("start", () => {
      userOwnsCamera = true;
      renderer.domElement.style.cursor = "grabbing";
    });
    controls.addEventListener("end", () => {
      // Don't clear userOwnsCamera here — keep the user's view until they
      // advance stages. Just restore the cursor to its rest state.
      renderer.domElement.style.cursor = "grab";
    });

    let lastStage = -1;
    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      const s = Math.max(0, Math.min(stageOpacities.length - 1, stageRef.current));
      if (s !== lastStage) {
        const tc = stageCameras(s, v1Right);
        targetCamPos.copy(tc.pos);
        targetCamLook.copy(tc.look);
        // New mouse-brain transform target — lerp from current toward this.
        targetMousePos.copy(stageMouseTransforms[s].pos);
        targetMouseScale = stageMouseTransforms[s].scale;
        lastStage = s;
        // New stage: scripted camera takes back over from any user-orbited
        // view, lerping to the new waypoint.
        userOwnsCamera = false;
        // Stage 3 needs V1-aware retint (positions may have been computed
        // before manifest arrived).
        if (s === 3) retintByV1();
      }

      const target = stageOpacities[s];
      const k = 0.04;
      // Human-brain fade runs faster than the rest so the human is mostly
      // gone by the time the mouse starts noticeably moving + growing.
      // Without this, both meshes cross through each other mid-transition.
      const kHuman = 0.085;
      cur.humanSolid += (target.humanSolid - cur.humanSolid) * kHuman;
      cur.humanWire += (target.humanWire - cur.humanWire) * kHuman;
      cur.brainSolid += (target.brainSolid - cur.brainSolid) * k;
      cur.brainWire += (target.brainWire - cur.brainWire) * k;
      cur.brainDots += (target.brainDots - cur.brainDots) * k;
      cur.dotSize += (target.dotSize - cur.dotSize) * k;
      cur.cells += (target.cells - cur.cells) * k;
      cur.hero += (target.hero - cur.hero) * k;
      cur.synapsePair += (target.synapsePair - cur.synapsePair) * k;
      cur.synapseMarker += (target.synapseMarker - cur.synapseMarker) * k;

      humanBrainSolidMaterials.forEach((m) => (m.opacity = cur.humanSolid));
      humanBrainWireMaterials.forEach((m) => (m.opacity = cur.humanWire));
      brainShellSolidMaterials.forEach((m) => (m.opacity = cur.brainSolid));
      brainShellWireMaterials.forEach((m) => (m.opacity = cur.brainWire));
      if (brainPointsMaterial) {
        brainPointsMaterial.opacity = cur.brainDots;
        brainPointsMaterial.size = cur.dotSize;
      }
      if (humanBrainShell) humanBrainShell.visible = cur.humanSolid + cur.humanWire > 0.001;
      if (brainShell) brainShell.visible = cur.brainSolid + cur.brainWire > 0.001;
      if (brainPoints) brainPoints.visible = cur.brainDots > 0.001;

      // Synapse-pair opacity — same value applied to both meshes' main +
      // wireframe materials (wireframe gets a softer multiplier).
      const applySynapseGroup = (group: THREE.Group | null, mainMats: THREE.MeshStandardMaterial[]) => {
        if (!group) return;
        for (const m of mainMats) m.opacity = cur.synapsePair;
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.isWire) {
            (obj.material as THREE.Material & { opacity: number }).opacity = cur.synapsePair * 0.18;
          }
        });
        group.visible = cur.synapsePair > 0.001;
      };
      applySynapseGroup(synapseAuraGroup, synapseAuraMaterials);
      applySynapseGroup(synapseTendrilGroup, synapseTendrilMaterials);
      synapseMarkerMat.opacity = cur.synapseMarker;
      synapseMarker.visible = cur.synapseMarker > 0.001;

      for (const n of featuredNeurons) {
        setCellOpacity(n.id, n.id === HERO_ID ? cur.hero : cur.cells);
      }

      // Lerp mouse-brain transform every frame so stage transitions glide
      // smoothly between "small + offset" and "full + centered". Slightly
      // slower than the default opacity lerp so the human gets a head start
      // on fading before the mouse begins its move.
      const kMouse = 0.028;
      curMousePos.lerp(targetMousePos, kMouse);
      curMouseScale += (targetMouseScale - curMouseScale) * kMouse;
      if (brainShell) {
        brainShell.position.copy(curMousePos);
        brainShell.scale.setScalar(curMouseScale);
      }

      // Keep the human brain rotating as long as it's visible (still fading
      // out during stage 2). Stopping rotation as soon as the stage advances
      // makes the brain look like it freezes mid-spin while it's fading.
      if (humanBrainShell && cur.humanSolid + cur.humanWire > 0.001) {
        humanBrainShell.rotation.y = t * 0.05;
      }
      // Slow rotation on the mouse brain in stages 1 + 2 (comparison + whole
      // mouse). Past stage 2 it holds still so V1 stays where the camera is.
      if (s === 1 || s === 2) {
        if (brainShell) brainShell.rotation.y = t * 0.04;
      }
      // Brain dots only rotate when full-size + visible (stages 2+, scale=1).
      if (s === 2 && brainPoints) {
        brainPoints.rotation.y = t * 0.04;
      }

      // Stage 3 — track V1's world position each frame in case the brain has
      // any residual rotation, and re-derive the camera offset along V1's
      // outward normal so the framing is always tight on V1 itself.
      if (s === 3 && brainShell && !userOwnsCamera) {
        const worldV1 = v1Right.clone();
        brainShell.localToWorld(worldV1);
        const outward = worldV1.clone().normalize();
        targetCamPos.copy(worldV1).addScaledVector(outward, 0.45);
        targetCamLook.copy(worldV1);
      }

      // Cells gently rotate
      for (const n of featuredNeurons) {
        const g = cellGroups[n.id];
        if (g) g.rotation.y = t * 0.05;
      }

      // Camera lerp — only runs when the user isn't actively orbiting. Once
      // they grab the canvas, OrbitControls owns position + target until they
      // release; then the scripted lerp resumes from wherever they left off.
      // Slow camera lerp through the long stage 0→3 traversal (human →
      // comparison → mouse → V1); snappier for the closer-in stages.
      const camK = s <= 3 ? 0.025 : 0.045;
      if (!userOwnsCamera) {
        camera.position.lerp(targetCamPos, camK);
        curCamLook.lerp(targetCamLook, camK * 1.5);
        controls.target.copy(curCamLook);
      }
      controls.update();

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
      controls.dispose();
      if (brainPoints) {
        brainPoints.geometry.dispose();
        (brainPoints.material as THREE.Material).dispose();
      }
      if (brainShell) {
        brainShell.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else (m as THREE.Material).dispose();
          }
        });
      }
      if (humanBrainShell) {
        humanBrainShell.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else (m as THREE.Material).dispose();
          }
        });
      }
      [synapseAuraGroup, synapseTendrilGroup].forEach((group) => {
        if (!group) return;
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else (m as THREE.Material).dispose();
          }
        });
      });
      synapseMarker.geometry.dispose();
      synapseMarkerMat.dispose();
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
          Loading the brain · {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}
