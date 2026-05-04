// Museum-piece SVG illustrations, one per stop. All share a 600×600 viewBox
// so the centred origin is identical and the cross-fade between them feels
// like a single object morphing rather than swapping. Each hero is drawn at
// a soft, glowing-line weight; colours are constrained to the four glow
// accents so the whole journey feels like one palette.
//
// Each renderer returns an SVG string. The page injects them once, then the
// scroll handler animates transform/opacity on the wrapper — never on the
// SVG internals — so animation stays cheap.

import { STOPS, type Stop } from "./stops";

const C = {
  cyan: "#7ee0ff",
  violet: "#b78bff",
  warm: "#ffd9a8",
  magenta: "#ff7ee0",
  white: "#ffffff",
};

/** Shared filter defs — softens line-art into something planetarium-grade. */
function defs(idSuffix: string): string {
  return `
    <defs>
      <filter id="glow-${idSuffix}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient id="halo-${idSuffix}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="white" stop-opacity="0.55" />
        <stop offset="60%" stop-color="white" stop-opacity="0.05" />
        <stop offset="100%" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
  `;
}

function svg(id: string, body: string, extra = ""): string {
  return `
    <svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" class="hero-svg" data-id="${id}" ${extra}>
      ${defs(id)}
      ${body}
    </svg>
  `;
}

// ─── Molecule ─────────────────────────────────────────────────────────────
// A small organic-feeling cluster: a central atom with five neighbours,
// bonds drawn as soft lines. Mimics a glucose-ish silhouette without being
// any specific molecule.
function molecule(): string {
  const atoms: { x: number; y: number; r: number; c: string }[] = [
    { x: 300, y: 300, r: 28, c: C.warm },
    { x: 220, y: 240, r: 22, c: C.cyan },
    { x: 380, y: 240, r: 22, c: C.cyan },
    { x: 200, y: 360, r: 22, c: C.cyan },
    { x: 380, y: 380, r: 22, c: C.cyan },
    { x: 300, y: 180, r: 18, c: C.white },
    { x: 300, y: 420, r: 18, c: C.white },
  ];
  const bonds: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 5], [2, 5],
  ];
  const bondLines = bonds
    .map(([a, b]) => {
      const A = atoms[a], B = atoms[b];
      return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="white" stroke-opacity="0.35" stroke-width="2" />`;
    })
    .join("");
  const atomDots = atoms
    .map(
      (a) =>
        `<circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${a.c}" fill-opacity="0.85" />`,
    )
    .join("");
  return svg(
    "molecule",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-molecule)" opacity="0.6" />
      <g filter="url(#glow-molecule)">
        ${bondLines}
        ${atomDots}
      </g>
    `,
  );
}

// ─── Synapse ───────────────────────────────────────────────────────────────
// Cross-section: a presynaptic bouton above, a synaptic cleft, a post-
// synaptic membrane with receptor pockets below. Vesicles inside the bouton
// are drawn as small circles; neurotransmitters in the cleft are tiny dots.
function synapse(): string {
  // Vesicles (small circles) inside the upper bouton.
  const vesicles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = 38 + (i % 3) * 12;
    const cx = 300 + Math.cos(angle) * r;
    const cy = 200 + Math.sin(angle) * r * 0.7;
    return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${C.magenta}" stroke-opacity="0.55" stroke-width="1.5" />`;
  }).join("");

  // Neurotransmitters crossing the cleft.
  const ntx = [240, 270, 300, 330, 360].map((x, i) => {
    const y = 320 + (i % 2 === 0 ? 0 : 12);
    return `<circle cx="${x}" cy="${y}" r="4" fill="${C.magenta}" />`;
  }).join("");

  // Receptor pockets (downward-opening arches) on the postsynaptic membrane.
  const receptors = [220, 270, 320, 370].map((x) => {
    return `<path d="M ${x - 14} 410 q 14 -28 28 0" stroke="${C.cyan}" stroke-width="3" fill="none" stroke-linecap="round" />`;
  }).join("");

  return svg(
    "synapse",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-synapse)" opacity="0.55" />
      <g filter="url(#glow-synapse)">
        <!-- Presynaptic bouton outline -->
        <path d="M 170 280 q 0 -180 130 -180 q 130 0 130 180 q 0 30 -10 50 l -240 0 q -10 -20 -10 -50 z"
              fill="none" stroke="${C.cyan}" stroke-opacity="0.5" stroke-width="2.5" />
        ${vesicles}
        ${ntx}
        <!-- Postsynaptic membrane -->
        <line x1="120" y1="410" x2="480" y2="410" stroke="${C.cyan}" stroke-opacity="0.6" stroke-width="2.5" />
        ${receptors}
      </g>
    `,
  );
}

// ─── Pyramidal neuron ─────────────────────────────────────────────────────
// Apical dendrite reaches up and branches; soma is a small triangle; basal
// dendrites spread sideways and downward; a thin axon descends.
function neuron(): string {
  // Seeded LCG so the silhouette is stable across loads.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const branches: string[] = [];
  function branch(x: number, y: number, angle: number, length: number, depth: number) {
    if (depth === 0 || length < 14) return;
    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    const w = Math.max(0.7, depth * 0.7);
    branches.push(
      `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${C.violet}" stroke-opacity="${0.45 + depth * 0.08}" stroke-width="${w}" stroke-linecap="round" />`,
    );
    const split = 0.55 + rand() * 0.25;
    branch(x2, y2, angle - 0.35 - rand() * 0.2, length * split, depth - 1);
    branch(x2, y2, angle + 0.35 + rand() * 0.2, length * split, depth - 1);
  }

  // Apical (up) trunk + arbor
  branch(300, 360, -Math.PI / 2, 80, 5);
  // Basal dendrites
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 + (i - 1.5) * 0.5;
    branch(300, 380, a, 50, 3);
  }
  // Axon — single thin descent
  branches.push(
    `<path d="M 300 384 q -10 60 6 110 q -8 50 4 80" stroke="${C.violet}" stroke-opacity="0.35" stroke-width="1.2" fill="none" />`,
  );

  return svg(
    "neuron",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-neuron)" opacity="0.55" />
      <g filter="url(#glow-neuron)">
        ${branches.join("\n")}
        <!-- Soma — pyramidal triangle, glowing -->
        <path d="M 300 350 l -22 38 l 44 0 z" fill="${C.violet}" fill-opacity="0.9" />
      </g>
    `,
  );
}

// ─── Human ─────────────────────────────────────────────────────────────────
// Standing silhouette in profile, head slightly raised — simple and warm.
function human(): string {
  return svg(
    "human",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-human)" opacity="0.55" />
      <g filter="url(#glow-human)" fill="${C.warm}" fill-opacity="0.92">
        <!-- Head -->
        <circle cx="300" cy="195" r="34" />
        <!-- Neck -->
        <rect x="290" y="225" width="20" height="18" />
        <!-- Torso -->
        <path d="M 254 248 q 46 -16 92 0 l -8 130 l -76 0 z" />
        <!-- Arms -->
        <path d="M 252 252 q -30 60 -22 130 l 14 0 q -2 -68 24 -120 z" />
        <path d="M 348 252 q 30 60 22 130 l -14 0 q 2 -68 -24 -120 z" />
        <!-- Legs -->
        <path d="M 268 378 l -10 130 l 22 0 l 14 -120 z" />
        <path d="M 332 378 l 10 130 l -22 0 l -14 -120 z" />
      </g>
    `,
  );
}

