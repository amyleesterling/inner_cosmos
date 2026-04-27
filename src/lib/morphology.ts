import * as THREE from "three";

export interface MorphologyConfig {
  numMainBranches: number;
  branchLength: number;
  branchDepth: number;
  curlAmount: number;       // 0..1 — wiggle along each branch
  bifurcationSpread: number; // 0..2 — how wide bifurcations spread
  verticalBias: number;      // -1..1 — pulls branches up or down
  somaSize: number;
  somaShape: "sphere" | "pyramid" | "ellipsoid";
  apicalDendrite?: { length: number; branches: number };
  axonBundle?: { count: number; length: number; spread: number };
}

export interface BuiltNeuron {
  group: THREE.Group;
  dispose: () => void;
}

const PRESETS: Record<string, MorphologyConfig> = {
  pyramidal: {
    numMainBranches: 5,
    branchLength: 1.1,
    branchDepth: 3,
    curlAmount: 0.18,
    bifurcationSpread: 1.0,
    verticalBias: -0.4, // basal dendrites go down
    somaSize: 0.16,
    somaShape: "pyramid",
    apicalDendrite: { length: 3.0, branches: 5 },
  },
  basket: {
    numMainBranches: 9,
    branchLength: 0.8,
    branchDepth: 4,
    curlAmount: 0.25,
    bifurcationSpread: 1.4,
    verticalBias: 0,
    somaSize: 0.16,
    somaShape: "sphere",
  },
  chandelier: {
    numMainBranches: 4,
    branchLength: 0.7,
    branchDepth: 2,
    curlAmount: 0.1,
    bifurcationSpread: 0.6,
    verticalBias: 0.2,
    somaSize: 0.13,
    somaShape: "ellipsoid",
    axonBundle: { count: 14, length: 2.4, spread: 1.4 },
  },
  martinotti: {
    numMainBranches: 3,
    branchLength: 1.4,
    branchDepth: 3,
    curlAmount: 0.2,
    bifurcationSpread: 0.8,
    verticalBias: 0.6, // axons climb upward
    somaSize: 0.14,
    somaShape: "ellipsoid",
  },
  stellate: {
    numMainBranches: 12,
    branchLength: 0.55,
    branchDepth: 2,
    curlAmount: 0.12,
    bifurcationSpread: 1.0,
    verticalBias: 0,
    somaSize: 0.13,
    somaShape: "sphere",
  },
  astrocyte: {
    numMainBranches: 18,
    branchLength: 0.4,
    branchDepth: 2,
    curlAmount: 0.45,
    bifurcationSpread: 1.6,
    verticalBias: 0,
    somaSize: 0.11,
    somaShape: "sphere",
  },
  generic: {
    numMainBranches: 6,
    branchLength: 1.6,
    branchDepth: 3,
    curlAmount: 0.18,
    bifurcationSpread: 1.1,
    verticalBias: 0,
    somaSize: 0.12,
    somaShape: "sphere",
  },
};

export function getPreset(name: string): MorphologyConfig {
  return PRESETS[name] ?? PRESETS.generic;
}

function grow(
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  depth: number,
  cfg: MorphologyConfig,
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
    curDir.x += (Math.random() - 0.5) * cfg.curlAmount;
    curDir.y += (Math.random() - 0.5) * cfg.curlAmount + cfg.verticalBias * 0.05;
    curDir.z += (Math.random() - 0.5) * cfg.curlAmount;
    curDir.normalize();
    const next = prev.clone().add(curDir.clone().multiplyScalar(length / steps));
    segments.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
    prev = next;
  }

  const children = depth > 2 ? 2 : Math.random() > 0.35 ? 2 : 1;
  for (let c = 0; c < children; c++) {
    const newDir = curDir.clone();
    const spread = cfg.bifurcationSpread;
    newDir.x += (Math.random() - 0.5) * spread;
    newDir.y += (Math.random() - 0.5) * spread + cfg.verticalBias * 0.3;
    newDir.z += (Math.random() - 0.5) * spread;
    newDir.normalize();
    grow(prev, newDir, length * (0.55 + Math.random() * 0.15), depth - 1, cfg, segments, tipPositions);
  }
}

