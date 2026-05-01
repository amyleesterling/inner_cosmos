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

export default function Activity() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  // Last animation-frame timestamp; only used while playing.
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

  // Drive the timeline. Pausing and scrubbing are exact because we accumulate
  // wall-clock deltas instead of binding elapsed to frame count.
  useEffect(() => {
    if (load.status !== "ready" || !playing) {
      lastTickRef.current = null;
      return;
    }
    let frameId = 0;
    const tick = (now: number) => {
      const last = lastTickRef.current;
      if (last !== null) {
        const dt = ((now - last) / 1000) * speed;
        setElapsed((prev) => {
          const next = prev + dt;
          // Loop on the manifest's reported length.
          const total = load.manifest.seconds;
          return next >= total ? next - total : next;
        });
      }
      lastTickRef.current = now;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [load, playing, speed]);

  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />

      <main className="relative z-10 min-h-screen pt-28 pb-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center mb-10"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/45 mb-6">
            Activity
          </p>
          <h1
            style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
            className="font-display font-light leading-[1.1] text-balance"
          >
            Two hundred neurons, watching a movie.
          </h1>
          <p
            style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)" }}
            className="mt-6 text-white/60 font-light leading-relaxed text-balance"
          >
            Each cell here is a real pyramidal neuron from the MICrONS minnie65 volume.
            The glow is its measured calcium activity, recorded from the same animal
            before its brain was extracted for electron microscopy. Drag to rotate, scroll to zoom.
          </p>
        </motion.div>

        <div className="relative max-w-6xl mx-auto rounded-2xl glass overflow-hidden">
          <div className="aspect-[16/10] relative">
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

            {/* Loading progress overlay while meshes stream in */}
            {load.status === "ready" && progress.total > 0 && progress.loaded < progress.total && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-strong text-[11px] tracking-widest uppercase text-white/70">
                {progress.loaded} / {progress.total} cells
              </div>
            )}
          </div>

          {load.status === "ready" && (
            <Transport
              elapsed={elapsed}
              total={load.manifest.seconds}
              playing={playing}
              speed={speed}
              onTogglePlay={() => setPlaying((p) => !p)}
              onScrub={(t) => setElapsed(t)}
              onSpeed={setSpeed}
            />
          )}
        </div>

        {load.status === "ready" && (
          <div className="max-w-6xl mx-auto mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/55">
            <LayerKey color="#8edaff" label="L2/3 pyramidal" />
            <LayerKey color="#aab8ff" label="L4" />
            <LayerKey color="#ffc88a" label="L5 pyramidal" />
            <span className="text-white/30">·</span>
            <span>
              {load.manifest.cells.length} cells · {load.manifest.seconds}s loop · 30 fps
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
                MICrONS minnie65
              </a>
            </span>
          </div>
        )}
      </main>
    </>
  );
}

function Transport({
  elapsed,
  total,
  playing,
  speed,
  onTogglePlay,
  onScrub,
  onSpeed,
}: {
  elapsed: number;
  total: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onScrub: (t: number) => void;
  onSpeed: (s: number) => void;
}) {
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  return (
    <div className="px-4 sm:px-6 py-4 flex items-center gap-4 border-t border-white/10">
      <button
        type="button"
        onClick={onTogglePlay}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-white/15 flex items-center justify-center transition"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <span className="flex gap-[3px]">
            <span className="w-[3px] h-3 bg-white/80" />
            <span className="w-[3px] h-3 bg-white/80" />
          </span>
        ) : (
          <span
            className="border-y-[6px] border-y-transparent border-l-[10px] border-l-white/85 ml-[2px]"
            style={{ width: 0, height: 0 }}
          />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={total}
        step={0.05}
        value={elapsed}
        onChange={(e) => onScrub(parseFloat(e.target.value))}
        className="flex-1 accent-white/80 cursor-pointer"
        aria-label="Scrub"
      />
      <span className="font-mono text-xs text-white/55 w-16 text-right tabular-nums">
        {elapsed.toFixed(1)}s
      </span>
      <div className="flex items-center gap-1 ml-1">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className={`px-2 py-1 rounded-full text-[11px] tracking-wider transition ${
              speed === s ? "bg-white/15 text-white ring-1 ring-white/20" : "text-white/45 hover:text-white/80"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
      <div className="hidden sm:block w-px h-5 bg-white/10" />
      <span className="hidden sm:inline text-[10px] uppercase tracking-[0.25em] text-white/35 tabular-nums">
        {pct.toFixed(0)}%
      </span>
    </div>
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
          to pull 200 real coregistered MICrONS pyramidal cells and their
          calcium imaging traces from DANDI 000402. The script writes to
          public/meshes/activity/ and public/data/.
        </p>
      </div>
    </div>
  );
}
