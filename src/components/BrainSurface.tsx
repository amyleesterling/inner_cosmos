import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BrainActivityData } from "../data/brainActivity";

interface Props {
  /** Activity data; if undefined, the cortex renders at its baseline glow
   *  with no per-frame BOLD modulation. */
  activity?: BrainActivityData;
  /** Wall-clock seconds since the loop began, looped externally by the parent. */
  elapsedSec: number;
  onReady?: () => void;
  className?: string;
}

const BASE = import.meta.env.BASE_URL;

/** Renders the human cortex (FreeSurfer pial GLB) with per-vertex BOLD
 *  activity painted on via a custom ShaderMaterial. Each vertex carries a
 *  parcel id; per frame, we upload that frame's activity row into a 1-D data
 *  texture and the shader samples it at vertex space.
 *
 *  Visual treatment is "sci-fi meets magic":
 *  - deep navy base that breathes through violet → electric magenta → warm
 *    white as activity rises (asymmetric ramp; quiet regions read cool, hot
 *    regions blaze)
 *  - fresnel rim glow at grazing angles, tinted by activity at that vertex,
 *    so the silhouette of the brain pulses with the BOLD signal
 *  - additive shell rendered just outside the surface for a halo / bloom
 *    that hot spots leak into
 *  - ambient particle drift surrounding the brain, slowly orbiting the
 *    centroid — silent, distant, makes the cortex feel suspended in space */
