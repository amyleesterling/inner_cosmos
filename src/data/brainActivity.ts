/** Brain activity dataset produced by scripts/extract-fmri-activity.py.
 *
 *  The cortex mesh is rendered with a per-vertex parcel-id attribute. Each
 *  frame, the shader looks up its parcel's BOLD activity in a small uniform
 *  array, so we only ship parcel-level time series (≪ per-vertex). */

const BASE = import.meta.env.BASE_URL;

export interface BrainActivityManifest {
  schema: string;
  dataset: {
    name: string;
    openneuroId: string;
    doi: string;
    license: string;
    citation: string;
  };
  subject: string;
  task: string;
  movie: string;
  fileSourceUrl: string;
  preprocessingNotes: string;
  parcels: number;
  frames: number;
  trSeconds: number;
  durationSeconds: number;
  vertexCount: number;
  valueRange: string;
  fmriVoxelsTouched: number;
  fmriVoxelsInBrain: number;
}

export interface BrainActivityData {
  parcels: number;
  frames: number;
  trSeconds: number;
  vertexCount: number;
  /** Per-vertex parcel id (uint16). Values in [0, parcels) point at a real
   *  parcel; value === parcels is the "no signal" sentinel for vertices that
   *  fell outside the brain mask in the source fMRI volume. */
  parcelIds: Uint16Array;
  /** Frame-major activity, uint8 per (frame, parcel). 128 ≈ baseline (z=0);
   *  0..255 maps linearly onto z-score range [-3, +3]. */
  activity: Uint8Array;
}

export class BrainActivityMissingError extends Error {
  constructor() {
    super("brain-activity dataset not extracted");
  }
}

export async function loadBrainActivityManifest(): Promise<BrainActivityManifest> {
  const r = await fetch(`${BASE}data/brain-activity.json`);
  if (r.status === 404) throw new BrainActivityMissingError();
  if (!r.ok) throw new Error(`brain-activity.json: ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) throw new BrainActivityMissingError();
  return r.json();
}

export async function loadBrainActivity(): Promise<BrainActivityData> {
  const r = await fetch(`${BASE}data/brain-activity.bin`);
  if (r.status === 404) throw new BrainActivityMissingError();
  if (!r.ok) throw new Error(`brain-activity.bin: ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) throw new BrainActivityMissingError();
  const buf = await r.arrayBuffer();
  const dv = new DataView(buf);
  // Header layout (32 bytes):
  //   "FMRI" magic (4) | version u32 | parcels u32 | frames u32 |
  //   tr_seconds f32 | verts u32 | reserved u32 | reserved u32
  const magic = String.fromCharCode(
    dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3),
  );
  if (magic !== "FMRI") throw new Error(`bad magic ${magic}`);
  const parcels = dv.getUint32(8, true);
  const frames = dv.getUint32(12, true);
  const trSeconds = dv.getFloat32(16, true);
  const vertexCount = dv.getUint32(20, true);

  const HEADER = 32;
  const parcelIdBytes = vertexCount * 2;
  const parcelIds = new Uint16Array(buf, HEADER, vertexCount);
  const activity = new Uint8Array(buf, HEADER + parcelIdBytes, parcels * frames);
  return { parcels, frames, trSeconds, vertexCount, parcelIds, activity };
}