// ─── Earth ─────────────────────────────────────────────────────────────────
// Sphere with a hint of continents and a soft atmospheric halo.
function earth(): string {
  return svg(
    "earth",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-earth)" opacity="0.7" />
      <g filter="url(#glow-earth)">
        <!-- Atmosphere -->
        <circle cx="300" cy="300" r="190" fill="none" stroke="${C.cyan}" stroke-opacity="0.25" stroke-width="14" />
        <!-- Ocean -->
        <circle cx="300" cy="300" r="160" fill="${C.cyan}" fill-opacity="0.55" />
        <!-- Subtle land masses, abstract -->
        <g fill="${C.warm}" fill-opacity="0.55">
          <path d="M 230 240 q 30 -10 60 5 q 20 30 -10 50 q -40 -5 -55 -25 z" />
          <path d="M 320 220 q 40 5 50 35 q -10 25 -40 20 q -25 -20 -10 -55 z" />
          <path d="M 250 360 q 50 -20 90 0 q 30 35 -5 60 q -55 5 -85 -20 z" />
          <path d="M 360 320 q 25 5 30 30 q -15 20 -35 5 z" />
        </g>
        <!-- Specular highlight -->
        <ellipse cx="245" cy="245" rx="50" ry="30" fill="white" fill-opacity="0.18" />
      </g>
    `,
  );
}

// ─── Solar system ─────────────────────────────────────────────────────────
// Concentric thin orbital rings with a glowing sun and a few planet dots.
function solar(): string {
  const orbits = [70, 100, 135, 165, 215, 255, 290];
  const planets: { r: number; size: number; angle: number; color: string }[] = [
    { r: 70, size: 3, angle: 0.4, color: C.warm },
    { r: 100, size: 5, angle: 1.8, color: C.warm },
    { r: 135, size: 6, angle: 3.2, color: C.cyan },
    { r: 165, size: 4, angle: 5.0, color: C.magenta },
    { r: 215, size: 14, angle: 0.9, color: C.warm },
    { r: 255, size: 11, angle: 2.6, color: C.warm },
    { r: 290, size: 7, angle: 4.4, color: C.cyan },
  ];
  const rings = orbits
    .map(
      (r) =>
        `<circle cx="300" cy="300" r="${r}" fill="none" stroke="${C.violet}" stroke-opacity="0.22" stroke-width="1" />`,
    )
    .join("");
  const dots = planets
    .map((p) => {
      const x = 300 + Math.cos(p.angle) * p.r;
      const y = 300 + Math.sin(p.angle) * p.r;
      return `<circle cx="${x}" cy="${y}" r="${p.size}" fill="${p.color}" />`;
    })
    .join("");
  return svg(
    "solar",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-solar)" opacity="0.55" />
      <g filter="url(#glow-solar)">
        ${rings}
        ${dots}
        <!-- Sun -->
        <circle cx="300" cy="300" r="18" fill="${C.warm}" />
        <circle cx="300" cy="300" r="34" fill="${C.warm}" fill-opacity="0.25" />
      </g>
    `,
  );
}

