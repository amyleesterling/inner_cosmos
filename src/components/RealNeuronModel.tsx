import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Props {
  meshUrl: string;
  color: string;
  className?: string;
  cameraDistance?: number;
  spinSpeed?: number;
  /** Whether to add a soft white rim light (default true) */
  rim?: boolean;
  /** Allow user to drag to rotate and scroll to zoom (default true) */
  interactive?: boolean;
}

// Tiny shared GLTFLoader — one instance per page is fine, three handles it.
const sharedLoader = new GLTFLoader();

export default function RealNeuronModel({
  meshUrl,
  color,
  className,
  cameraDistance = 2.6,
  spinSpeed = 0.18,
  rim = true,
  interactive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
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

    // OrbitControls — drag to rotate, scroll to zoom. Auto-rotate continues
    // when the user isn't interacting; touching the canvas pauses it.
    const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.autoRotate = spinSpeed > 0;
      // OrbitControls.autoRotateSpeed is in "rotations per ~6s" units; scale
      // spinSpeed (rad/s) so the visual cadence matches the previous model
      // self-rotation.
      controls.autoRotateSpeed = spinSpeed * 9.5;
      controls.minDistance = cameraDistance * 0.35;
      controls.maxDistance = cameraDistance * 4;
      // Pause auto-rotate while the user is dragging or scrolling, then resume.
      const stopAuto = () => { controls.autoRotate = false; };
      const resumeAuto = () => { controls.autoRotate = spinSpeed > 0; };
      renderer.domElement.addEventListener("pointerdown", stopAuto);
      renderer.domElement.addEventListener("pointerup", resumeAuto);
      renderer.domElement.addEventListener("pointercancel", resumeAuto);
      renderer.domElement.addEventListener("wheel", () => {
        stopAuto();
        clearTimeout((renderer.domElement as any).__resumeTimer);
        (renderer.domElement as any).__resumeTimer = setTimeout(resumeAuto, 1500);
      }, { passive: true });
      // The container needs pointer-events to receive input — the wrapper has
      // aria-hidden but that doesn't disable events. The canvas inherits.
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.addEventListener("pointerdown", () => {
        renderer.domElement.style.cursor = "grabbing";
      });
      renderer.domElement.addEventListener("pointerup", () => {
        renderer.domElement.style.cursor = "grab";
      });
    }

    // Lights — premium key/fill setup
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color(color), 0.35);
    fill.position.set(-3, 1, -2);
    scene.add(fill);
    let rimLight: THREE.DirectionalLight | null = null;
    if (rim) {
      rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
      rimLight.position.set(0, -2, -5);
      scene.add(rimLight);
    }

    let cellGroup: THREE.Group | null = null;
    let frameId = 0;
    let cancelled = false;

    sharedLoader.load(
      meshUrl,
      (gltf) => {
        if (cancelled) return;
        cellGroup = new THREE.Group();
        const cellColor = new THREE.Color(color);

        // Re-center via bounding box (more visually balanced than vertex mean)
        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Collect original meshes BEFORE mutating the tree (otherwise traverse
        // walks the wireframe children we add and recurses forever).
        const sourceMeshes: THREE.Mesh[] = [];
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) sourceMeshes.push(obj);
        });

        for (const obj of sourceMeshes) {
          obj.geometry.translate(-center.x, -center.y, -center.z);

          const mainMat = new THREE.MeshStandardMaterial({
            color: cellColor,
            emissive: cellColor.clone().multiplyScalar(0.2),
            metalness: 0.15,
            roughness: 0.55,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            flatShading: false,
          });
          obj.material = mainMat;

          // Faint wireframe overlay for that "we mapped every branch" feel
          const wireMat = new THREE.MeshBasicMaterial({
            color: cellColor,
            wireframe: true,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const wireMesh = new THREE.Mesh(obj.geometry, wireMat);
          obj.add(wireMesh);

          cellGroup!.add(obj);
        }

        // Tilt slightly so we read 3D depth from the start
        cellGroup.rotation.x = -0.08;

        scene.add(cellGroup);
        setLoaded(true);
      },
      undefined,
      (err) => {
        console.error("Failed to load mesh", meshUrl, err);
      },
    );

    const animate = () => {
      // When OrbitControls handles motion, let it own the rotation so user
      // drags don't fight a manually-rotated cellGroup. Without controls,
      // fall back to spinning the model directly.
      if (controls) {
        controls.update();
      } else if (cellGroup) {
        const t = performance.now() / 1000;
        cellGroup.rotation.y = t * spinSpeed;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls?.dispose();
      if (cellGroup) {
        cellGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m.dispose();
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [meshUrl, color, cameraDistance, spinSpeed, rim, interactive]);

  // No aria-hidden — the canvas is interactive and should receive events.
  return (
    <div ref={containerRef} className={className}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-2 h-2 rounded-full opacity-60 animate-pulse"
            style={{ background: color, boxShadow: `0 0 16px ${color}` }}
          />
        </div>
      )}
    </div>
  );
}
