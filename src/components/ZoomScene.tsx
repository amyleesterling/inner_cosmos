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
  // Increments every time the user wants to (re)fire the action-potential
  // animation on stage 8. The first fire happens automatically when stage
  // becomes 7 (UI 8 of 8); subsequent fires come from the on-screen
  // "Send action potential" button. Animation runs ONE cycle per token,
  // then idles, so the user controls the cadence.
  apFireToken?: number;
  // Multiplier on the particle-mote size (default 1 = the original
  // /explore look). /kindergarten passes ~0.2 so the orbital sparkles read
  // as tiny stardust instead of dominating the kid-friendly hero shot.
  particleScale?: number;
  // Override base + hot colors of the orbital particles. Default keeps the
  // /explore violet/cyan duality. /kindergarten passes white for tiny
  // stars regardless of which brain is on screen.
  particleColor?: string;
  particleHotColor?: string;
  // Hide the "Loading the brain · X%" progress indicator. /kindergarten
  // sets this true — the indicator is academic chrome that doesn't fit
  // the kid-friendly experience.
  hideProgress?: boolean;
  // Replace the warm/cool keyed lighting with two equal pure-white front
  // studio lights (and lift ambient). When the brain is recolored via a
  // CSS hue-rotate, the warm/cool keys read as alien-tinted highlights;
  // pure white front lights survive the rotation cleanly.
  studioLighting?: boolean;
}

