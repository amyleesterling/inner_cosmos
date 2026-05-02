import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrainSurface from "../components/BrainSurface";
import {
  BrainActivityMissingError,
  loadBrainActivity,
  loadBrainActivityManifest,
  type BrainActivityData,
  type BrainActivityManifest,
} from "../data/brainActivity";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; manifest: BrainActivityManifest; data: BrainActivityData }
  | { status: "missing" }
  | { status: "error"; message: string };

/** Full-bleed standalone brain page. No nav chrome — designed to slot in as
 *  the closing card of the larger Inner Cosmos experience. The cortex fills
 *  the screen, fMRI activity flickers on its surface, copy lives in the
 *  bottom-right corner so the brain reads first. */
export default function Brain() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showCopy, setShowCopy] = useState(true);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;
    Promise.all([loadBrainActivityManifest(), loadBrainActivity()])
      .then(([manifest, data]) => {
        if (aborted) return;
        setLoad({ status: "ready", manifest, data });
      })
      .catch((err) => {
        if (aborted) return;
        if (err instanceof BrainActivityMissingError) setLoad({ status: "missing" });
        else setLoad({ status: "error", message: String(err?.message ?? err) });
      });
    return () => { aborted = true; };
  }, []);

  // Drive the timeline. Loops on the trace duration so the animation cycles
  // forever without user input.
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
          const total = load.data.frames * load.data.trSeconds;
          const next = prev + dt;
          return next >= total ? next - total : next;
        });
      }
      lastTickRef.current = now;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [load, playing]);

  // Tap-to-toggle copy on mobile / esc to toggle on desktop. Both stay off
  // the 3D canvas so the user can still drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "i" || e.key === "I") {
        setShowCopy((c) => !c);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 bg-[var(--color-ink-950)] overflow-hidden">
      {/* Soft violet halo behind the brain — same palette as /explore stage 1
          so this reads as a continuation of that mesh, not a different brain. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(120, 70, 200, 0.18) 0%, rgba(120, 70, 200, 0.06) 45%, rgba(8,6,16,0) 80%)",
        }}
      />

      {/* The cortex fills the viewport */}
      <div className="absolute inset-0">
        {load.status === "ready" && (
          <BrainSurface
            activity={load.data}
            elapsedSec={elapsed}
            className="absolute inset-0"
          />
        )}
        {load.status === "loading" && (
          <BrainSurface elapsedSec={0} className="absolute inset-0" />
        )}
        {load.status === "missing" && <MissingDataNotice />}
        {load.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className="text-red-300/80 text-sm">
              Couldn't load brain activity: {load.message}
            </p>
          </div>
        )}
      </div>

      {/* Copy — bottom-right, gentle, dismissible. Press "I" or Esc to toggle. */}
      <AnimatePresence>
        {showCopy && (
          <motion.div
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto absolute bottom-6 right-6 max-w-[min(520px,46vw)] text-right"
          >
            <p
              className="text-[10px] uppercase tracking-[0.4em] text-white/45 mb-2.5"
              style={{ textShadow: "0 1px 10px rgba(4,6,12,0.95)" }}
            >
              fMRI activity · NNDb
            </p>
            <h1
              className="font-display font-light leading-[1.1]"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.6rem)",
                textShadow: "0 2px 18px rgba(4,6,12,0.95)",
              }}
            >
              A whole human brain, watching a movie.
            </h1>
            {load.status === "ready" && (
              <p
                className="mt-3 text-white/75 font-light leading-relaxed"
                style={{
                  fontSize: "clamp(0.85rem, 1.05vw, 1.02rem)",
                  textShadow: "0 1px 12px rgba(4,6,12,0.95)",
                }}
              >
                Real BOLD signal from {load.manifest.subject} of the
                Naturalistic Neuroimaging Database, watching{" "}
                <span className="italic text-white/90">
                  {load.manifest.movie}
                </span>{" "}
                — painted live onto the cortical surface. Every flicker is a
                measurement.
              </p>
            )}
            {load.status === "ready" && (
              <p
                className="mt-4 text-[10px] uppercase tracking-[0.25em] text-white/40"
                style={{ textShadow: "0 1px 10px rgba(4,6,12,0.95)" }}
              >
                {load.manifest.parcels} cortical parcels ·{" "}
                {load.data.frames} fMRI volumes · TR {load.data.trSeconds}s ·{" "}
                <a
                  href="https://openneuro.org/datasets/ds002837"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 decoration-white/30 hover:decoration-white/80 transition"
                >
                  ds002837
                </a>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-left: tiny play/pause + show-copy toggle. Doesn't compete
          with the brain visually. */}
      {load.status === "ready" && (
        <div className="absolute bottom-6 left-6 flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/55 ring-1 ring-white/15 backdrop-blur-md flex items-center justify-center transition cursor-pointer"
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause (space)" : "Play (space)"}
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
          <button
            type="button"
            onClick={() => setShowCopy((c) => !c)}
            className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/55 ring-1 ring-white/15 backdrop-blur-md flex items-center justify-center transition cursor-pointer"
            aria-label={showCopy ? "Hide info" : "Show info"}
            title={showCopy ? "Hide (i)" : "Show info (i)"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              {showCopy ? (
                <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      )}
    </div>
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
            python scripts/extract-fmri-activity.py
          </code>{" "}
          to stream a few minutes of BOLD signal from the Naturalistic
          Neuroimaging Database (OpenNeuro ds002837), parcellate the cortex,
          and write public/data/brain-activity.{"{"}bin,json{"}"}.
        </p>
      </div>
    </div>
  );
}
