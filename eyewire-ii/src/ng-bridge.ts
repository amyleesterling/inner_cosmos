/**
 * Read Neuroglancer view state from a hosted iframe.
 *
 * Phase 0: parse the URL hash. Cheap, works for any NG instance, but only
 * reflects state at the moment the URL was last updated by NG (typically
 * after camera changes settle).
 *
 * Phase 2 plan: switch to either
 *   (a) cross-frame `postMessage` using NG's python-integration channel, or
 *   (b) self-host the NG bundle and import its viewer object directly so
 *       we can subscribe to `viewer.display.changed.add(...)` for instant
 *       per-frame updates.
 * See README.md "Open questions — NG embed surface".
 */

export interface NgViewState {
  /** Centre of the current view, in voxel coords of the volume's native dims. */
  position: [number, number, number];
  /** NG's `crossSectionScale` — sets the in-plane zoom for orthogonal slices. */
  crossSectionScale: number;
  /** NG's `projectionScale` — sets the camera distance in 3D mode. */
  projectionScale: number;
  /** Quaternion [x, y, z, w] for the projection (3D) view, if present. */
  projectionOrientation?: [number, number, number, number];
  /** Layout: "xy" | "yz" | "xz" | "3d" | "4panel" — Phase 2 will branch on this. */
  layout: string;
  /** Voxel size [x, y, z] in metres, parsed from the `dimensions` field. */
  dimensions: [number, number, number];
  /** Raw parsed state for fields we don't model yet. */
  raw: Record<string, unknown>;
}

export async function readNgState(
  iframe: HTMLIFrameElement,
): Promise<NgViewState | null> {
  // Easiest cross-origin path: read the iframe's location.hash. This works
  // when both pages share an origin OR when NG updates the parent's hash
  // (it doesn't, but its OWN hash carries the state).
  let hash: string | null = null;
  try {
    hash = iframe.contentWindow?.location?.hash ?? null;
  } catch {
    // Cross-origin: can't reach contentWindow.location. Fall back to the
    // iframe's `src` attribute, which is at least the *initial* state.
    hash = new URL(iframe.src).hash || null;
  }
  if (!hash) return null;

  const json = decodeURIComponent(hash.replace(/^#!?/, ""));
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(json);
  } catch (e) {
    console.warn("failed to parse NG state json", e);
    return null;
  }

  const dims = state["dimensions"] as Record<string, [number, string]> | undefined;
  const dimensions: [number, number, number] = dims
    ? [dims["x"]?.[0] ?? 1, dims["y"]?.[0] ?? 1, dims["z"]?.[0] ?? 1]
    : [1, 1, 1];

  return {
    position: (state["position"] as [number, number, number] | undefined) ?? [0, 0, 0],
    crossSectionScale: Number(state["crossSectionScale"] ?? 1),
    projectionScale: Number(state["projectionScale"] ?? 1),
    projectionOrientation: state["projectionOrientation"] as
      | [number, number, number, number]
      | undefined,
    layout: String(state["layout"] ?? "xy"),
    dimensions,
    raw: state,
  };
}
