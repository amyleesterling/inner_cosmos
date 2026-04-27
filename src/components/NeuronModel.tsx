import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildMorphology, getPreset } from "../lib/morphology";

interface Props {
  preset: string;
  color: string;
  className?: string;
  cameraDistance?: number; // default 5
  spinSpeed?: number;       // radians/second, default 0.25
  /** Optional seed for stable random generation across renders */
  seed?: number;
}

// Mulberry32 PRNG — small, fast, deterministic
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function NeuronModel({
  preset,
  color,
  className,
  cameraDistance = 5,
  spinSpeed = 0.25,
  seed,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Seeded randomness for stable shape across remounts
    const originalRandom = Math.random;
    if (seed !== undefined) Math.random = makeRng(seed);

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, cameraDistance);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const cfg = getPreset(preset);
    const built = buildMorphology(cfg, new THREE.Color(color));
    scene.add(built.group);

    // Restore Math.random
    if (seed !== undefined) Math.random = originalRandom;

    // Slight initial tilt so we see depth
    built.group.rotation.x = -0.1;

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      built.group.rotation.y = t * spinSpeed;

      // Soma halo breathing — child[2]
      const halo = built.group.children[2] as THREE.Mesh;
      const haloMat = halo.material as THREE.MeshBasicMaterial;
      haloMat.opacity = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.7));

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      built.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [preset, color, cameraDistance, spinSpeed, seed]);

  return <div ref={containerRef} className={className} aria-hidden />;
}
