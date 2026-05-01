import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import CellSwarm from "../components/CellSwarm";
import {
  ActivityDataMissingError,
  loadActivityManifest,
  loadActivityTraces,
  type ActivityManifest,
  type ActivityTraces,
} from "../data/activityCells";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; manifest: ActivityManifest; traces: ActivityTraces }
  | { status: "missing" }
  | { status: "error"; message: string };

const FIELD_LABEL: Record<number, { label: string; color: string }> = {
  2: { label: "L2/3 pyramidal", color: "#8edaff" },
  4: { label: "L4", color: "#aab8ff" },
  6: { label: "L5 pyramidal", color: "#ffc88a" },
};

export default function Activity() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;
    Promise.all([loadActivityManifest(), loadActivityTraces()])
      .then(([manifest, traces]) => {
        if (aborted) return;
        setLoad({ status: "ready", manifest, traces });
      })
      .catch((err) => {
        if (aborted) return;
        if (err instanceof ActivityDataMissingError) {
          setLoad({ status: "missing" });
        } else {
          setLoad({ status: "error", message: String(err?.message ?? err) });
        }
      });
    return () => { aborted = true; };
  }, []);

  // Drive the timeline. Loops on the manifest's reported length so the
  // animation cycles indefinitely without user interaction.
  useEffect(() => {
    if (load.status !== "ready" || !playing) {
      lastTickRef.current = null;
      return;
    }
    let frameId = 0;
    const tick = (now: number) => {
      const last = lastTickRef.current;
      if (last !== null) {
        const dt = (now - last) / 1000;
        setElapsed((prev) => {
          const next = prev + dt;
          const total = load.manifest.seconds;
          return next >= total ? next - total : next;
        });
      }
      lastTickRef.current = now;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [load, playing]);

  // Layers actually present in this dataset — used to render only the
  // legend chips that match real cells in the scene.
  const layersPresent =
    load.status === "ready"
      ? Array.from(new Set(load.manifest.cells.map((c) => c.field))).sort()
      : [];

  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-32 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />

      <main className="relative z-10 min-h-screen pt-24 sm:pt-28 pb-10 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center mb-6 sm:mb-8"
        >
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-white/45 mb-3 sm:mb-5">
            Activity
          </p>
          <h1
            style={{ fontSize: "clamp(1.6rem, 5vw, 4rem)" }}
            className="font-display font-light leading-[1.1] text-balance"
          >
            Visual neurons firing in response to watching a movie.
          </h1>
          <p
            style={{ fontSize: "clamp(0.9rem, 1.2vw, 1.05rem)" }}
            className="mt-4 sm:mt-6 text-white/60 font-light leading-relaxed text-balance"
          >
            Each cell here is a real pyramidal neuron from the MICrONS cubic
            millimeter dataset, glowing in time with its measured calcium
            activity. Drag to rotate, pinch to zoom.
          </p>
        </motion.div>

        <div className="relative max-w-6xl mx-auto rounded-2xl glass overflow-hidden">
          {/* Tall on mobile so the swarm fills the screen, cinematic 16:10 on desktop. */}
          <div
            className="relative"
            style={{ height: "min(78vh, 760px)" }}
          >
            {load.status === "ready" && (
              <CellSwarm
                manifest={load.manifest}
                traces={load.traces}
                elapsedSec={elapsed}
                onProgress={(loaded, total) => setProgress({ loaded, total })}
                className="absolute inset-0"
              />
            )}
            {load.status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/50 text-sm tracking-widest uppercase">connecting…</p>
              </div>
            )}
            {load.status === "missing" && <MissingDataNotice />}
            {load.status === "error" && (
              <div className="absolute inset-0 flex items-center justify-center px-8">
                <p className="text-red-300/80 text-sm">Couldn't load activity data: {load.message}</p>
              </div>
            )}

            {load.status === "ready" && progress.total > 0 && progress.loaded < progress.total && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-strong text-[11px] tracking-widest uppercase text-white/70">
                {progress.loaded} / {progress.total} cells
              </div>
            )}

            {/* Single subtle play/pause button — auto-loops, no other transport. */}
            {load.status === "ready" && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/55 ring-1 ring-white/15 backdrop-blur-md flex items-center justify-center transition"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <span className="flex gap-[3px]">
                    <span className="w-[3px] h-3.5 bg-white/85" />
                    <span className="w-[3px] h-3.5 bg-white/85" />
                  </span>
                ) : (
                  <span
                    className="border-y-[6px] border-y-transparent border-l-[10px] border-l-white/85 ml-[2px]"
                    style={{ width: 0, height: 0 }}
                  />
                )}
              </button>
            )}
          </div>
        </div>

        {load.status === "ready" && (
          <div className="max-w-6xl mx-auto mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
            {layersPresent.map((f) => {
              const meta = FIELD_LABEL[f];
              if (!meta) return null;
              return <LayerKey key={f} color={meta.color} label={meta.label} />;
            })}
            <span className="text-white/30">·</span>
            <span>
              {load.manifest.cells.length}{" "}
              {load.manifest.cells.length === 1 ? "cell" : "cells"} ·{" "}
              {load.manifest.seconds}s loop
            </span>
            <span className="ml-auto">
              Source:{" "}
              <a
                href="https://dandiarchive.org/dandiset/000402"
                target="_blank"
                rel="noreferrer"
                className="text-white/80 underline underline-offset-4 decoration-white/30 hover:decoration-white/80 transition"
              >
                DANDI 000402
              </a>{" "}
              · meshes from{" "}
              <a
                href="https://www.microns-explorer.org/cortical-mm3"
                target="_blank"
                rel="noreferrer"
                className="text-white/80 underline underline-offset-4 decoration-white/30 hover:decoration-white/80 transition"
              >
                MICrONS cubic millimeter
              </a>
            </span>
          </div>
        )}
      </main>
    </>
  );
}

function LayerKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
      {label}
    </span>
  );
}

function MissingDataNotice() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/45 mb-3">
          Dataset not extracted yet
        </p>
        <p className="text-white/70 text-sm leading-relaxed">
          Run{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 font-mono text-xs">
            python scripts/extract-functional-cells.py
          </code>{" "}
          to pull real coregistered MICrONS pyramidal cells and their calcium
          imaging traces from DANDI 000402. The script writes to
          public/meshes/activity/ and public/data/.
        </p>
      </div>
    </div>
  );
}
