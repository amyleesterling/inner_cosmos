import { useEffect, useRef } from "react";
import * as THREE from "three";

const PALETTE = [
  new THREE.Color("#7ee0ff"),
  new THREE.Color("#b78bff"),
  new THREE.Color("#ff7ee0"),
  new THREE.Color("#ffd9a8"),
  new THREE.Color("#9af5d8"),
];

interface Neuron {
  group: THREE.Group;
  spinSpeed: THREE.Vector3;
  drift: THREE.Vector3;
  basePos: THREE.Vector3;
  pulsePhase: number;
}

function grow(
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  depth: number,
  segments: number[],
  tipPositions: THREE.Vector3[],
) {
  if (depth <= 0 || length < 0.05) {
    tipPositions.push(start.clone());
    return;
  }

  const steps = 6;
  let prev = start.clone();
  const curDir = dir.clone().normalize();
  for (let s = 0; s < steps; s++) {
    curDir.x += (Math.random() - 0.5) * 0.18;
    curDir.y += (Math.random() - 0.5) * 0.18;
    curDir.z += (Math.random() - 0.5) * 0.18;
    curDir.normalize();
    const next = prev.clone().add(curDir.clone().multiplyScalar(length / steps));
    segments.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
    prev = next;
  }

  const children = depth > 2 ? 2 : Math.random() > 0.35 ? 2 : 1;
  for (let c = 0; c < children; c++) {
    const newDir = curDir.clone();
    newDir.x += (Math.random() - 0.5) * 1.1;
    newDir.y += (Math.random() - 0.5) * 1.1;
    newDir.z += (Math.random() - 0.5) * 1.1;
    newDir.normalize();
    grow(prev, newDir, length * (0.55 + Math.random() * 0.15), depth - 1, segments, tipPositions);
  }
}

function buildNeuron(scale: number, color: THREE.Color): Neuron {
  const group = new THREE.Group();
  const segments: number[] = [];
  const tipPositions: THREE.Vector3[] = [];

  const numMainBranches = 5 + Math.floor(Math.random() * 3);
  const soma = new THREE.Vector3(0, 0, 0);

  for (let i = 0; i < numMainBranches; i++) {
    const theta = (i / numMainBranches) * Math.PI * 2 + Math.random() * 0.4;
    const phi = (Math.random() - 0.5) * Math.PI * 0.7;
    const dir = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi),
    );
    grow(soma, dir, 1.6 + Math.random() * 0.6, 3, segments, tipPositions);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, lineMaterial);
  group.add(lines);

  // Soma — bright glowing sphere
  const somaMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const somaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), somaMat);
  group.add(somaMesh);

  // Soma halo
  const haloMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), haloMat);
  group.add(haloMesh);

  // Tip glow points
  const tipPositionsFlat: number[] = [];
  for (const t of tipPositions) tipPositionsFlat.push(t.x, t.y, t.z);
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute("position", new THREE.Float32BufferAttribute(tipPositionsFlat, 3));
  const tipMat = new THREE.PointsMaterial({
    color: color,
    size: 0.08,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const tips = new THREE.Points(tipGeo, tipMat);
  group.add(tips);

  group.scale.setScalar(scale);

  return {
    group,
    spinSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.0008,
      (Math.random() - 0.5) * 0.001,
      (Math.random() - 0.5) * 0.0008,
    ),
    drift: new THREE.Vector3(0, 0, 0),
    basePos: new THREE.Vector3(),
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

export default function NeuronCanvas() {
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

    // Pull camera back for very narrow viewports so neurons stay framed
    const updateCameraForAspect = () => {
      const aspect = camera.aspect;
      // We want at least ~10 units of horizontal field visible. fov is vertical;
      // horizontal half-angle = atan(aspect * tan(fov/2)).
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
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // transparent — gradient shows through
    container.appendChild(renderer.domElement);

    // Render-on-visibility: hidden tabs throttle rAF to 0, so repaint when shown.
    const onVisibility = () => {
      if (!document.hidden) renderer.render(scene, camera);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const neurons: Neuron[] = [];
    const NUM_NEURONS = 24;
    for (let i = 0; i < NUM_NEURONS; i++) {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const scale = 0.5 + Math.random() * 0.65;
      const n = buildNeuron(scale, color);

      // Distribute as a 3D dust cloud — works for any aspect ratio
      // Bias toward the visible cone in front of camera
      const aspect = camera.aspect;
      const xSpread = aspect > 1 ? 9 : aspect * 9;
      const ySpread = aspect > 1 ? 5 : 5 / aspect;
      const x = (Math.random() - 0.5) * xSpread * 2;
      const y = (Math.random() - 0.5) * ySpread * 2;
      const z = (Math.random() - 0.5) * 10 - 1;
      n.group.position.set(x, y, z);
      n.basePos.copy(n.group.position);
      n.group.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      scene.add(n.group);
      neurons.push(n);
    }

    // Mouse parallax
    const target = new THREE.Vector2(0, 0);
    const current = new THREE.Vector2(0, 0);
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

      for (const n of neurons) {
        n.group.rotation.x += n.spinSpeed.x;
        n.group.rotation.y += n.spinSpeed.y;
        n.group.rotation.z += n.spinSpeed.z;

        // children[0]=lines, [1]=soma, [2]=halo, [3]=tips
        const halo = n.group.children[2] as THREE.Mesh;
        const haloMat = halo.material as THREE.MeshBasicMaterial;
        haloMat.opacity = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.6 + n.pulsePhase));

        n.group.position.y = n.basePos.y + Math.sin(t * 0.15 + n.pulsePhase) * 0.3;
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      for (const n of neurons) {
        n.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m.dispose();
          }
        });
      }
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden />;
}
