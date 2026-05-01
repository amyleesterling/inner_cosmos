import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { featuredNeurons, meshUrl } from "../data/neurons";

const HERO_ID = "lightning-tree";
const BASE = import.meta.env.BASE_URL;

// Same cluster layout as before, but offset/scaled separately from the brain
// coordinate frame — stages 2-4 leave the brain frame entirely.
// Cell positions in the cluster. Y axis = cortical depth: positive Y is
// toward pia (superficial layers 1-3), negative Y is toward white matter
// (layers 5-6). X/Z just spread cells out so they don't all stack.
//
// L2/3 pyramidals sit high so their apicals reach up; L5 thick-tufted
// pyramidals sit low with their apicals climbing the column. Inhibitory
// cells slot in throughout the depth range.
//
// Astrocyte (forest-floor) intentionally omitted — its 350K-face fluffy
// arbor visually swallows the other cells. Still shown on /meet.
const CELL_POSITIONS: Record<string, [number, number, number]> = {
  // Layer 5 thick-tufted pyramidals — deep
  "lightning-tree": [ 0,    -0.45,  0    ],
  "aura":           [ 0.55, -0.50, -0.50 ],
  // Layer 2/3 pyramidal — superficial
  "crown":          [-0.45,  0.50, -0.35 ],
  // Layer 4 cell — between L2/3 and L5
  "dust-star":      [ 0.45,  0.15, -0.45 ],
  // Spire (generic Pyramidal Neuron) — deep per the synapse-stage copy
  "spire":          [-0.55, -0.45, -0.45 ],
  // Inhibitory + axon
  "coral-fan":      [ 0.65,  0.05,  0.40 ], // basket cell, mid layers
  "candelabra":     [-0.55,  0.25,  0.30 ], // chandelier, upper-mid
  "reaching-hand":  [ 0.45, -0.55,  0.50 ], // Martinotti soma deep, axons climb
  "spindle":        [ 0.20,  0.55,  0.35 ], // bipolar, often upper
  "tendril":        [-0.55,  0.05,  0.55 ], // axon — depth doesn't matter
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

    // Lighting kept low: ambient/key at high intensity wash cell colors
    // toward white. Self-glow (emissive) on each cell does most of the
    // colorful lifting now.
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(2, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color("#7ee0ff"), 0.18);
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
    // Bloom sprite factory — uses a canvas-generated radial-gradient texture
    // so the glow has TRUE soft edges (no visible discrete sphere outlines).
    // Each bloom is a single THREE.Sprite (always faces the camera).
    const makeBloomSprite = (rgb: [number, number, number], scale: number) => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const cx = size / 2;
      const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
      const [r, g, b] = rgb;
      grad.addColorStop(0.00, "rgba(255,255,255,1)");
      grad.addColorStop(0.06, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.18, `rgba(${r},${g},${b},0.7)`);
      grad.addColorStop(0.42, `rgba(${r},${g},${b},0.22)`);
      grad.addColorStop(0.75, `rgba(${r},${g},${b},0.05)`);
      grad.addColorStop(1.00, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(scale, scale, 1);
      return { sprite, mat, tex };
    };
    const axonBloom = makeBloomSprite([255, 216, 96], 0.32);     // gold
    const pyramidBloom = makeBloomSprite([136, 207, 255], 0.32); // blue
    const synapseBloom = makeBloomSprite([156, 232, 192], 0.07); // soft green-cyan, tight
    // Stage-0 halo behind the human brain — large violet bloom that
    // makes the brain feel lit from within rather than floating flat
    // against the dark background.
    const humanHaloBloom = makeBloomSprite([184, 110, 230], 3.6);
    humanHaloBloom.sprite.position.set(0, 0, -0.2);
    scene.add(humanHaloBloom.sprite);
    // Stage-2/3 halo behind the mouse brain — cyan, hologram cast.
    const mouseHaloBloom = makeBloomSprite([95, 207, 255], 3.0);
    mouseHaloBloom.sprite.position.set(0, 0, -0.2);
    scene.add(mouseHaloBloom.sprite);
    scene.add(axonBloom.sprite);
    scene.add(pyramidBloom.sprite);
    scene.add(synapseBloom.sprite);
    synapseBloom.sprite.position.set(0, 0, 0);
    // Aliases used by animation block below
    const apAxonPulse = axonBloom.sprite;
    const apPyramidPulse = pyramidBloom.sprite;
    // Action-potential paths walk the actual mesh skeleton (NOT straight
    // lines). Loaded from /meshes/synapse-skeletons.json — three paths
    // resampled to 200 evenly-spaced points each, all in the synapse-pair's
    // shared frame (origin = synapse contact).
    //   tendril      = Tendril axon distal tip -> synapse
    //   aura_apical  = synapse -> Aura soma (down post-synaptic dendrite)
    //   aura_axon    = Aura soma -> axon distal tip
    // Until the JSON loads, fall back to the old straight-line waypoints
    // so the animation still renders something coherent on first paint.
    let tendrilPath: THREE.Vector3[] | null = null;
    let auraApicalPath: THREE.Vector3[] | null = null;
    let auraAxonPath: THREE.Vector3[] | null = null;
    const FALLBACK_TENDRIL_FAR = new THREE.Vector3(0.92, -0.10, 0.05);
    const FALLBACK_AURA_SOMA = new THREE.Vector3(0.05, -0.55, 0.02);
    const FALLBACK_AURA_AXON_END = new THREE.Vector3(0.05, -0.95, 0.02);
    fetch(`${BASE}meshes/synapse-skeletons.json`)
      .then((r) => r.json())
      .then((data) => {
        const toVec3s = (pts: number[][]) =>
          pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        tendrilPath = toVec3s(data.tendril.points);
        auraApicalPath = toVec3s(data.aura_apical.points);
        auraAxonPath = toVec3s(data.aura_axon.points);
      })
      .catch((e) => console.error("synapse skeletons", e));

    // Sample a resampled path at u in [0, 1] with linear interpolation
    // between adjacent points. Writes into `out` to avoid allocations.
    const samplePath = (
      path: THREE.Vector3[],
      u: number,
      out: THREE.Vector3,
    ) => {
      const n = path.length;
      const f = Math.max(0, Math.min(n - 1, u * (n - 1)));
      const i = Math.floor(f);
      const t = f - i;
      if (i >= n - 1) {
        out.copy(path[n - 1]);
      } else {
        out.copy(path[i]).lerp(path[i + 1], t);
      }
      return out;
    };
    let brainShell: THREE.Group | null = null;
    const brainShellWireMaterials: THREE.MeshBasicMaterial[] = [];
    const brainShellSolidMaterials: THREE.MeshStandardMaterial[] = [];
    // Mouse-brain hologram overlay — adds Fresnel edge glow + animated
    // scanlines on top of the existing solid + wireframe setup. Opacity
    // tracks `cur.brainHologram` (a fraction of brainSolid+brainWire); the
    // uTime uniform is bumped every frame so scanlines drift.
    const brainHologramMaterials: THREE.ShaderMaterial[] = [];
    const HOLOGRAM_VERT = /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;
    const HOLOGRAM_FRAG = /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3  uBaseColor;
      uniform vec3  uEdgeColor;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        // Fresnel: edges (normal perpendicular to view) glow more.
        float fres = 1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
        float fresEdge = pow(fres, 2.4);  // sharp rim
        float fresFill = pow(fres, 0.9);  // soft body wash

        // Animated horizontal scanlines along the brain's local Y axis
        // (cortical-ish axis). Local position so they don't shear when
        // the brain rotates.
        float scan = 0.5 + 0.5 * sin(vLocalPos.y * 90.0 - uTime * 1.4);
        scan = pow(scan, 6.0);  // narrow bright bands

        // A slower modulation so the whole shell breathes
        float pulse = 0.5 + 0.5 * sin(uTime * 0.55);

        vec3 color = mix(uBaseColor, uEdgeColor, fresEdge);
        // Add a tiny scanline highlight so the bands shimmer toward white
        color += vec3(0.35, 0.55, 0.7) * scan * 0.55;

        float alpha = (fresEdge * 0.55 + fresFill * 0.18 + scan * 0.22) * uOpacity;
        alpha *= 0.82 + pulse * 0.18;

        gl_FragColor = vec4(color, alpha);
      }
    `;
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
          // Saturated purple with strong emissive glow.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#b072e0"),
            emissive: new THREE.Color("#7a3ac0"),
            emissiveIntensity: 1.1,
            roughness: 0.5,
            metalness: 0.0,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: true,
          });
          obj.material = mat;
          humanBrainSolidMaterials.push(mat);

          // Bright violet wireframe with additive blending so the gyri
          // edges glow.
          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#e8a8ff"),
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
          // Hologram look: deep dark cyan-blue solid with a brighter cyan
          // emissive — barely visible alone, the wireframe overlay carries
          // the visual.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#1a3850"),
            emissive: new THREE.Color("#3a8eff"),
            emissiveIntensity: 0.4,
            roughness: 0.9,
            metalness: 0.0,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          obj.material = mat;
          brainShellSolidMaterials.push(mat);

          // Bright cyan wireframe with additive blending = hologram glow.
          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#5fcfff"),
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const wireMesh = new THREE.Mesh(obj.geometry, wireMat);
          obj.add(wireMesh);
          brainShellWireMaterials.push(wireMat);

          // Hologram overlay — Fresnel + animated scanlines, additive,
          // depthWrite off so it never occludes other layers.
          const hologramMat = new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uOpacity: { value: 0 },
              uBaseColor: { value: new THREE.Color("#3aa0ff") },
              uEdgeColor: { value: new THREE.Color("#bfeaff") },
            },
            vertexShader: HOLOGRAM_VERT,
            fragmentShader: HOLOGRAM_FRAG,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const hologramMesh = new THREE.Mesh(obj.geometry, hologramMat);
          obj.add(hologramMesh);
          brainHologramMaterials.push(hologramMat);

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
        // Pyramidal cell rendered electric blue per Amy — distinct from
        // the gold axon and from the cluster-stage Aura teal.
        url: `${BASE}meshes/synapse-aura.glb`,
        color: "#4a8bff",
        setRef: (g) => { synapseAuraGroup = g; },
        mats: synapseAuraMaterials,
        setLoaded: () => { synapseAuraLoaded = true; },
      },
      {
        // Stage-6 axon recolored gold so the inbound cable reads against the
        // teal pyramidal it's contacting. Distinct from cluster-stage Tendril
        // (magenta there) — different mesh, different scene mode.
        url: `${BASE}meshes/synapse-tendril.glb`,
        color: "#ffd24a",
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
              emissive: cellColor.clone().multiplyScalar(0.55),
              metalness: 0.0,
              roughness: 0.7,
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
              // NormalBlending — no white-washing additive overlay.
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
      // Cluster uses the SHARED-SCALE meshes from /meshes/cluster/ so cells
      // appear at their real-world relative sizes; /meet keeps the
      // per-cell-normalized GLBs from /meshes/.
      loader.load(
        `${BASE}meshes/cluster/${n.id}.glb`,
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
              // Higher emissive means each cell glows in its own color
              // even where the directional lights don't reach — keeps the
              // palette saturated instead of washing to white.
              emissive: cellColor.clone().multiplyScalar(0.55),
              metalness: 0.0,
              roughness: 0.7,
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
              // NormalBlending instead of AdditiveBlending — the latter
              // sums color toward white wherever lines overlap, which
              // gave the cluster a washed-out / ghosty look.
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
      // 6 — synapse close-up: cluster gone, hero gone, synapse pair + contact marker visible.
      { humanSolid: 0,    humanWire: 0,    brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0.0,  hero: 0,    synapsePair: 0.85, synapseMarker: 0.85 },
      // 7 — action potential: same meshes, wider framing (handled by camera).
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
      { pos: new THREE.Vector3(0, 0, 0),         scale: 1.0 }, // 7
    ];
    const curMousePos = stageMouseTransforms[0].pos.clone();
    let curMouseScale = stageMouseTransforms[0].scale;
    const targetMousePos = stageMouseTransforms[0].pos.clone();
    let targetMouseScale = stageMouseTransforms[0].scale;

    // Camera waypoints (positions + look-at). Stage 3 is recomputed per-frame
    // in animate() because the brain's rotation moves V1's world position.
    // Look-at Y values are intentionally negative on every stage so each
    // mesh's center of rotation lands in the upper third of the frame
    // (above the stage label/copy, not behind it).
    const stageCameras = (s: number, v1: THREE.Vector3): { pos: THREE.Vector3; look: THREE.Vector3 } => {
      switch (s) {
        case 0:
          // Human brain — wide shot from a slight 3/4 angle so folds read.
          return { pos: new THREE.Vector3(0.4, 0.3, 2.9), look: new THREE.Vector3(0, -0.4, 0) };
        case 1:
          // Comparison — pull back so both human (centered) and tiny mouse
          // (offset to lower-right) are framed together. Look-at is between
          // the two so the human fills most of the frame on the left.
          return { pos: new THREE.Vector3(0.6, 0.2, 4.6), look: new THREE.Vector3(0.5, -0.5, 0) };
        case 2:
          // Mouse whole brain
          return { pos: new THREE.Vector3(1.6, 1.0, 2.6), look: new THREE.Vector3(0, -0.4, 0) };
        case 3: {
          // Tight on V1 — along V1's outward normal so it fills the frame.
          const outward = v1.clone().normalize();
          const pos = v1.clone().addScaledVector(outward, 0.45);
          const look = v1.clone();
          look.y -= 0.25; // raise V1 in frame, above the stage label
          return { pos, look };
        }
        case 4:
          // Cell cluster
          return { pos: new THREE.Vector3(0.4, 0.2, 3.6), look: new THREE.Vector3(0, -0.4, 0) };
        case 5:
          // Single neuron
          return { pos: new THREE.Vector3(0, 0.1, 2.4), look: new THREE.Vector3(0, -0.3, 0) };
        case 6:
          // Synapse close-up — look-at slightly below the synapse so the
          // marker sits in the upper part of the frame above the text.
          // (Drag-rotation pivots around the look-at, which is 0.15 units
          // below the marker — close enough to feel like rotating around it.)
          return { pos: new THREE.Vector3(0.04, 0.05, 0.42), look: new THREE.Vector3(0, -0.18, 0) };
        case 7:
          // Action potential — wide shot framing both meshes end-to-end.
          // Look-at on the geometric center of the synapse pair.
          return { pos: new THREE.Vector3(0.45, 0.20, 2.10), look: new THREE.Vector3(0.30, -0.10, 0) };
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
          // Wireframe overlay sits on top with additive blending; at higher
          // multipliers it washes the cell color toward white ("ghosty").
          // Keep it as a faint structural hint, not a primary visual.
          m.opacity = obj.userData.isWire ? opacity * 0.06 : opacity;
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

    // OrbitControls — drag/touch to orbit, scroll/pinch to zoom, right-click
    // (or two-finger drag on touch) to pan. Stays passive until the user
    // actually interacts; otherwise scripted stage lerping (below) drives
    // the camera.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
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
    let stage7EnteredAt = -1; // tracks AP-stage entry time for the 2s lead-in
    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      const s = Math.max(0, Math.min(stageOpacities.length - 1, stageRef.current));
      if (s !== lastStage) {
        const tc = stageCameras(s, v1Right);
        targetCamPos.copy(tc.pos);
        targetCamLook.copy(tc.look);
        lastStage = s;
        // New stage: scripted camera takes back over from any user-orbited
        // view, lerping to the new waypoint.
        userOwnsCamera = false;
        // Stage 3 needs V1-aware retint (positions may have been computed
        // before manifest arrived).
        if (s === 3) retintByV1();
        // Stage 7 (action potential) — hard SNAP the camera to the wide
        // shot so the pull-back is instantaneous when the user clicks
        // "Send signal". Disable damping briefly so OrbitControls
        // re-derives its internal spherical state from the new camera
        // position + target instead of fighting the snap.
        if (s === 7) {
          camera.position.copy(tc.pos);
          curCamLook.copy(tc.look);
          controls.target.copy(tc.look);
          camera.lookAt(tc.look);
          const wasDamping = controls.enableDamping;
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = wasDamping;
        }
      }

      // Mouse-brain transform target. Computed every frame because we hold
      // it at stage 1's offset position while the human is still visible
      // during a stage-2 transition — otherwise the mouse passes through the
      // human's volume on its way to centering, which looks awful.
      // Tight threshold (~0.015 combined opacity) so the human is essentially
      // invisible before the mouse begins to move.
      const HUMAN_GHOST_THRESHOLD = 0.015;
      const transformStage =
        s === 2 && cur.humanSolid + cur.humanWire > HUMAN_GHOST_THRESHOLD ? 1 : s;
      targetMousePos.copy(stageMouseTransforms[transformStage].pos);
      targetMouseScale = stageMouseTransforms[transformStage].scale;

      const target = stageOpacities[s];
      const k = 0.04;
      // Human-brain fade runs much faster than the rest so the human is
      // essentially gone by the time the mouse starts noticeably moving +
      // growing. Without this, both meshes cross through each other
      // mid-transition.
      const kHuman = 0.18;
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
      // Hologram overlay: tracks the wireframe presence (a fraction of
      // it, so it stays subtle), and animates uTime so scanlines drift.
      // Cap by stage: brightest on stages 2+3 (full mouse + V1), dimmer
      // when only the comparison cameo is showing.
      const hologramScale = (s === 2 || s === 3) ? 1.0 : 0.55;
      const hologramOpacity = cur.brainWire * 1.6 * hologramScale;
      for (const m of brainHologramMaterials) {
        m.uniforms.uTime.value = t;
        m.uniforms.uOpacity.value = hologramOpacity;
      }
      if (brainPointsMaterial) {
        brainPointsMaterial.opacity = cur.brainDots;
        brainPointsMaterial.size = cur.dotSize;
      }
      // Cut the human mesh out of the render entirely as soon as it's
      // basically invisible — at 0.01 opacity it can still leave a faint
      // ghost on the additive-blended wireframe, which reads as "the mouse
      // is moving through the brain."
      if (humanBrainShell) humanBrainShell.visible = cur.humanSolid + cur.humanWire > 0.012;
      if (brainShell) brainShell.visible = cur.brainSolid + cur.brainWire > 0.001;
      if (brainPoints) brainPoints.visible = cur.brainDots > 0.001;

      // Synapse-pair opacity — same value applied to both meshes' main +
      // wireframe materials (wireframe gets a softer multiplier).
      const applySynapseGroup = (group: THREE.Group | null, mainMats: THREE.MeshStandardMaterial[]) => {
        if (!group) return;
        for (const m of mainMats) m.opacity = cur.synapsePair;
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.isWire) {
            (obj.material as THREE.Material & { opacity: number }).opacity = cur.synapsePair * 0.06;
          }
        });
        group.visible = cur.synapsePair > 0.001;
      };
      applySynapseGroup(synapseAuraGroup, synapseAuraMaterials);
      applySynapseGroup(synapseTendrilGroup, synapseTendrilMaterials);
      // Synapse contact-point bloom — sprite with soft radial glow
      synapseBloom.mat.opacity = cur.synapseMarker;
      synapseBloom.sprite.visible = cur.synapseMarker > 0.001;
      // Human brain halo — fades with the human brain solid opacity.
      humanHaloBloom.mat.opacity = cur.humanSolid * 0.55;
      humanHaloBloom.sprite.visible = cur.humanSolid > 0.01;
      // Mouse brain halo — only visible when full-size mouse brain is on
      // screen (stages 2 + 3, after comparison transition completes).
      const mouseHaloIntensity = (s === 2 || s === 3) ? cur.brainSolid * 1.8 : 0;
      mouseHaloBloom.mat.opacity = mouseHaloIntensity;
      mouseHaloBloom.sprite.visible = mouseHaloIntensity > 0.005;

      // Action-potential animation — only on stage 7. 2-second lead-in
      // before the first pulse, then the cycle repeats. Sprite-based bloom
      // gives true soft edges.
      const setBloom = (
        bloom: { mat: THREE.SpriteMaterial },
        intensity: number,
      ) => {
        bloom.mat.opacity = intensity;
      };

      if (s === 7 && cur.synapsePair > 0.05) {
        if (stage7EnteredAt < 0) stage7EnteredAt = t;
        const stageT = t - stage7EnteredAt;
        const LEAD_IN = 1.5;
        if (stageT < LEAD_IN) {
          // Wait — show meshes but no pulse yet
          setBloom(axonBloom, 0);
          setBloom(pyramidBloom, 0);
          apAxonPulse.visible = false;
          apPyramidPulse.visible = false;
        } else {
          const animT = stageT - LEAD_IN;
          const PERIOD = 4.0;
          const phase = (animT % PERIOD) / PERIOD;
          // Phases:
          //   0.00–0.30  axon pulse travels Tendril far end → synapse
          //                (along Tendril skeleton, NOT a straight line)
          //   0.30–0.38  brief crossing flash at synapse
          //   0.38–0.65  pyramidal pulse: synapse → Aura soma (along
          //                Aura's post-synaptic dendrite skeleton)
          //   0.65–0.95  pyramidal pulse: Aura soma → axon distal tip
          //                (along Aura's axon skeleton)
          //   0.95–1.00  reset gap
          const AXON_END  = 0.30;
          const CROSS_END = 0.38;
          const SOMA_END  = 0.65;
          const PYRA_END  = 0.95;

          if (phase < AXON_END) {
            const u = phase / AXON_END;
            // Walk Tendril from far end (u=0) to synapse (u=1).
            if (tendrilPath) {
              samplePath(tendrilPath, u, apAxonPulse.position);
            } else {
              apAxonPulse.position.copy(FALLBACK_TENDRIL_FAR).multiplyScalar(1 - u);
            }
            setBloom(axonBloom, cur.synapsePair * 0.95);
            setBloom(pyramidBloom, 0);
            apAxonPulse.visible = true;
            apPyramidPulse.visible = false;
          } else if (phase < CROSS_END) {
            const u = (phase - AXON_END) / (CROSS_END - AXON_END);
            apAxonPulse.position.set(0, 0, 0);
            apPyramidPulse.position.set(0, 0, 0);
            setBloom(axonBloom, cur.synapsePair * 0.95 * (1 - u));
            setBloom(pyramidBloom, cur.synapsePair * 0.95 * u);
            apAxonPulse.visible = true;
            apPyramidPulse.visible = true;
          } else if (phase < SOMA_END) {
            // Synapse → soma along Aura's post-synaptic dendrite.
            const u = (phase - CROSS_END) / (SOMA_END - CROSS_END);
            if (auraApicalPath) {
              samplePath(auraApicalPath, u, apPyramidPulse.position);
            } else {
              apPyramidPulse.position.lerpVectors(new THREE.Vector3(0, 0, 0), FALLBACK_AURA_SOMA, u);
            }
            setBloom(axonBloom, 0);
            setBloom(pyramidBloom, cur.synapsePair * 0.95);
            apAxonPulse.visible = false;
            apPyramidPulse.visible = true;
          } else if (phase < PYRA_END) {
            // Soma → axon distal tip along Aura's axon.
            const u = (phase - SOMA_END) / (PYRA_END - SOMA_END);
            if (auraAxonPath) {
              samplePath(auraAxonPath, u, apPyramidPulse.position);
            } else {
              apPyramidPulse.position.lerpVectors(FALLBACK_AURA_SOMA, FALLBACK_AURA_AXON_END, u);
            }
            setBloom(axonBloom, 0);
            setBloom(pyramidBloom, cur.synapsePair * 0.95);
            apAxonPulse.visible = false;
            apPyramidPulse.visible = true;
          } else {
            setBloom(axonBloom, 0);
            setBloom(pyramidBloom, 0);
            apAxonPulse.visible = false;
            apPyramidPulse.visible = false;
          }
        }
      } else {
        if (s !== 7) stage7EnteredAt = -1; // reset for next entry
        setBloom(axonBloom, 0);
        setBloom(pyramidBloom, 0);
        apAxonPulse.visible = false;
        apPyramidPulse.visible = false;
      }

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
      // outward normal so the framing is always tight on V1 itself. Look-at
      // is shifted down so V1 sits in the upper part of the frame.
      if (s === 3 && brainShell && !userOwnsCamera) {
        const worldV1 = v1Right.clone();
        brainShell.localToWorld(worldV1);
        const outward = worldV1.clone().normalize();
        targetCamPos.copy(worldV1).addScaledVector(outward, 0.45);
        targetCamLook.copy(worldV1);
        targetCamLook.y -= 0.25;
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
      // Stage 7 (action-potential wide pull-back) gets a very snappy
      // 0.22 rate — convergent in ~10 frames (~0.17s) so it feels like
      // a near-instant zoom-out when the user hits "Send signal".
      const camK = s === 7 ? 0.22 : s <= 3 ? 0.025 : 0.045;
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
      [axonBloom, pyramidBloom, synapseBloom, humanHaloBloom, mouseHaloBloom].forEach(({ mat, tex }) => {
        mat.dispose();
        tex.dispose();
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
          Loading the brain · {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}
