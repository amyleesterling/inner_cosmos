// Scan all activity meshes, compute the post-PCA-rotate height/width of
// each cell's vertex cloud, and rank them. The cell with the highest
// h/w ratio is the most "pyramidal-looking" — apical dendrite stretching
// far above a tighter basal arbor.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../../public/meshes/activity");

function bboxRatio(glbPath) {
  const buf = fs.readFileSync(glbPath);
  if (buf.readUInt32LE(0) !== 0x46546c67) return null;
  let p = 12;
  const jsonLen = buf.readUInt32LE(p); p += 8;
  const gltf = JSON.parse(buf.toString("utf8", p, p + jsonLen)); p += jsonLen;
  const binLen = buf.readUInt32LE(p); p += 8;
  const binStart = p;
  const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = binStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const positions = new Float32Array(buf.buffer.slice(buf.byteOffset + offset, buf.byteOffset + offset + accessor.count * 12));

  // Sample
  const N = Math.min(2000, accessor.count);
  const stride = Math.max(1, Math.floor(accessor.count / N));
  const pts = [];
  for (let i = 0; i < accessor.count; i += stride) {
    pts.push({ x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2] });
  }

  // 3D bbox first — pick the projection plane (XY, XZ, or YZ) with the
  // tallest axis among the two kept.
  let mins = [Infinity, Infinity, Infinity];
  let maxs = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    const v = [p.x, p.y, p.z];
    for (let i = 0; i < 3; i++) {
      if (v[i] < mins[i]) mins[i] = v[i];
      if (v[i] > maxs[i]) maxs[i] = v[i];
    }
  }
  const ext = maxs.map((m, i) => m - mins[i]);
  // Long axis = index of max extent
  const long = ext.indexOf(Math.max(...ext));
  const others = [0, 1, 2].filter((i) => i !== long);
  // h/w ratio = long axis / max of the two other axes
  return {
    longAxis: ["X", "Y", "Z"][long],
    longLen: ext[long],
    aspect: ext[long] / Math.max(ext[others[0]], ext[others[1]]),
    extents: ext,
    vertCount: accessor.count,
  };
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".glb"));
const results = [];
for (const f of files) {
  try {
    const r = bboxRatio(path.join(dir, f));
    if (r) results.push({ id: f.replace(".glb", ""), ...r });
  } catch (e) {
    // skip bad meshes
  }
}

results.sort((a, b) => b.aspect - a.aspect);

console.log("Top 10 most pyramidal-shaped cells (highest aspect ratio):");
console.log("aspect  long   verts    cellId");
for (const r of results.slice(0, 10)) {
  console.log(
    `${r.aspect.toFixed(2).padStart(5)}   ${r.longAxis}   ${String(r.vertCount).padStart(6)}   ${r.id}`,
  );
}
