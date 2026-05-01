/** Static schema for the /activity dataset produced by
 *  scripts/extract-functional-cells.py. */
export interface ActivityCell {
  /** v1300 segment ID — also the GLB filename (without extension). */
  segId: string;
  /** Imaging field this cell came from: 2 (≈L2/3), 4 (≈L4), 6 (≈L5). */
  field: 2 | 4 | 6;
  /** Scene-unit position relative to the swarm centroid (already baked into
   *  the GLB vertices, but useful for camera framing + UI labels). */
  world: [number, number, number];
  /** Soma point in MICrONS minnie65 nanometres. */
  somaNm: [number, number, number];
  faces?: number;
  kb?: number;
}

export interface ActivityManifest {
  fps: number;
  frames: number;
  seconds: number;
  centroidNm: [number, number, number];
  cells: ActivityCell[];
}

/** Decoded contents of public/data/activity-traces.bin.
 *  Frames are stored frame-major: traces[frame * cellCount + cell]. */
export interface ActivityTraces {
  fps: number;
  frames: number;
  cells: number;
  /** Length === frames * cells. Values clipped to [0, 1] per cell during extraction. */
  data: Float32Array;
}

const BASE = import.meta.env.BASE_URL;

/** Sentinel thrown when the data files don't exist. The Vite dev server falls
 *  back to serving index.html for any unknown route, so we also have to treat
 *  "got HTML where JSON was expected" as missing. */
export class ActivityDataMissingError extends Error {
  constructor() { super("activity dataset not extracted"); }
}

export async function loadActivityManifest(): Promise<ActivityManifest> {
  const r = await fetch(`${BASE}data/activity-manifest.json`);
  if (r.status === 404) throw new ActivityDataMissingError();
  if (!r.ok) throw new Error(`activity-manifest.json: ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) throw new ActivityDataMissingError();
  return r.json();
}

export async function loadActivityTraces(): Promise<ActivityTraces> {
  const r = await fetch(`${BASE}data/activity-traces.bin`);
  if (r.status === 404) throw new ActivityDataMissingError();
  if (!r.ok) throw new Error(`activity-traces.bin: ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) throw new ActivityDataMissingError();
  const buf = await r.arrayBuffer();
  // Header: u32 cells, u32 frames, f32 fps, then float32 frame-major.
  const dv = new DataView(buf);
  const cells = dv.getUint32(0, true);
  const frames = dv.getUint32(4, true);
  const fps = dv.getFloat32(8, true);
  const data = new Float32Array(buf, 12, cells * frames);
  return { fps, frames, cells, data };
}

export function meshUrl(cell: ActivityCell): string {
  return `${BASE}meshes/activity/${cell.segId}.glb`;
}

/** Cell color by imaging field — cooler at the top of cortex, warmer deeper.
 *  This mirrors the project's existing pyramidal palette (Crown / Dust Star /
 *  Lightning Tree) but tints by layer for visual depth. */
export function colorForField(field: number): string {
  if (field === 2) return "#8edaff";   // L2/3 — sky blue (matches Crown)
  if (field === 4) return "#aab8ff";   // L4 — soft indigo
  return "#ffc88a";                     // L5 — warm amber (matches Lightning Tree's deeper cousin)
}
