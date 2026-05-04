// Extract a real MICrONS pyramidal cell from a GLB mesh and emit it as a
// pointillist SVG hero. The script:
//   1. Parses a GLB (12-byte header → JSON chunk → BIN chunk).
//   2. Reads the POSITION accessor of the first mesh primitive.
//   3. Samples ~3000 vertices uniformly across the mesh.
//   4. Computes the principal-axis angle of the projected (X, Y) cloud and
//      rotates so the long axis is vertical — keeps the apical dendrite
//      pointing up regardless of how the mesh was stored.
//   5. Normalises into a 600×600 viewBox.
//   6. Emits each sampled vertex as a tiny circle, written to
//      src/realNeuron.ts as an inline SVG string.
//
// Run from explore-the-universe/:
//   node scripts/extract-neuron-svg.mjs [cellId]
// Default cellId is 864691135335733481 (the largest mesh in the activity
// set — a well-reconstructed pyramidal neuron).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cellId = process.argv[2] || "864691135335733481";
const glbPath = path.resolve(__dirname, `../../public/meshes/activity/${cellId}.glb`);
const outPath = path.resolve(__dirname, `../src/realNeuron.ts`);

if (!fs.existsSync(glbPath)) {
  console.error(`GLB not found: ${glbPath}`);
  process.exit(1);
}

const buf = fs.readFileSync(glbPath);
console.log(`Reading ${glbPath} (${(buf.length / 1024).toFixed(1)} KB)`);

// ─── Parse GLB ────────────────────────────────────────────────────────────

if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("Not a GLB (bad magic)");
const version = buf.readUInt32LE(4);
if (version !== 2) throw new Error(`Unsupported GLB version: ${version}`);

let p = 12;
// Chunk 0: JSON
const jsonLen = buf.readUInt32LE(p); p += 4;
const jsonType = buf.toString("ascii", p, p + 4); p += 4;
if (jsonType !== "JSON") throw new Error(`Expected JSON chunk, got ${jsonType}`);
const gltf = JSON.parse(buf.toString("utf8", p, p + jsonLen));
p += jsonLen;

// Chunk 1: BIN
const binLen = buf.readUInt32LE(p); p += 4;
const binType = buf.toString("ascii", p, p + 4); p += 4;
if (!binType.startsWith("BIN")) throw new Error(`Expected BIN chunk, got ${binType}`);
const binStart = p;

// ─── Read POSITION accessor ───────────────────────────────────────────────

const mesh = gltf.meshes[0];
const prim = mesh.primitives[0];
const accessor = gltf.accessors[prim.attributes.POSITION];
const view = gltf.bufferViews[accessor.bufferView];
if (accessor.type !== "VEC3") throw new Error(`Unexpected accessor type: ${accessor.type}`);
if (accessor.componentType !== 5126) throw new Error(`Expected Float32 (5126), got ${accessor.componentType}`);

const offset = binStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
const count = accessor.count;
const positions = new Float32Array(buf.buffer.slice(buf.byteOffset + offset, buf.byteOffset + offset + count * 12));
console.log(`Mesh has ${count.toLocaleString()} vertices`);

// ─── Sample vertices ──────────────────────────────────────────────────────

const TARGET = 3000;
const stride = Math.max(1, Math.floor(count / TARGET));
const sampled = [];
for (let i = 0; i < count; i += stride) {
  sampled.push({
    x: positions[i * 3 + 0],
    y: positions[i * 3 + 1],
    z: positions[i * 3 + 2],
  });
}
console.log(`Sampled ${sampled.length} vertices (stride ${stride})`);

// ─── Project to XY (drop Z), recover an upright orientation via PCA ──────
//
// MICrONS data is stored in voxel space; the mesh is roughly upright but its
// "up" can be any axis depending on extraction. We project to (X, Y) then
// rotate so the largest direction of variance points vertically. This is
// the closed-form 2D PCA: build the covariance, take the eigenvector of
// the larger eigenvalue, and rotate so it aligns with the −Y axis (screen-
// up).

let sumX = 0, sumY = 0;
for (const v of sampled) { sumX += v.x; sumY += v.y; }
const mx = sumX / sampled.length;
const my = sumY / sampled.length;

let Sxx = 0, Syy = 0, Sxy = 0;
for (const v of sampled) {
  const dx = v.x - mx;
  const dy = v.y - my;
  Sxx += dx * dx;
  Syy += dy * dy;
  Sxy += dx * dy;
}

// Angle of the principal axis (in (X, Y) plane), measured from +X.
const principalAngle = 0.5 * Math.atan2(2 * Sxy, Sxx - Syy);
// We want this axis to align with screen-up (−Y on screen, but in pre-flip
// coords that's +Y because we'll flip Y for SVG below). So rotate by
// (π/2 − principalAngle).
const rot = Math.PI / 2 - principalAngle;
const cos = Math.cos(rot);
const sin = Math.sin(rot);

const rotated = sampled.map((v) => ({
  x: (v.x - mx) * cos - (v.y - my) * sin,
  y: (v.x - mx) * sin + (v.y - my) * cos,
}));

// ─── Normalise into viewBox 0..600 ────────────────────────────────────────

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const v of rotated) {
  if (v.x < minX) minX = v.x;
  if (v.y < minY) minY = v.y;
  if (v.x > maxX) maxX = v.x;
  if (v.y > maxY) maxY = v.y;
}
const w = maxX - minX;
const h = maxY - minY;
console.log(`Post-rotate bbox: ${w.toFixed(0)} × ${h.toFixed(0)} (h/w = ${(h / w).toFixed(2)})`);

// Use 460 of the 600 viewBox for the mesh — leaves a margin so the glow
// doesn't clip when the hero scales up during transitions.
const fit = 460 / Math.max(w, h);
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;

const dots = rotated.map((v) => {
  const sx = (v.x - cx) * fit + 300;
  // Flip Y so the principal axis (which we rotated to +Y in pre-flip coords)
  // points UP on screen.
  const sy = -(v.y - cy) * fit + 300;
  return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="0.85"/>`;
}).join("");

// ─── Emit SVG ─────────────────────────────────────────────────────────────

const svg = `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" class="hero-svg" data-id="neuron-real">
  <defs>
    <filter id="glow-real" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="halo-real" cx="0.5" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="white" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="white" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="600" height="600" fill="url(#halo-real)" opacity="0.6"/>
  <g filter="url(#glow-real)" fill="#b78bff" fill-opacity="0.55">${dots}</g>
</svg>`;

const out = `// Auto-generated from MICrONS pyramidal cell ${cellId}
// (gs://iarpa_microns/minnie/minnie65/seg_m1300/${cellId}).
// Regenerate with: node scripts/extract-neuron-svg.mjs ${cellId}
// Sampled ${sampled.length} of ${count.toLocaleString()} vertices, projected
// to XY, principal axis aligned vertically.

export const REAL_NEURON_CELL_ID = "${cellId}";
export const REAL_NEURON_SVG = ${JSON.stringify(svg)};
`;

fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${(svg.length / 1024).toFixed(1)} KB SVG, ${sampled.length} dots)`);