export default function ZoomScene({
  stage,
  apFireToken = 0,
  particleScale = 1,
  particleColor,
  particleHotColor,
  hideProgress = false,
  studioLighting = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const apFireTokenRef = useRef(apFireToken);
  apFireTokenRef.current = apFireToken;
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

    // Studio two-key setup so the human brain's gyri/sulci read in 3D.
    // Previously a single weak key + tiny cyan fill left the surface
    // mostly emissive-driven, which flattens shape (self-lit pixels look
    // the same regardless of normal direction). Now: lower ambient for
    // contrast, a warm front-right KEY rakes light across the folds so
    // sulci stay dark, and a cooler front-left KEY (acting as a strong
    // fill) lifts the shadow side without erasing it. The bloom sprite
    // behind the brain handles rim/separation.
    // TODO: enable shadowMap (renderer.shadowMap.enabled = true; key.castShadow,
    // mesh.receiveShadow + castShadow) for true self-shadowing in the
    // sulci. Skipped for now — emissive reduction + cross-keys gets most
    // of the win without the perf cost.
    if (studioLighting) {
      // Two-key studio: equal pure-white front lights (left + right) so a
      // CSS hue-rotate applied to the canvas doesn't bend warm/cool keys
      // into alien-tinted highlights. Ambient lifted so the shadow side
      // stays readable instead of going muddy.
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0);
      keyL.position.set(-2.5, 1.5, 3.5);
      scene.add(keyL);
      const keyR = new THREE.DirectionalLight(0xffffff, 1.0);
      keyR.position.set(2.5, 1.5, 3.5);
      scene.add(keyR);
    } else {
      scene.add(new THREE.AmbientLight(0xffffff, 0.18));
      const keyWarm = new THREE.DirectionalLight(new THREE.Color("#fff4e0"), 1.05);
      keyWarm.position.set(2.5, 3.0, 3.0);
      scene.add(keyWarm);
      const keyCool = new THREE.DirectionalLight(new THREE.Color("#a8c8ff"), 0.65);
      keyCool.position.set(-2.5, 2.0, 1.5);
      scene.add(keyCool);
    }

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
    // against the dark background. Forced to draw as a strict backdrop
    // (no depth test, negative renderOrder) so the brain's opaque
    // surface fully occludes it — otherwise the sprite's additive
    // glow leaks through fragments that sit behind it in z and the
    // brain looks see-through.
    const humanHaloBloom = makeBloomSprite([184, 110, 230], 3.6);
    humanHaloBloom.sprite.position.set(0, 0, -0.2);
    humanHaloBloom.mat.depthTest = false;
    humanHaloBloom.sprite.renderOrder = -10;
    scene.add(humanHaloBloom.sprite);
    // Stage-2/3 halo behind the mouse brain — cyan, hologram cast.
    // Same backdrop treatment as the human halo.
    const mouseHaloBloom = makeBloomSprite([95, 207, 255], 3.0);
    mouseHaloBloom.sprite.position.set(0, 0, -0.2);
    mouseHaloBloom.mat.depthTest = false;
    mouseHaloBloom.sprite.renderOrder = -10;
    scene.add(mouseHaloBloom.sprite);
    scene.add(axonBloom.sprite);
    scene.add(pyramidBloom.sprite);
    scene.add(synapseBloom.sprite);
    synapseBloom.sprite.position.set(0, 0, 0);
    // Aliases used by animation block below
    const apAxonPulse = axonBloom.sprite;
    const apPyramidPulse = pyramidBloom.sprite;

    // -------- Comet trails behind the AP pulses ------------------------
    // Small ring buffer of recent pulse positions, drawn as fading dots
    // so the action potential reads as "a moving spark + a tail of
    // fading sparks behind it" instead of a single sprite. One trail
    // per pulse phase (gold for axon, blue for pyramidal).
    const TRAIL_LEN = 28;
    const TRAIL_VERT = /* glsl */ `
      attribute float aIdx;
      uniform float uHeadSize;
      uniform float uOpacity;
      uniform vec3 uHeadPos;
      varying float vAlpha;
      void main() {
        float age = aIdx / ${TRAIL_LEN.toFixed(1)};      // 0 = head, 1 = tail
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Linear fade for soft drag; cube for sharp head
        vAlpha = pow(1.0 - age, 1.6) * uOpacity;
        gl_PointSize = uHeadSize * (0.35 + 0.65 * pow(1.0 - age, 1.2)) * (1.0 / max(0.05, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `;
    const TRAIL_FRAG = /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float core = smoothstep(0.5, 0.0, r);
        float alpha = core * core * vAlpha;
        gl_FragColor = vec4(uColor, alpha);
      }
    `;
    const makeTrail = (color: string, headSize: number) => {
      const positions = new Float32Array(TRAIL_LEN * 3);
      const idx = new Float32Array(TRAIL_LEN);
      for (let i = 0; i < TRAIL_LEN; i++) idx[i] = i;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uHeadSize: { value: headSize },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uHeadPos: { value: new THREE.Vector3() },
        },
        vertexShader: TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geom, mat);
      points.frustumCulled = false; // positions update per frame, BB stale
      return { points, mat, positions, geom };
    };
    const trailGold = makeTrail("#ffe28a", 70);
    const trailBlue = makeTrail("#9ad4ff", 70);
    scene.add(trailGold.points);
    scene.add(trailBlue.points);

    // Stamp the trail's positions: position 0 = head (current pulse loc),
    // positions 1..N = points behind it on the active path. We sample the
    // path at decreasing u to get a tail that follows the actual axon
    // curvature (not a straight line behind the pulse).
    const stampTrail = (
      trail: { positions: Float32Array; geom: THREE.BufferGeometry },
      path: THREE.Vector3[] | null,
      headU: number,
      headFallback: THREE.Vector3,
      stepU: number,
    ) => {
      const tmp = new THREE.Vector3();
      for (let i = 0; i < TRAIL_LEN; i++) {
        const u = headU - i * stepU;
        if (u <= 0 || !path) {
          // Tail extends past the start of the path: collapse onto the
          // head (zero spacing) so old tail points don't lag at origin.
          if (path) {
            tmp.copy(path[0]);
          } else {
            tmp.copy(headFallback);
          }
        } else {
          const f = u * (path.length - 1);
          const j = Math.floor(f);
          const tt = f - j;
          if (j >= path.length - 1) tmp.copy(path[path.length - 1]);
          else tmp.copy(path[j]).lerp(path[j + 1], tt);
        }
        trail.positions[i * 3]     = tmp.x;
        trail.positions[i * 3 + 1] = tmp.y;
        trail.positions[i * 3 + 2] = tmp.z;
      }
      (trail.geom.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    };
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

    // -------- Orbital particle motes around the brains -----------------
    // A drifting cloud of tiny twinkling points that surrounds whichever
    // brain is currently on screen. Mythical / "oddly satisfying" —
    // points sit on a thick spherical shell, each twinkles on its own
    // phase, and the whole cloud rotates very slowly. Two clouds: violet
    // around the human brain (stages 0-1), cyan around the mouse brain
    // (stages 2-3).
    const PARTICLE_VERT = /* glsl */ `
      attribute float aPhase;
      attribute float aFreq;
      attribute float aBaseSize;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uSize;
      varying float vAlpha;
      void main() {
        // Per-particle gentle "breathing" radius modulation
        vec3 p = position;
        float breathe = 1.0 + 0.04 * sin(uTime * 0.5 + aPhase);
        p *= breathe;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // Twinkle: per-particle oscillating intensity. Some particles are
        // bright + slow, others dim + faster. A fraction live below
        // visibility most of the time and "pop" briefly.
        float blink = 0.5 + 0.5 * sin(uTime * aFreq + aPhase);
        vAlpha = pow(blink, 1.6) * uOpacity;
        // Distance attenuation (perspective point sizing)
        gl_PointSize = uSize * aBaseSize * (1.0 + 0.6 * blink) * (1.0 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `;
    const PARTICLE_FRAG = /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHotColor;
      varying float vAlpha;
      void main() {
        // Soft circular sprite — radial falloff with a small bright core
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float core = smoothstep(0.5, 0.0, r);
        float halo = smoothstep(0.5, 0.18, r);
        vec3 col = mix(uColor, uHotColor, core * core);
        gl_FragColor = vec4(col, halo * vAlpha);
      }
    `;
    const makeParticleCloud = (
      count: number,
      radiusInner: number,
      radiusOuter: number,
      color: string,
      hotColor: string,
      sizePx: number,
    ) => {
      const pos = new Float32Array(count * 3);
      const phase = new Float32Array(count);
      const freq = new Float32Array(count);
      const base = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        // Uniform random direction on sphere
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        // Radius — biased toward outer shell for "halo" feel
        const r = radiusInner + (radiusOuter - radiusInner) * Math.pow(Math.random(), 0.5);
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        phase[i] = Math.random() * Math.PI * 2;
        // Per-particle twinkle frequency varies for organic feel
        freq[i] = 0.4 + Math.random() * 1.6;
        // Per-particle base size — most small, a few big (sparkles)
        base[i] = 0.35 + Math.pow(Math.random(), 3.0) * 1.4;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geom.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
      geom.setAttribute("aFreq", new THREE.BufferAttribute(freq, 1));
      geom.setAttribute("aBaseSize", new THREE.BufferAttribute(base, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uSize: { value: sizePx },
          uColor: { value: new THREE.Color(color) },
          uHotColor: { value: new THREE.Color(hotColor) },
        },
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geom, mat);
      return { points, mat };
    };
    // Violet motes for the human brain — sparse + smaller so they read as
    // distant pinpricks rather than crowded fluffy blobs.
    const humanParticles = makeParticleCloud(320, 1.0, 2.5, particleColor ?? "#c08bff", particleHotColor ?? "#fff5ff", 26 * particleScale);
    scene.add(humanParticles.points);
    // Cyan motes for the mouse brain — same treatment.
    const mouseParticles = makeParticleCloud(280, 0.9, 2.3, particleColor ?? "#7ed9ff", particleHotColor ?? "#eafaff", 24 * particleScale);
    scene.add(mouseParticles.points);
    // Mouse-brain hologram overlay — Prometheus-style: dotted topographic
    // contours wrapping the surface, a vertical scanning bar, and a bright
    // Fresnel rim. The dots are discrete (latitude bands × longitude
    // ticks) so the hologram reads as "constructed of light" rather than
    // a smooth gradient. Opacity scales with cur.brainWire; uTime drives
    // the scan bar + a slow drift on the dot pattern.
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

      // Smooth dot mask centered on 0.5 in [0,1] — used to make dotted
      // patterns from fract() coordinates without aliasing.
      float dotMask(float v, float thickness) {
        float d = abs(v - 0.5);
        return smoothstep(thickness, thickness * 0.5, d);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);

        // ---- Fresnel ----------------------------------------------------
        float fres = 1.0 - max(0.0, dot(N, V));
        float fresRim  = pow(fres, 2.6);   // sharp edge highlight
        float fresFill = pow(fres, 1.1);   // soft body wash

        // ---- Latitude/longitude wrap -----------------------------------
        // Treat the brain as a roughly upright shell: latitude = local Y,
        // longitude = atan(z, x). Dots are placed on a (lat, lon) grid so
        // they wrap the geometry instead of projecting flat onto screen.
        float lat = vLocalPos.y;
        float lon = atan(vLocalPos.z, vLocalPos.x);  // -PI..PI

        // ---- Topo contour bands ----------------------------------------
        // Horizontal contour rings every ~0.06 in local Y, drifting slowly.
        float bandT = lat * 16.0 + uTime * 0.08;
        float band = dotMask(fract(bandT), 0.18);

        // Make the bands DOTTED by modulating along longitude, so each
        // ring is a dashed circle rather than a continuous line.
        float lonU = fract(lon * 6.0 / 6.2832 + uTime * 0.05);  // ~12 dashes per ring
        float dash = dotMask(lonU, 0.30);
        float contour = band * dash;

        // ---- Surface dot grid ------------------------------------------
        // Sparse fine dot field across the surface — gives the "made of
        // light points" texture between contour rings.
        float gridU = fract(lon * 22.0 / 6.2832);
        float gridV = fract(lat * 30.0);
        float dotGrid = dotMask(gridU, 0.22) * dotMask(gridV, 0.22);

        // ---- Sweeping scan bar -----------------------------------------
        // A bright horizontal bar that travels top→bottom and wraps.
        float scanRange = 1.4;
        float scanY = mix(scanRange, -scanRange, fract(uTime * 0.18));
        float scanDist = abs(lat - scanY);
        float scanBar = exp(-scanDist * scanDist * 110.0);

        // ---- Compose ---------------------------------------------------
        // Tone targets: keep total brightness modest. Additive blending
        // on top of the existing solid + wireframe layers means anything
        // approaching 1.0 alpha clips to white, so contributions stay low.
        vec3 dim   = uBaseColor;
        vec3 mid   = mix(uBaseColor, uEdgeColor, 0.55);
        vec3 hot   = mix(uBaseColor, uEdgeColor, 0.85);  // soft cyan, NOT near-white

        vec3 color = mid * contour * 0.8;
        color    += hot * dotGrid * 0.25;
        color    += hot * scanBar * 0.5;
        color    += uEdgeColor * fresRim * 0.85;

        float alpha = (
            fresRim   * 0.45 +
            contour   * 0.55 +
            dotGrid   * 0.20 +
            scanBar   * 0.32
        ) * uOpacity;

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
          // Saturated purple with strong emissive glow. FrontSide only +
          // depthWrite so the brain renders as a SOLID 3D form rather than
          // a translucent shell — at full opacity the back faces shouldn't
          // bleed through and create dark patches.
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#b072e0"),
            emissive: new THREE.Color("#7a3ac0"),
            // Dropped from 1.1 → 0.35 so the surface isn't entirely
            // self-illuminated; the studio two-key lighting now defines
            // the gyri/sulci instead of being washed out by self-glow.
            emissiveIntensity: 0.35,
            roughness: 0.7,
            metalness: 0.0,
            transparent: true,
            opacity: 0.0,
            // DoubleSide so the brain reads as a solid object even if
            // the camera ends up close to or just inside the surface —
            // FrontSide left the inside hollow, which made the brain
            // look see-through at high zoom.
            side: THREE.DoubleSide,
            depthWrite: true,
          });
          obj.material = mat;
          humanBrainSolidMaterials.push(mat);

          // Stylistic glowing-gyri overlay: bright lavender wireframe
          // with additive blending, sitting ON TOP of the now-solid
          // DoubleSide brain. polygonOffset lifts the lines just off
          // the surface so they don't z-fight with it.
          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#f0c0ff"),
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
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

        // Cerebellum lives in the same coordinate frame as the cortex
        // (extract-cerebellum.py reuses the cortex's center+scale). Loaded
        // inside the cortex callback so it's parented to humanBrainShell —
        // fades + rotates as one. Materials get pushed into the SAME arrays
        // as the cortex so opacity tracks cur.humanSolid / cur.humanWire.
        // Slightly deeper purple so the cauliflower reads as a separate
        // structure from the cortex above it.
        loader.load(
          `${BASE}meshes/human-cerebellum.glb`,
          (cgltf) => {
            const cMeshes: THREE.Mesh[] = [];
            cgltf.scene.traverse((obj) => {
              if (obj instanceof THREE.Mesh) cMeshes.push(obj);
            });
            for (const obj of cMeshes) {
              const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color("#9b58d4"),
                emissive: new THREE.Color("#5e2aa8"),
                emissiveIntensity: 0.28,
                roughness: 0.75,
                metalness: 0.0,
                transparent: true,
                opacity: 0.0,
                side: THREE.DoubleSide,
                depthWrite: true,
              });
              obj.material = mat;
              humanBrainSolidMaterials.push(mat);

              const cWireMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color("#e7b1ff"),
                wireframe: true,
                transparent: true,
                opacity: 0.0,
                blending: THREE.AdditiveBlending,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
                depthWrite: false,
              });
              const cWireMesh = new THREE.Mesh(obj.geometry, cWireMat);
              obj.add(cWireMesh);
              humanBrainWireMaterials.push(cWireMat);
              humanBrainShell!.add(obj);
            }
          },
          undefined,
          (e) => console.error("cerebellum mesh", e),
        );
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
              uBaseColor: { value: new THREE.Color("#0e7fb8") },  // deeper teal-cyan body
              uEdgeColor: { value: new THREE.Color("#a7f0ff") },  // bright cyan rim
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
      // 0 — human brain alone. Fully opaque + DoubleSide so the surface
      // reads as a solid object even at close zoom; the additive
      // wireframe sits ON TOP of that solid surface as a stylistic
      // glowing-gyri treatment, not as a net you can see through.
      { humanSolid: 1.00, humanWire: 0.07, brainSolid: 0,    brainWire: 0,    brainDots: 0,    dotSize: 0.012, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
      // 1 — comparison: human + small mouse to scale, dots off
      { humanSolid: 1.00, humanWire: 0.06, brainSolid: 0.55, brainWire: 0.10, brainDots: 0,    dotSize: 0.011, cells: 0,    hero: 0,    synapsePair: 0,    synapseMarker: 0    },
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
          // Cell cluster — wide enough to frame all ten cells with the
          // outermost dendrites still in view. The cluster (cell bodies +
          // apical/basal dendrites) effectively spans ~3 units, so the
          // camera sits ~3.6 units back. Earlier attempt to make the
          // stage-3 → stage-4 transition feel like a forward push by
          // pulling cam in to z=0.85 cropped the outer cells; keeping it
          // at the original framing here so the whole circuit reads.
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
          // Action potential — wide shot, mesh occupies the upper ~60%
          // of the viewport with the stage label sitting comfortably
          // below. Camera is pulled back and look-at is dropped so the
          // synapse contact (world origin) lands near the top of the
          // frame, the way Amy sketched the layout.
          return { pos: new THREE.Vector3(0.45, -0.30, 2.30), look: new THREE.Vector3(0.30, -0.65, 0) };
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
    // Min 0.05 let users zoom right inside meshes (the brain showed its
    // back-faces / triangulation as see-through artefacts). 0.6 keeps
    // the camera safely outside the brain volume on stages 0/1 while
    // still letting close-ups on the cluster + synapse stages work.
    controls.minDistance = 0.6;
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

    // Double-click to recentre. Raycast from the click into the scene; if
    // we hit a mesh, glide controls.target (the orbit pivot) to the hit
    // point so subsequent drags rotate around what the user double-tapped.
    // Animation handled inline in the animate loop below.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let recenterTarget: THREE.Vector3 | null = null;
    let recenterStartedAt = 0;
    const RECENTER_DURATION = 0.6;
    const recenterFrom = new THREE.Vector3();
    renderer.domElement.addEventListener("dblclick", (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      // Collect raycastable meshes from the visible scene. Skip wireframe
      // overlays + the bloom sprites (sprite raycasting is iffy and we
      // don't want to recentre on a glow).
      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          !obj.userData.isWire
        ) targets.push(obj);
      });
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        recenterFrom.copy(controls.target);
        recenterTarget = hits[0].point.clone();
        recenterStartedAt = (performance.now() - start) / 1000;
        userOwnsCamera = true;
      }
    });

    let lastStage = -1;
    let apFiredAt = -1;       // wall-clock of the current AP cycle's start (-1 = idle)
    let apTokenSeen = -1;     // last apFireToken value we acted on
    let apQueueDepth = 0;     // pending cycles to fire after the current one (capped MAX_AP_QUEUE)
    const MAX_AP_QUEUE = 5;   // up to 5 spikes in flight, then further clicks ignored
    let apCharge = 0;         // 0..1 charge-up brightness during the lead-in
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
      // Brain channels (mouse-brain solid / wire / dots) fade OUT fast on
      // stage transitions so the next stage's content can come forward
      // cleanly. The "zoom into a square then reveal cells" feel on the
      // stage 4 → 5 transition relies on the brain clearing in <1s
      // instead of the slow default lerp.
      const kFastOut = 0.16;
      const brainK = (v: number, tgt: number) => (tgt < v ? kFastOut : k);
      cur.humanSolid += (target.humanSolid - cur.humanSolid) * kHuman;
      cur.humanWire += (target.humanWire - cur.humanWire) * kHuman;
      cur.brainSolid += (target.brainSolid - cur.brainSolid) * brainK(cur.brainSolid, target.brainSolid);
      cur.brainWire += (target.brainWire - cur.brainWire) * brainK(cur.brainWire, target.brainWire);
      cur.brainDots += (target.brainDots - cur.brainDots) * brainK(cur.brainDots, target.brainDots);
      cur.dotSize += (target.dotSize - cur.dotSize) * k;
      // Cells fade-in is gated: don't grow toward target.cells until the
      // brain has mostly cleared (sum of brain channels < 0.18). Out-fade
      // uses the normal rate. This is what makes the "zoom into a dot,
      // then reveal cells" beat read as a clean handoff instead of a
      // fade-cross.
      const brainPresence = cur.brainSolid + cur.brainWire + cur.brainDots;
      const cellsFadingIn = target.cells > cur.cells || target.hero > cur.hero;
      const cellsK = cellsFadingIn && brainPresence > 0.18 ? 0 : k;
      cur.cells += (target.cells - cur.cells) * cellsK;
      cur.hero += (target.hero - cur.hero) * cellsK;
      cur.synapsePair += (target.synapsePair - cur.synapsePair) * k;
      cur.synapseMarker += (target.synapseMarker - cur.synapseMarker) * k;

      humanBrainSolidMaterials.forEach((m) => (m.opacity = cur.humanSolid));
      humanBrainWireMaterials.forEach((m) => (m.opacity = cur.humanWire));
      brainShellSolidMaterials.forEach((m) => (m.opacity = cur.brainSolid));
      brainShellWireMaterials.forEach((m) => (m.opacity = cur.brainWire));
      // Hologram overlay: subtle, tracks wireframe presence. Capped so
      // the additive contribution doesn't overexpose the surface.
      const hologramScale = (s === 2 || s === 3) ? 1.0 : 0.45;
      const hologramOpacity = Math.min(0.55, cur.brainWire * 0.55 * hologramScale);
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
      // Synapse contact-point bloom — breathes via combined opacity +
      // scale modulation. Period ~3s, opacity range ±35%, scale range
      // ±25% of the base 0.07. Subtle but actually visible if you watch.
      const breathPhase = t * (Math.PI * 2 / 3.0);
      const breathOpac = 1 + 0.35 * Math.sin(breathPhase);
      const breathScale = 0.07 * (1 + 0.25 * Math.sin(breathPhase));
      synapseBloom.mat.opacity = cur.synapseMarker * breathOpac;
      synapseBloom.sprite.scale.set(breathScale, breathScale, 1);
      synapseBloom.sprite.visible = cur.synapseMarker > 0.001;
      // Human brain halo — fades with the human brain solid opacity.
      humanHaloBloom.mat.opacity = cur.humanSolid * 0.55;
      humanHaloBloom.sprite.visible = cur.humanSolid > 0.01;
      // Mouse brain halo — only visible when full-size mouse brain is on
      // screen (stages 2 + 3, after comparison transition completes).
      const mouseHaloIntensity = (s === 2 || s === 3) ? cur.brainSolid * 1.8 : 0;
      mouseHaloBloom.mat.opacity = mouseHaloIntensity;
      mouseHaloBloom.sprite.visible = mouseHaloIntensity > 0.005;

      // Orbital particle motes — twinkle every frame, slowly orbit the
      // brains. Visible whenever the corresponding brain is on screen.
      humanParticles.mat.uniforms.uTime.value = t;
      humanParticles.mat.uniforms.uOpacity.value = cur.humanSolid * 0.85;
      humanParticles.points.visible = cur.humanSolid > 0.01;
      humanParticles.points.rotation.y = t * 0.04;
      humanParticles.points.rotation.x = Math.sin(t * 0.025) * 0.18;

      mouseParticles.mat.uniforms.uTime.value = t * 1.05;  // slight detune
      // Visible on stages 2-3 (full mouse brain) and very faintly on
      // stage 1. The comparison cameo showed a too-strong cyan halo
      // around the small mouse brain — a hint of sparkle is enough.
      const mouseSparkle = (s === 1) ? cur.brainSolid * 0.10
                          : (s === 2 || s === 3) ? cur.brainSolid * 1.0
                          : 0;
      mouseParticles.mat.uniforms.uOpacity.value = mouseSparkle;
      mouseParticles.points.visible = mouseSparkle > 0.005;
      mouseParticles.points.rotation.y = t * 0.05;
      mouseParticles.points.rotation.z = Math.sin(t * 0.022) * 0.15;
      // Track the mouse brain's position + scale on stage 1 so the
      // particles surround the small offset brain, not the origin.
      if (brainShell) {
        mouseParticles.points.position.copy(brainShell.position);
        mouseParticles.points.scale.setScalar(brainShell.scale.x);
      }

      // Action-potential animation — only on stage 7. 2-second lead-in
      // before the first pulse, then the cycle repeats. Sprite-based bloom
      // gives true soft edges.
      const setBloom = (
        bloom: { mat: THREE.SpriteMaterial },
        intensity: number,
      ) => {
        bloom.mat.opacity = intensity;
      };

      // Action-potential animation. ONE cycle per fire-token (the user
      // owns the cadence): the first token is auto-emitted on stage 7
      // entry, subsequent tokens come from the on-screen "Send action
      // potential" button. Cycle = charge-up at synapse → gold pulse
      // along Tendril → cross flash → blue pulse along Aura → idle.
      const TOKEN_AUTOFIRE_FIRST = 0; // sentinel; first apTokenSeen so auto-fire happens once on entry
      apCharge = 0;
      if (s === 7 && cur.synapsePair > 0.05) {
        // Auto-fire the first time we land on the AP stage
        if (apTokenSeen < TOKEN_AUTOFIRE_FIRST) {
          apFiredAt = t;
          apTokenSeen = apFireTokenRef.current;
        }
        // Each click increments the token. Treat the delta as queued
        // cycles; cap so a button-mash doesn't run forever (MAX_AP_QUEUE).
        // If currently idle, kick off the first one immediately and
        // queue the rest; if mid-flight, just bump the queue.
        if (apFireTokenRef.current !== apTokenSeen) {
          const delta = apFireTokenRef.current - apTokenSeen;
          apTokenSeen = apFireTokenRef.current;
          if (apFiredAt < 0) {
            apFiredAt = t;
            apQueueDepth = Math.min(MAX_AP_QUEUE, apQueueDepth + delta - 1);
          } else {
            apQueueDepth = Math.min(MAX_AP_QUEUE, apQueueDepth + delta);
          }
        }
        const stageT = apFiredAt < 0 ? -1 : t - apFiredAt;
        // No charge-up: the pulse fires the instant the user clicks. The
        // earlier 0.95s ramp + 0.20s release felt like a 1+ second delay
        // between click and visible motion.
        const CHARGE = 0;
        const LEAD_IN = 0;
        const CYCLE_LEN = 4.0;     // single AP cycle, no looping
        const AXON_END  = 0.30;
        const CROSS_END = 0.38;
        const SOMA_END  = 0.65;
        const PYRA_END  = 0.95;
        if (stageT < 0 || stageT >= LEAD_IN + CYCLE_LEN) {
          // End of a cycle. If queue has more, kick the next one off
          // immediately so the spikes read as a burst sequence.
          if (apFiredAt >= 0 && stageT >= LEAD_IN + CYCLE_LEN && apQueueDepth > 0) {
            apFiredAt = t;
            apQueueDepth -= 1;
          } else if (apFiredAt >= 0 && stageT >= LEAD_IN + CYCLE_LEN) {
            apFiredAt = -1;
          }
          // Idle (pre-fire OR post-cycle) — pulses off, no charge
          setBloom(axonBloom, 0);
          setBloom(pyramidBloom, 0);
          apAxonPulse.visible = false;
          apPyramidPulse.visible = false;
          apCharge = 0;
        } else if (stageT < LEAD_IN) {
          // Charging at the synapse — bloom intensifies + grows briefly
          if (stageT < CHARGE) {
            apCharge = stageT / CHARGE;          // 0 → 1 ease-in
          } else {
            apCharge = 1 - (stageT - CHARGE) / (LEAD_IN - CHARGE); // 1 → 0 release
          }
          setBloom(axonBloom, 0);
          setBloom(pyramidBloom, 0);
          apAxonPulse.visible = false;
          apPyramidPulse.visible = false;
        } else {
          const animT = stageT - LEAD_IN;
          const phase = animT / CYCLE_LEN;
          // Trail sampling: the tail extends 0.10 of the active path
          // behind the head (about 10% of the segment), spread across
          // TRAIL_LEN points.
          const TRAIL_SPAN_U = 0.10;
          const trailStep = TRAIL_SPAN_U / (TRAIL_LEN - 1);
          if (phase < AXON_END) {
            const u = phase / AXON_END;
            if (tendrilPath) {
              samplePath(tendrilPath, u, apAxonPulse.position);
            } else {
              apAxonPulse.position.copy(FALLBACK_TENDRIL_FAR).multiplyScalar(1 - u);
            }
            setBloom(axonBloom, cur.synapsePair * 0.95);
            setBloom(pyramidBloom, 0);
            apAxonPulse.visible = true;
            apPyramidPulse.visible = false;
            // Trail follows the gold pulse along Tendril
            stampTrail(trailGold, tendrilPath, u, FALLBACK_TENDRIL_FAR, trailStep);
            trailGold.mat.uniforms.uOpacity.value = cur.synapsePair * 0.85;
            trailBlue.mat.uniforms.uOpacity.value = 0;
          } else if (phase < CROSS_END) {
            const u = (phase - AXON_END) / (CROSS_END - AXON_END);
            apAxonPulse.position.set(0, 0, 0);
            apPyramidPulse.position.set(0, 0, 0);
            setBloom(axonBloom, cur.synapsePair * 0.95 * (1 - u));
            setBloom(pyramidBloom, cur.synapsePair * 0.95 * u);
            apAxonPulse.visible = true;
            apPyramidPulse.visible = true;
            // Crossing flash: collapse both trails toward origin so they
            // don't visually trail off in the wrong direction.
            stampTrail(trailGold, tendrilPath, 1.0, FALLBACK_TENDRIL_FAR, trailStep);
            trailGold.mat.uniforms.uOpacity.value = cur.synapsePair * 0.85 * (1 - u);
            trailBlue.mat.uniforms.uOpacity.value = 0;
          } else if (phase < SOMA_END) {
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
            // Trail follows the blue pulse along the apical dendrite
            stampTrail(trailBlue, auraApicalPath, u, FALLBACK_AURA_SOMA, trailStep);
            trailGold.mat.uniforms.uOpacity.value = 0;
            trailBlue.mat.uniforms.uOpacity.value = cur.synapsePair * 0.85;
          } else if (phase < PYRA_END) {
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
            // Trail continues behind the blue pulse on the axon
            stampTrail(trailBlue, auraAxonPath, u, FALLBACK_AURA_AXON_END, trailStep);
            trailGold.mat.uniforms.uOpacity.value = 0;
            trailBlue.mat.uniforms.uOpacity.value = cur.synapsePair * 0.85;
          } else {
            setBloom(axonBloom, 0);
            setBloom(pyramidBloom, 0);
            apAxonPulse.visible = false;
            apPyramidPulse.visible = false;
            trailGold.mat.uniforms.uOpacity.value = 0;
            trailBlue.mat.uniforms.uOpacity.value = 0;
          }
        }
        // Trails always hidden during charge-up + idle phases
        if (stageT < 0 || stageT < LEAD_IN || stageT >= LEAD_IN + CYCLE_LEN) {
          trailGold.mat.uniforms.uOpacity.value = 0;
          trailBlue.mat.uniforms.uOpacity.value = 0;
        }
      } else {
        if (s !== 7) {
          apFiredAt = -1;
          apTokenSeen = -1; // reset so re-entry auto-fires again
          apQueueDepth = 0; // wipe pending spikes — fresh start on re-entry
        }
        setBloom(axonBloom, 0);
        setBloom(pyramidBloom, 0);
        apAxonPulse.visible = false;
        apPyramidPulse.visible = false;
        trailGold.mat.uniforms.uOpacity.value = 0;
        trailBlue.mat.uniforms.uOpacity.value = 0;
      }
      // Boost the synapse-contact bloom during charge-up so the user
      // sees energy gathering at the synapse before the pulse fires.
      if (apCharge > 0) {
        synapseBloom.mat.opacity = cur.synapseMarker * (1 + apCharge * 1.6);
        synapseBloom.sprite.scale.setScalar(0.07 * (1 + apCharge * 0.7));
        synapseBloom.sprite.visible = true;
      } else {
        synapseBloom.sprite.scale.setScalar(0.07);
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
      // Double-click recenter — eased lerp of controls.target toward the
      // hit point, then we let the user keep orbiting from there.
      if (recenterTarget) {
        const elapsed = t - recenterStartedAt;
        const u = Math.min(1, elapsed / RECENTER_DURATION);
        const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        controls.target.copy(recenterFrom).lerp(recenterTarget, ease);
        if (u >= 1) recenterTarget = null;
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
      {progress < 1 && !hideProgress && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40 pointer-events-none">
          Loading the brain · {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}