// ─── Milky Way ────────────────────────────────────────────────────────────
// Logarithmic-spiral arms drawn as a cloud of dots, with a brighter central
// bulge. Two arms, each rotated 180°.
function galaxy(): string {
  let seed = 9001;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const dots: string[] = [];
  const arms = 2;
  const turns = 1.2;
  const pointsPerArm = 220;
  for (let arm = 0; arm < arms; arm++) {
    const armOffset = (arm / arms) * Math.PI * 2;
    for (let i = 0; i < pointsPerArm; i++) {
      const t = i / pointsPerArm;
      const r = 40 + t * 230;
      const angle = armOffset + t * turns * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const x = 300 + Math.cos(angle) * r + (rand() - 0.5) * 20;
      const y = 300 + Math.sin(angle) * r + (rand() - 0.5) * 20;
      const size = 0.8 + rand() * 1.6;
      const c = i % 11 === 0 ? C.magenta : i % 7 === 0 ? C.cyan : C.white;
      const op = 0.35 + rand() * 0.55;
      dots.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(2)}" fill="${c}" fill-opacity="${op.toFixed(2)}" />`,
      );
    }
  }
  return svg(
    "galaxy",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-galaxy)" opacity="0.55" />
      <!-- Central bulge -->
      <circle cx="300" cy="300" r="55" fill="${C.warm}" fill-opacity="0.18" />
      <circle cx="300" cy="300" r="28" fill="${C.warm}" fill-opacity="0.5" />
      <g>${dots.join("")}</g>
    `,
  );
}

// ─── Cosmic web ───────────────────────────────────────────────────────────
// A network of nodes (galaxy clusters) connected by faint filaments. Nodes
// are placed pseudo-randomly; each node connects to its 2-3 nearest
// neighbours. Brighter knots at higher-degree intersections.
function web(): string {
  let seed = 314159;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const N = 28;
  const nodes: { x: number; y: number; degree: number }[] = [];
  for (let i = 0; i < N; i++) {
    nodes.push({
      x: 80 + rand() * 440,
      y: 80 + rand() * 440,
      degree: 0,
    });
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    // Pick the 2 nearest neighbours.
    const dists = nodes
      .map((n, j) => ({ j, d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 }))
      .filter((p) => p.j !== i)
      .sort((a, b) => a.d - b.d);
    for (let k = 0; k < 2; k++) {
      const j = dists[k].j;
      const key: [number, number] = i < j ? [i, j] : [j, i];
      if (!edges.find((e) => e[0] === key[0] && e[1] === key[1])) {
        edges.push(key);
        nodes[i].degree++;
        nodes[j].degree++;
      }
    }
  }
  const lines = edges
    .map(([a, b]) => {
      const A = nodes[a], B = nodes[b];
      return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="${C.violet}" stroke-opacity="0.35" stroke-width="0.8" />`;
    })
    .join("");
  const dots = nodes
    .map((n) => {
      const r = 1.5 + n.degree * 0.9;
      const op = 0.4 + Math.min(0.5, n.degree * 0.1);
      const c = n.degree >= 4 ? C.warm : n.degree >= 3 ? C.cyan : C.white;
      return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" fill-opacity="${op.toFixed(2)}" />`;
    })
    .join("");
  return svg(
    "web",
    `
      <rect x="0" y="0" width="600" height="600" fill="url(#halo-web)" opacity="0.4" />
      <g filter="url(#glow-web)">
        ${lines}
        ${dots}
      </g>
    `,
  );
}

const RENDERERS: Record<string, () => string> = {
  molecule,
  synapse,
  neuron,
  human,
  earth,
  solar,
  galaxy,
  web,
};

export function renderHero(stop: Stop): string {
  const fn = RENDERERS[stop.id];
  if (!fn) throw new Error(`No hero renderer for stop: ${stop.id}`);
  return fn();
}

export function allHeroes(): { stop: Stop; svg: string }[] {
  return STOPS.map((stop) => ({ stop, svg: renderHero(stop) }));
}