function makeSomaGeometry(cfg: MorphologyConfig): THREE.BufferGeometry {
  switch (cfg.somaShape) {
    case "pyramid":
      return new THREE.ConeGeometry(cfg.somaSize * 0.95, cfg.somaSize * 1.7, 6);
    case "ellipsoid": {
      const g = new THREE.SphereGeometry(cfg.somaSize, 16, 16);
      g.scale(0.7, 1.2, 0.7);
      return g;
    }
    default:
      return new THREE.SphereGeometry(cfg.somaSize, 16, 16);
  }
}

export function buildMorphology(cfg: MorphologyConfig, color: THREE.Color): BuiltNeuron {
  const group = new THREE.Group();
  const segments: number[] = [];
  const tipPositions: THREE.Vector3[] = [];
  const soma = new THREE.Vector3(0, 0, 0);

  // Main branches distributed around soma — biased by verticalBias
  for (let i = 0; i < cfg.numMainBranches; i++) {
    const theta = (i / cfg.numMainBranches) * Math.PI * 2 + Math.random() * 0.4;
    const phi = (Math.random() - 0.5) * Math.PI * 0.7 - cfg.verticalBias * 0.6;
    const dir = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi),
    );
    grow(soma, dir, cfg.branchLength + Math.random() * 0.2, cfg.branchDepth, cfg, segments, tipPositions);
  }

  // Optional apical dendrite (pyramidal)
  if (cfg.apicalDendrite) {
    const apicalDir = new THREE.Vector3(0, 1, 0);
    const apicalEnd = soma.clone().add(apicalDir.clone().multiplyScalar(cfg.apicalDendrite.length));
    // Trunk segment
    const trunkSteps = 8;
    let prev = soma.clone();
    const trunkDir = apicalDir.clone();
    for (let s = 0; s < trunkSteps; s++) {
      trunkDir.x += (Math.random() - 0.5) * 0.05;
      trunkDir.z += (Math.random() - 0.5) * 0.05;
      trunkDir.normalize();
      const next = prev.clone().add(trunkDir.clone().multiplyScalar(cfg.apicalDendrite.length / trunkSteps));
      segments.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
      prev = next;
    }
    // Apical tuft branches at the top
    for (let b = 0; b < cfg.apicalDendrite.branches; b++) {
      const branchAngle = (b / cfg.apicalDendrite.branches) * Math.PI * 2;
      const dir = new THREE.Vector3(
        Math.cos(branchAngle) * 0.7,
        0.5,
        Math.sin(branchAngle) * 0.7,
      ).normalize();
      grow(apicalEnd, dir, cfg.branchLength * 0.9, 2, cfg, segments, tipPositions);
    }
  }

  // Optional axon bundle (chandelier — vertical hanging axons)
  if (cfg.axonBundle) {
    for (let i = 0; i < cfg.axonBundle.count; i++) {
      const offsetX = (Math.random() - 0.5) * cfg.axonBundle.spread;
      const offsetZ = (Math.random() - 0.5) * cfg.axonBundle.spread;
      const startY = -0.3;
      const endY = -cfg.axonBundle.length;
      // Vertical axon line
      const subSteps = 5;
      let prev = new THREE.Vector3(offsetX, startY, offsetZ);
      for (let s = 0; s < subSteps; s++) {
        const next = new THREE.Vector3(
          offsetX + (Math.random() - 0.5) * 0.05,
          startY + (endY - startY) * ((s + 1) / subSteps),
          offsetZ + (Math.random() - 0.5) * 0.05,
        );
        segments.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
        prev = next;
      }
      tipPositions.push(prev);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, lineMaterial);
  group.add(lines);

  const somaMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const somaGeo = makeSomaGeometry(cfg);
  const somaMesh = new THREE.Mesh(somaGeo, somaMat);
  group.add(somaMesh);

  const haloMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.somaSize * 2.4, 16, 16), haloMat);
  group.add(haloMesh);

  const tipPositionsFlat: number[] = [];
  for (const t of tipPositions) tipPositionsFlat.push(t.x, t.y, t.z);
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute("position", new THREE.Float32BufferAttribute(tipPositionsFlat, 3));
  const tipMat = new THREE.PointsMaterial({
    color,
    size: 0.075,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const tips = new THREE.Points(tipGeo, tipMat);
  group.add(tips);

  return {
    group,
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
    },
  };
}