export default function BrainSurface({ activity, elapsedSec, onReady, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(elapsedSec);
  const [ready, setReady] = useState(false);

  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.05, 60);
    camera.position.set(2.6, 0.9, 3.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 1.4;
    controls.maxDistance = 9;
    let resumeTimer: number | undefined;
    const stopAuto = () => { controls.autoRotate = false; window.clearTimeout(resumeTimer); };
    const resumeAuto = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => { controls.autoRotate = true; }, 2400);
    };
    renderer.domElement.addEventListener("pointerdown", stopAuto);
    renderer.domElement.addEventListener("pointerup", resumeAuto);
    renderer.domElement.addEventListener("pointercancel", resumeAuto);
    renderer.domElement.addEventListener("wheel", () => { stopAuto(); resumeAuto(); }, { passive: true });
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", () => { renderer.domElement.style.cursor = "grabbing"; });
    renderer.domElement.addEventListener("pointerup", () => { renderer.domElement.style.cursor = "grab"; });

    // Soft cool ambient — the cortex's own shader does most of the lighting,
    // these just keep dark sides from going pure black on extreme angles.
    scene.add(new THREE.AmbientLight(0x6a78c8, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(2.5, 5, 4);
    scene.add(key);

    // === Particle drift ===
    // 200 small motes pushed out to radius 4.0–7.0 so they don't crowd the
    // cortex. Each has its own phase/tilt/speed so the cloud never locks
    // into a pattern. Additive blending; small point size; gentle.
    const PARTICLES = 200;
    const partGeom = new THREE.BufferGeometry();
    const partPos = new Float32Array(PARTICLES * 3);
    const partSeed = new Float32Array(PARTICLES * 4); // [radius, phase, tiltY, speed]
    for (let i = 0; i < PARTICLES; i++) {
      const r = 4.0 + Math.random() * 3.0;
      const phase = Math.random() * Math.PI * 2;
      const tiltY = (Math.random() - 0.5) * 4.0;
      const speed = 0.04 + Math.random() * 0.08;
      partSeed[i * 4 + 0] = r;
      partSeed[i * 4 + 1] = phase;
      partSeed[i * 4 + 2] = tiltY;
      partSeed[i * 4 + 3] = speed;
      partPos[i * 3 + 0] = Math.cos(phase) * r;
      partPos[i * 3 + 1] = tiltY;
      partPos[i * 3 + 2] = Math.sin(phase) * r;
    }
    partGeom.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
    partGeom.setAttribute("seed", new THREE.BufferAttribute(partSeed, 4));
    const partMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 seed; // r, phase, tiltY, speed
        varying float vAlpha;
        uniform float uTime;
        void main() {
          float r = seed.x;
          float a = seed.y + uTime * seed.w;
          vec3 pos = vec3(cos(a) * r, seed.z + sin(a * 0.4) * 0.3, sin(a) * r);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = clamp(1.0 / (1.0 + length(mv.xyz) * 0.25), 0.04, 0.45);
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.0 + seed.y * 5.0);
          gl_PointSize = (1.4 - clamp(length(mv.xyz) * 0.16, 0.0, 1.0)) * twinkle * (220.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) discard;
          float core = pow(1.0 - r * 2.0, 1.8);
          vec3 col = mix(vec3(0.55, 0.45, 0.95), vec3(0.95, 0.85, 1.0), core);
          gl_FragColor = vec4(col * core, core * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(partGeom, partMat);
    scene.add(particles);

    let cortexGroup: THREE.Group | null = null;
    const cortexMaterials: THREE.ShaderMaterial[] = [];
    const haloMaterials: THREE.ShaderMaterial[] = [];

    // Parcel-activity uniform: a 1-D data texture sized [parcels+1, 1] — the
    // last texel is the "no signal" sentinel that off-cortex vertices read.
    const parcelCount = activity?.parcels ?? 1;
    const activityTex = new THREE.DataTexture(
      new Uint8Array(parcelCount + 1).fill(128),
      parcelCount + 1,
      1,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    activityTex.minFilter = THREE.NearestFilter;
    activityTex.magFilter = THREE.NearestFilter;
    activityTex.needsUpdate = true;

    const cortexVS = /* glsl */ `
      attribute float parcelId;
      varying float vActivity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform sampler2D uActivityTex;
      uniform float uTexWidth;
      void main() {
        float u = (parcelId + 0.5) / uTexWidth;
        vActivity = texture2D(uActivityTex, vec2(u, 0.5)).r;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const cortexFS = /* glsl */ `
      precision highp float;
      varying float vActivity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform float uTime;
      // Asymmetric ramp: cool below baseline, blazing hot above.
      const vec3 BASE_DEEP = vec3(0.06, 0.04, 0.16);  // near-black indigo
      const vec3 BASE_MID  = vec3(0.32, 0.18, 0.55);  // violet
      const vec3 HOT_LO    = vec3(0.85, 0.30, 0.95);  // electric magenta
      const vec3 HOT_MID   = vec3(1.00, 0.55, 0.85);  // pink-orange
      const vec3 HOT_HI    = vec3(1.00, 0.93, 0.78);  // warm white
      void main() {
        float a = clamp(vActivity, 0.0, 1.0);
        // Asymmetric ramp around 0.5 baseline.
        vec3 col;
        if (a < 0.5) {
          col = mix(BASE_DEEP, BASE_MID, smoothstep(0.0, 1.0, a * 2.0));
        } else {
          float t = (a - 0.5) * 2.0;
          col = mix(BASE_MID, HOT_LO, smoothstep(0.0, 0.55, t));
          col = mix(col, HOT_MID, smoothstep(0.45, 0.85, t));
          col = mix(col, HOT_HI, smoothstep(0.75, 1.0, t));
        }
        // Diffuse — soft, both-sides so concave folds stay readable.
        vec3 N = normalize(vNormal);
        float ndotl = abs(dot(N, normalize(vec3(0.4, 0.7, 0.6))));
        float lit = 0.55 + 0.45 * ndotl;
        // Fresnel rim — silhouette glows with the activity color.
        float fres = pow(1.0 - max(0.0, dot(N, normalize(vViewDir))), 2.4);
        // Subtle iridescent shimmer on the rim (slow blue↔magenta drift).
        vec3 iri = mix(vec3(0.45, 0.65, 1.0), vec3(1.0, 0.45, 0.95),
                       0.5 + 0.5 * sin(uTime * 0.6 + a * 5.0));
        vec3 rim = mix(col, iri, 0.65) * fres * (0.6 + 1.6 * a);
        // Self-emissive boost for the very hottest patches.
        float glow = pow(max(0.0, a - 0.55), 1.7) * 1.6;
        vec3 final = col * lit + rim + col * glow;
        gl_FragColor = vec4(final, 1.0);
      }
    `;

    // Halo shell — same geometry, slightly inflated, additive blending,
    // alpha falls off at the rim. Adds a "force field" haze around the brain.
    const haloVS = /* glsl */ `
      attribute float parcelId;
      varying float vActivity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform sampler2D uActivityTex;
      uniform float uTexWidth;
      void main() {
        float u = (parcelId + 0.5) / uTexWidth;
        vActivity = texture2D(uActivityTex, vec2(u, 0.5)).r;
        vec3 inflated = position + normal * 0.018;
        vec4 mv = modelViewMatrix * vec4(inflated, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const haloFS = /* glsl */ `
      precision highp float;
      varying float vActivity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        // Only visible at grazing angles — concentrates as a halo.
        float fres = pow(1.0 - max(0.0, dot(normalize(vNormal),
                                            normalize(vViewDir))), 3.2);
        float a = clamp(vActivity, 0.0, 1.0);
        // Halo color drifts from violet-cyan (cool) to magenta-warm (hot).
        vec3 cool = vec3(0.55, 0.50, 1.00);
        vec3 warm = vec3(1.00, 0.55, 0.90);
        vec3 col = mix(cool, warm, smoothstep(0.4, 0.95, a));
        float intensity = fres * (0.45 + 1.4 * a);
        gl_FragColor = vec4(col * intensity, intensity);
      }
    `;

    const loader = new GLTFLoader();
    loader.load(
      `${BASE}meshes/human-brain.glb`,
      (gltf) => {
        cortexGroup = new THREE.Group();
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) meshes.push(obj);
        });
        for (const mesh of meshes) {
          const geom = mesh.geometry as THREE.BufferGeometry;
          const vertCount = geom.attributes.position.count;
          // Per-vertex parcel id; sentinel for off-mask vertices.
          const ids = new Float32Array(vertCount);
          if (activity && activity.parcelIds.length === vertCount) {
            for (let i = 0; i < vertCount; i++) {
              const p = activity.parcelIds[i];
              ids[i] = p < activity.parcels ? p : activity.parcels;
            }
          } else {
            ids.fill(parcelCount);
          }
          geom.setAttribute("parcelId", new THREE.BufferAttribute(ids, 1));

          // Solid cortex pass.
          const mat = new THREE.ShaderMaterial({
            uniforms: {
              uActivityTex: { value: activityTex },
              uTexWidth: { value: parcelCount + 1 },
              uTime: { value: 0 },
            },
            vertexShader: cortexVS,
            fragmentShader: cortexFS,
            side: THREE.DoubleSide,
          });
          mesh.material = mat;
          cortexMaterials.push(mat);
          cortexGroup.add(mesh);

          // Halo shell pass — same geom, inflated outward.
          const halo = new THREE.Mesh(geom, new THREE.ShaderMaterial({
            uniforms: {
              uActivityTex: { value: activityTex },
              uTexWidth: { value: parcelCount + 1 },
            },
            vertexShader: haloVS,
            fragmentShader: haloFS,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
          }));
          haloMaterials.push(halo.material as THREE.ShaderMaterial);
          cortexGroup.add(halo);
        }
        scene.add(cortexGroup);

        // Frame the cortex into the viewport.
        const bbox = new THREE.Box3().setFromObject(cortexGroup);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);
        const radius = Math.max(size.x, size.y, size.z) * 0.55;
        const fov = (camera.fov * Math.PI) / 180;
        const dist = radius / Math.tan(fov / 2) + 0.5;
        camera.position.set(center.x + dist * 0.55, center.y + dist * 0.18, center.z + dist * 0.85);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.minDistance = Math.max(0.5, dist * 0.4);
        controls.maxDistance = dist * 4.5;
        controls.update();

        // No cerebellum on this page — there's no fMRI signal coregistered
        // for it (the EPI only covers cortex), so showing it dim and dead
        // would imply more than the data supports.
        setReady(true);
        onReady?.();
      },
      undefined,
      (err) => { console.error("cortex load failed:", err); },
    );

    let frameId = 0;
    const startedAt = performance.now();
    const animate = () => {
      const tNow = (performance.now() - startedAt) / 1000;
      controls.update();
      partMat.uniforms.uTime.value = tNow;
      for (const m of cortexMaterials) m.uniforms.uTime.value = tNow;

      // Update activity uniform: copy this frame's parcel row into the
      // 1-D data texture, with linear interpolation between adjacent BOLD
      // frames so the time axis reads as continuous motion.
      if (activity) {
        const tImage = activityTex.image as { data: Uint8Array };
        const t = elapsedRef.current;
        const period = activity.frames * activity.trSeconds;
        const phase = ((t % period) + period) % period;
        const fIdx = phase / activity.trSeconds;
        const f0 = Math.floor(fIdx) % activity.frames;
        const f1 = (f0 + 1) % activity.frames;
        const w = fIdx - Math.floor(fIdx);
        const dst = tImage.data;
        const src = activity.activity;
        const off0 = f0 * activity.parcels;
        const off1 = f1 * activity.parcels;
        for (let p = 0; p < activity.parcels; p++) {
          const a = src[off0 + p];
          const b = src[off1 + p];
          dst[p] = (a + (b - a) * w) | 0;
        }
        dst[activity.parcels] = 128; // sentinel baseline
        activityTex.needsUpdate = true;
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
      cancelAnimationFrame(frameId);
      window.clearTimeout(resumeTimer);
      observer.disconnect();
      controls.dispose();
      partGeom.dispose();
      partMat.dispose();
      cortexGroup?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      activityTex.dispose();
      cortexMaterials.forEach((m) => m.dispose());
      haloMaterials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  return (
    <div ref={containerRef} className={className}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/40 text-xs uppercase tracking-[0.3em]">loading cortex…</div>
        </div>
      )}
    </div>
  );
}
