import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * The Allen mouse brain mesh, retoned as a warm glowing gold lantern.
 *
 * Not anatomical, not clinical — radiant, lovable, a tiny sun. Slowly
 * breathes (scale pulse on a 4s cycle) and rotates. Drag to spin.
 *
 * Renders nothing else: no halo, no scanlines, no labels. The breathing
 * + the gold emissive are what carry the "lovable" feeling. Surrounded by
 * tiny floating motes so the brain feels alive in the air, not inert.
 */
interface Props {
  className?: string;
  /** When true, OrbitControls is disabled and the camera is driven entirely
   *  by the auto-rotate. Used in presenter mode. */
  presenter?: boolean;
  /** Path under public/ to load. Defaults to the Allen mouse brain. The
   *  kindergarten experience overrides this with the human brain so kids
   *  see "their" brain, not a mouse's. */
  meshUrl?: string;
  /** When false, the surrounding cloud of motes is suppressed — useful if
   *  the parent already paints its own ambient motes and the two would
   *  fight each other. */
  showMotes?: boolean;
}

export default function GoldenBrain({
  className,
  presenter = false,
  meshUrl,
  showMotes = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    camera.position.set(0, 0.05, 2.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting — warm key, cool fill, subtle rim. Keeps the gold reading as
    // gold (not yellow plastic) and gives the surface dimensional shadow.
    scene.add(new THREE.AmbientLight(0xfff2dc, 0.45));
    const key = new THREE.DirectionalLight(0xffd58a, 0.9);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffaa66, 0.35);
    fill.position.set(-3, -1, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff5d8, 0.4);
    rim.position.set(0, -2, -4);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enabled = !presenter;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = presenter ? "default" : "grab";
    if (!presenter) {
      renderer.domElement.addEventListener("pointerdown", () => {
        renderer.domElement.style.cursor = "grabbing";
        controls.autoRotate = false;
      });
      renderer.domElement.addEventListener("pointerup", () => {
        renderer.domElement.style.cursor = "grab";
        // Resume after a beat so the kid's idle moments still feel alive.
        window.setTimeout(() => { controls.autoRotate = true; }, 1800);
      });
    }

    const brainGroup = new THREE.Group();
    scene.add(brainGroup);

    // Breathing motes — 80 tiny sprites floating in a sphere around the
    // brain. They drift on a slow noise field and twinkle independently.
    // Read as "thoughts not yet decided what they are" per the brief.
    const moteCount = 80;
    const motePositions = new Float32Array(moteCount * 3);
    const motePhase = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      const r = 0.9 + Math.random() * 0.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      motePositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      motePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      motePositions[i * 3 + 2] = r * Math.cos(phi);
      motePhase[i] = Math.random() * Math.PI * 2;
    }
    const moteGeom = new THREE.BufferGeometry();
    moteGeom.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xfff5cc,
      size: 0.018,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const motes = new THREE.Points(moteGeom, moteMat);
    if (showMotes) scene.add(motes);

    const loader = new GLTFLoader();
    let cancelled = false;

    // Path is constructed against BASE_URL so it works in dev (/) and prod
    // (/inner_cosmos/) without code changes.
    const fullMeshUrl = `${import.meta.env.BASE_URL}${
      meshUrl ?? "meshes/mouse-brain.glb"
    }`;
    loader.load(
      fullMeshUrl,
      (gltf) => {
        if (cancelled) return;
        // Re-tone every mesh in the GLB to glowing gold. The mesh's stock
        // material is a desaturated grey; we replace it entirely.
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mat = new THREE.MeshStandardMaterial({
              color: 0xffb443,
              emissive: 0xff8a1f,
              emissiveIntensity: 0.55,
              metalness: 0.15,
              roughness: 0.55,
              transparent: false,
              side: THREE.FrontSide,
            });
            obj.material = mat;
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
        });

        // Center + scale to fit a roughly-2-unit-tall presentation.
        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        gltf.scene.position.sub(center);
        const scale = 1.65 / Math.max(size.x, size.y, size.z);
        gltf.scene.scale.setScalar(scale);
        // Tilt slightly so the kid sees the brain in three-quarter, not
        // dead-on; reads less symmetrical / more alive.
        gltf.scene.rotation.x = -0.12;
        brainGroup.add(gltf.scene);
        setLoaded(true);
      },
      undefined,
      (err) => {
        console.error("[GoldenBrain] failed to load mesh", err);
      },
    );

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;

      // Breathing: slow scale pulse on a 4-second cycle. ±3% so it's felt
      // more than seen — the kind of thing your eye doesn't catch but your
      // body does.
      const breath = 1 + Math.sin(elapsed * (Math.PI * 2) / 4) * 0.03;
      brainGroup.scale.setScalar(breath);

      // Motes drift on independent phases. Each rotates around the brain
      // center on its own axis, slowly.
      motes.rotation.y = elapsed * 0.05;
      motes.rotation.x = Math.sin(elapsed * 0.08) * 0.1;
      // Twinkle — opacity oscillates with the per-mote phase.
      const op = 0.5 + Math.sin(elapsed * 1.5) * 0.15;
      moteMat.opacity = op;

      controls.update();
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
      observer.disconnect();
      controls.dispose();
      brainGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      moteGeom.dispose();
      moteMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [presenter, meshUrl, showMotes]);

  return (
    <div ref={containerRef} className={className}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-amber-900/40 text-xs uppercase tracking-[0.3em]">
            …
          </div>
        </div>
      )}
    </div>
  );
}
